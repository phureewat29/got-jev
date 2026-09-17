import { Clock, Effect, Option, Ref } from "effect";
import { Budget } from "@/core/Budget";
import * as Decision from "@/core/Decision";
import { OutOfFiction, StoryEnded, TurnConflict } from "@/core/Errors";
import { Narrator } from "@/core/Narrator";
import * as Oracle from "@/core/Oracle";
import * as Prompt from "@/core/Prompt";
import { toStored } from "@/core/Question";
import { Rules } from "@/core/Rules";
import * as Story from "@/core/Story";
import { StoryStore } from "@/core/StoryStore";

export interface TurnResult {
  readonly decision: Decision.Decision;
  readonly text: string;
  /** Turns completed once this one is saved. */
  readonly turn: number;
  readonly turnsRemaining: number;
  readonly ended: boolean;
}

const now = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));

/** Reading never writes: a session exists on disk only once its first turn is played. */
export const openStory = Effect.fn("StoryEngine.openStory")(function* (sessionId: Story.SessionId) {
  const store = yield* StoryStore;
  const saved = yield* store.load(sessionId);
  if (Option.isSome(saved)) return saved.value;
  return Story.seed(sessionId, yield* now);
});

/**
 * The narrate-and-judge pair is retried once when Jev's `inFiction` says the prose left
 * the world, with a stricter reminder in the prompt. A second slip is accepted rather
 * than failing the turn, and the rejected attempt rides on `OutOfFiction` so the
 * recovery has the prose and the answers it needs.
 */
export const playTurn = Effect.fn("StoryEngine.playTurn")(
  function* (sessionId: Story.SessionId, turn: number, action: string) {
    const { maxTurns } = yield* Rules;
    const store = yield* StoryStore;
    const budget = yield* Budget;
    const narrator = yield* Narrator;

    const state = yield* openStory(sessionId);
    if (state.ended || state.turns.length >= maxTurns) {
      return yield* new StoryEnded({ turns: state.turns.length });
    }
    if (state.turns.length !== turn) {
      return yield* new TurnConflict({ expected: state.turns.length, received: turn });
    }
    yield* budget.spend;

    const turnIndex = Story.nextTurnIndex(state);
    const isFinalTurn = turnIndex === maxTurns;
    const attempts = yield* Ref.make(0);

    const generate = Effect.gen(function* () {
      const earlier = yield* Ref.getAndUpdate(attempts, (count) => count + 1);
      const messages = Prompt.build(state, action, { isFinalTurn, strictReminder: earlier > 0 });
      const narration = yield* narrator.narrate(messages);
      const answers = toStored(yield* Oracle.judge(Oracle.stateFor(state, action, narration)));
      if (answers.inFiction.noul >= Decision.inFictionThreshold) return { narration, answers };
      return yield* new OutOfFiction({ narration, answers, noul: answers.inFiction.noul });
    });

    const attempt = yield* generate.pipe(
      Effect.retry({ times: 1, while: (error) => error._tag === "OutOfFiction" }),
      Effect.catchTag("OutOfFiction", (slip) =>
        Effect.as(
          Effect.logWarning("narration left the fiction twice; keeping it").pipe(
            Effect.annotateLogs({ noul: slip.noul }),
          ),
          { narration: slip.narration, answers: slip.answers },
        ),
      ),
    );

    const decision = Decision.resolve(attempt.answers);
    const saved = Story.appendTurn(
      state,
      {
        action,
        narration: attempt.narration,
        answers: attempt.answers,
        decision,
        at: yield* now,
      },
      maxTurns,
    );
    yield* store.save(saved);

    const result: TurnResult = {
      decision,
      text: attempt.narration,
      turn: saved.turns.length,
      turnsRemaining: Story.turnsRemaining(saved, maxTurns),
      ended: saved.ended,
    };
    return result;
  },
  (effect, sessionId, turn) => effect.pipe(Effect.annotateLogs({ sessionId, turn })),
);
