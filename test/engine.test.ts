import { Array as Arr, Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import * as Budget from "@/core/Budget";
import * as Decision from "@/core/Decision";
import * as Position from "@/core/Position";
import * as CannedJev from "@/core/providers/CannedJev";
import * as CannedNarrator from "@/core/providers/CannedNarrator";
import * as MemoryStore from "@/core/providers/MemoryStore";
import * as Rules from "@/core/Rules";
import * as StoryEngine from "@/core/StoryEngine";
import { StoryStore } from "@/core/StoryStore";
import { sessionId } from "./helpers";

/** Canned Jev, canned prose, stories in a map: the whole engine with no network. */
const world = (
  options: {
    readonly maxTurns?: number;
    readonly maxTurnsPerDay?: number;
    readonly slipOnce?: boolean;
  } = {},
) =>
  Layer.mergeAll(
    CannedJev.layer,
    CannedNarrator.layer({ slipOnce: options.slipOnce }),
    MemoryStore.layer,
    Budget.layer({ maxTurnsPerDay: options.maxTurnsPerDay ?? 1000 }),
    Rules.layer({ maxTurns: options.maxTurns ?? 15 }),
  );

describe("StoryEngine.openStory", () => {
  it("seeds an unknown session at Castle Black and writes nothing", async () => {
    const program = Effect.gen(function* () {
      const state = yield* StoryEngine.openStory(sessionId);
      const store = yield* StoryStore;
      return { state, stored: yield* store.load(sessionId) };
    });

    const { state, stored } = await Effect.runPromise(Effect.provide(program, world()));
    expect(state.position).toEqual(Position.at("castle-black"));
    expect(state.mood).toBe("calm");
    expect(state.turns).toEqual([]);
    expect(state.ended).toBe(false);
    expect(Option.isNone(stored)).toBe(true);
  });
});

describe("StoryEngine.playTurn", () => {
  it("narrates, labels and moves the story", async () => {
    const program = Effect.gen(function* () {
      const first = yield* StoryEngine.playTurn(
        sessionId,
        0,
        "I climb the winch cage to the top of the Wall and look north.",
      );
      const second = yield* StoryEngine.playTurn(sessionId, 1, "I ride south for many days.");
      const third = yield* StoryEngine.playTurn(
        sessionId,
        2,
        "I come to Winterfell and pass through the gates.",
      );
      return { first, second, third, state: yield* StoryEngine.openStory(sessionId) };
    });

    const { first, second, third, state } = await Effect.runPromise(
      Effect.provide(program, world()),
    );

    expect(first.decision.position).toEqual(Position.at("top-of-the-wall"));
    expect(first.text).toContain("look north");
    expect(first.turn).toBe(1);
    expect(first.turnsRemaining).toBe(14);
    expect(first.decision.inFiction).toBe(true);

    expect(second.decision.position).toEqual(
      Position.onRoad({ from: "top-of-the-wall", toward: "The North", since: 2 }),
    );

    expect(third.decision.position).toEqual(Position.at("winterfell"));
    expect(third.turn).toBe(3);
    expect(third.ended).toBe(false);

    expect(state.turns.length).toBe(3);
    expect(state.position).toEqual(Position.at("winterfell"));
    expect(state.mood).toBe(third.decision.mood);
  });

  it("refuses a turn the story is not on", async () => {
    const program = Effect.flip(StoryEngine.playTurn(sessionId, 4, "I wait by the fire."));
    const error = await Effect.runPromise(Effect.provide(program, world()));
    expect(error._tag).toBe("TurnConflict");
  });

  it("stops at the cap and refuses anything after it", async () => {
    const program = Effect.gen(function* () {
      const played = yield* Effect.forEach(Arr.range(0, 14), (turn) =>
        StoryEngine.playTurn(sessionId, turn, "I keep the watch."),
      );
      const after = yield* Effect.flip(StoryEngine.playTurn(sessionId, 15, "I keep the watch."));
      return { played, after };
    });

    const { played, after } = await Effect.runPromise(Effect.provide(program, world()));
    expect(played.length).toBe(15);
    expect(played[13].ended).toBe(false);
    expect(played[14].ended).toBe(true);
    expect(played[14].turnsRemaining).toBe(0);
    expect(after._tag).toBe("StoryEnded");
  });

  it("regenerates once when the prose leaves the fiction, then keeps it", async () => {
    const program = StoryEngine.playTurn(sessionId, 0, "I sit by the fire with Sam.");
    const result = await Effect.runPromise(Effect.provide(program, world({ slipOnce: true })));

    expect(result.text).not.toContain(CannedNarrator.slipLine);
    expect(result.decision.inFiction).toBe(true);
  });

  it("charges the daily budget and stops when it is spent", async () => {
    const program = Effect.gen(function* () {
      yield* StoryEngine.playTurn(sessionId, 0, "I keep the watch.");
      return yield* Effect.flip(StoryEngine.playTurn(sessionId, 1, "I keep the watch."));
    });

    const error = await Effect.runPromise(Effect.provide(program, world({ maxTurnsPerDay: 1 })));
    expect(error._tag).toBe("BudgetExhausted");
  });
});

describe("exact answers", () => {
  it("folds a spread across a city's quarters into the city", async () => {
    const action = "I ride through the gates of the capital.";
    const narration = CannedNarrator.sceneFor(action);
    const fixtures = {
      [narration]: {
        location: {
          type: "choice",
          choice: "red-keep-throne-room",
          confidence: 0.34,
          probabilities: {
            "red-keep-throne-room": 0.34,
            "kings-landing": 0.3,
            "flea-bottom": 0.21,
          },
        },
      },
    };

    const exact = Layer.mergeAll(
      CannedJev.fromFixtures(fixtures),
      CannedNarrator.layer(),
      MemoryStore.layer,
      Budget.layer({ maxTurnsPerDay: 10 }),
      Rules.layer({ maxTurns: 15 }),
    );

    const result = await Effect.runPromise(
      Effect.provide(StoryEngine.playTurn(sessionId, 0, action), exact),
    );
    expect(result.decision.position).toEqual(Position.at("kings-landing"));
  });
});

describe("saved turns replay", () => {
  it("re-decides a stored turn under a stricter threshold", async () => {
    const program = Effect.gen(function* () {
      yield* StoryEngine.playTurn(sessionId, 0, "I come to Winterfell.");
      return yield* StoryEngine.openStory(sessionId);
    });

    const state = await Effect.runPromise(Effect.provide(program, world()));
    const saved = state.turns[0];
    expect(saved.decision.position).toEqual(Position.at("winterfell"));

    const strict = Decision.resolve({
      answers: saved.answers,
      previous: Position.at("castle-black"),
      turnIndex: 1,
      tauMove: 0.95,
    });
    expect(strict.position).toEqual(Position.at("castle-black"));
  });
});
