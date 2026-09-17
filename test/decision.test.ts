import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Decision from "@/core/Decision";
import * as Location from "@/core/Location";
import * as Position from "@/core/Position";
import { StoredAnswers } from "@/core/Question";
import { storedAnswers } from "./helpers";

describe("Decision.resolve", () => {
  it("moves to the place Jev names", () => {
    const decision = Decision.resolve(
      storedAnswers({ location: { winterfell: 0.82, "the-kingsroad": 0.1 } }),
    );
    expect(decision.position).toEqual(Position.at("winterfell"));
  });

  it("folds a sub-place into the city it sits in", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "red-keep-throne-room": 0.34, "kings-landing": 0.3, "flea-bottom": 0.21 },
      }),
    );
    expect(decision.position).toEqual(Position.at("kings-landing"));
  });

  it("folds the city's own sub-places back into it", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { "kings-landing": 0.3, "red-keep-throne-room": 0.25, "flea-bottom": 0.2 },
      }),
    );
    expect(decision.position).toEqual(Position.at("kings-landing"));
  });

  it("keeps a sub-place that holds the scene on its own", () => {
    const decision = Decision.resolve(
      storedAnswers({ location: { "red-keep-throne-room": 0.9, "kings-landing": 0.05 } }),
    );
    expect(decision.position).toEqual(Position.at("red-keep-throne-room"));
  });

  it("moves on weak evidence rather than standing still", () => {
    const decision = Decision.resolve(
      storedAnswers({ location: { winterfell: 0.2, harrenhal: 0.18, braavos: 0.12 } }),
    );
    expect(decision.position).toEqual(Position.at("winterfell"));
  });

  it("treats an omitted option as zero and falls back on Jev's own pick", () => {
    const decision = Decision.resolve(storedAnswers({ location: {}, choice: "harrenhal" }));
    expect(decision.position).toEqual(Position.at("harrenhal"));
  });

  it("reads the mood, the beat, the danger and the fiction check", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: { winterfell: 0.9 },
        mood: "battle",
        beat: "duel",
        danger: 3.6,
        inFiction: 0.51,
      }),
    );
    expect(decision.mood).toBe("battle");
    expect(decision.beat).toBe("duel");
    expect(decision.danger).toBe("deadly");
    expect(decision.inFiction).toBe(true);
  });

  it("falls back rather than throwing when a saved id left the catalog", () => {
    const decision = Decision.resolve(
      storedAnswers({
        location: {},
        choice: "kings-cross",
        mood: "wistful",
        beat: "montage",
        inFiction: 0.49,
      }),
    );
    expect(decision.position).toEqual(Position.at(Location.fallback));
    expect(decision.mood).toBe("calm");
    expect(decision.beat).toBe("quiet");
    expect(decision.inFiction).toBe(false);
  });
});

describe("replay", () => {
  it("re-decides a turn from the stored record alone", () => {
    const answers = storedAnswers({
      location: { "red-keep-throne-room": 0.34, "kings-landing": 0.3, "flea-bottom": 0.21 },
      mood: "battle",
      beat: "duel",
      danger: 2.4,
    });
    const onDisk = JSON.parse(JSON.stringify(Schema.encodeSync(StoredAnswers)(answers))) as unknown;
    const reread = Schema.decodeUnknownSync(StoredAnswers)(onDisk);

    expect(Decision.resolve(reread)).toEqual(Decision.resolve(answers));
    expect(Decision.resolve(reread).position).toEqual(Position.at("kings-landing"));
  });
});
