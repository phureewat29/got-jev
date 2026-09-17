import { describe, expect, it } from "vitest";
import * as Decision from "@/core/Decision";
import * as Position from "@/core/Position";
import { storedAnswers } from "./helpers";

const atCastleBlack = Position.at("castle-black");

describe("Decision.resolve", () => {
  it("moves to a place Jev is sure about", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({ location: { winterfell: 0.82, "the-kingsroad": 0.1 } }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.position).toEqual(Position.at("winterfell"));
  });

  it("takes the road when the scene ends between places", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({ location: { in_transit: 0.71 }, heading: "The North" }),
      previous: atCastleBlack,
      turnIndex: 3,
    });
    expect(decision.position).toEqual(
      Position.onRoad({ from: "castle-black", toward: "The North", since: 3 }),
    );
  });

  it("keeps the journey's start turn while the heading holds", () => {
    const onRoad = Position.onRoad({ from: "castle-black", toward: "The North", since: 2 });
    const decision = Decision.resolve({
      answers: storedAnswers({ location: { in_transit: 0.9 }, heading: "The North" }),
      previous: onRoad,
      turnIndex: 4,
    });
    expect(decision.position).toEqual({ ...onRoad });
  });

  it("restarts the journey when the heading changes", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({ location: { in_transit: 0.9 }, heading: "Riverlands" }),
      previous: Position.onRoad({ from: "castle-black", toward: "The North", since: 2 }),
      turnIndex: 4,
    });
    expect(decision.position).toEqual(
      Position.onRoad({ from: "castle-black", toward: "Riverlands", since: 4 }),
    );
  });

  it("folds a sub-place into the city it sits in", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({
        location: { "red-keep-throne-room": 0.34, "kings-landing": 0.3, "flea-bottom": 0.21 },
      }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.position).toEqual(Position.at("kings-landing"));
  });

  it("folds the city's own sub-places back into it", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({
        location: { "kings-landing": 0.3, "red-keep-throne-room": 0.25, "flea-bottom": 0.2 },
      }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.position).toEqual(Position.at("kings-landing"));
  });

  it("leaves the story where it was on weak evidence", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({ location: { winterfell: 0.2, harrenhal: 0.18, braavos: 0.12 } }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.position).toEqual(atCastleBlack);
  });

  it("treats an omitted option as zero rather than a gap", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({ location: {} }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.position).toEqual(atCastleBlack);
  });

  it("reads the mood, the beat, the danger and the fiction check", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({
        location: { winterfell: 0.9 },
        mood: "battle",
        beat: "duel",
        danger: 3.6,
        inFiction: 0.51,
      }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.mood).toBe("battle");
    expect(decision.beat).toBe("duel");
    expect(decision.danger).toBe("deadly");
    expect(decision.inFiction).toBe(true);
  });

  it("falls back rather than throwing when a saved id left the catalog", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({
        location: { winterfell: 0.9 },
        mood: "wistful",
        beat: "montage",
        heading: "The Moon",
        inFiction: 0.49,
      }),
      previous: atCastleBlack,
      turnIndex: 1,
    });
    expect(decision.mood).toBe("calm");
    expect(decision.beat).toBe("quiet");
    expect(decision.inFiction).toBe(false);
  });

  it("sends a journey with an unknown heading into travel country", () => {
    const decision = Decision.resolve({
      answers: storedAnswers({ location: { in_transit: 0.8 }, heading: "The Moon" }),
      previous: atCastleBlack,
      turnIndex: 2,
    });
    expect(decision.position).toEqual(
      Position.onRoad({ from: "castle-black", toward: "Westeros (travel)", since: 2 }),
    );
  });
});

describe("policy replay", () => {
  it("re-decides a saved turn under a different threshold", () => {
    const answers = storedAnswers({ location: { winterfell: 0.4, "the-kingsroad": 0.3 } });
    const input = { answers, previous: atCastleBlack, turnIndex: 1 };

    expect(Decision.resolve(input).position).toEqual(atCastleBlack);
    expect(Decision.resolve({ ...input, tauMove: 0.25 }).position).toEqual(
      Position.at("winterfell"),
    );
    expect(Decision.tauMove).toBe(0.5);
  });
});
