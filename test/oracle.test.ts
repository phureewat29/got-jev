import { describe, expect, it } from "vitest";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Oracle from "@/core/Oracle";
import * as Story from "@/core/Story";
import { playedTurn, sessionId } from "./helpers";

const openedAt = new Date("2026-01-01T00:00:00.000Z");
const seed = Story.seed(sessionId, openedAt);

describe("Oracle.questions", () => {
  it("asks five questions in one request", () => {
    expect(Object.keys(Oracle.questions)).toEqual([
      "location",
      "beat",
      "mood",
      "danger",
      "inFiction",
    ]);
  });

  it("offers every catalog place and nothing that is not one", () => {
    const labels = Object.keys(Oracle.questions.location.criteria);
    expect(labels.length).toBe(Location.all.length);
    expect(labels.every(Location.isLocationId)).toBe(true);
    expect(labels).toContain("castle-black");
  });

  it("asks for a real place even when the scene ends between two", () => {
    const instructions = String(Oracle.questions.location.instructions);
    expect(instructions).toContain("Always name a real place");
  });

  it("describes every place with the same shape", () => {
    const shapes = new Set(
      Object.values(Oracle.questions.location.criteria).map((option) =>
        Object.keys(option).sort().join(","),
      ),
    );
    expect([...shapes]).toEqual(["also_called,region,summary"]);
  });

  it("describes beats and moods by what they are and one thing they look like", () => {
    expect(Object.keys(Oracle.questions.beat.criteria).length).toBe(Beat.all.length);
    expect(Oracle.questions.beat.criteria.battle.definition).toBe(Beat.byId.battle.definition);
    expect(Oracle.questions.beat.criteria.battle.example).toBe(Beat.byId.battle.example);

    expect(Object.keys(Oracle.questions.mood.criteria).length).toBe(Mood.all.length);
    expect(Oracle.questions.mood.criteria.calm.feel).toBe(Mood.byId.calm.feel);
    expect(Oracle.questions.mood.criteria.calm.examples).toEqual([...Mood.byId.calm.examples]);
  });

  it("scores danger against the whole rubric", () => {
    expect(Oracle.questions.danger.criteria.length).toBe(Danger.levels.length);
  });

  it("points every question at the shared state by path", () => {
    const instructions = Object.values(Oracle.questions)
      .map((question) => String(question.instructions))
      .join(" ");
    expect(instructions).toContain("`scene.narration`");
    expect(instructions).toContain("`story.previous_position`");
  });
});

describe("Oracle.stateFor", () => {
  it("carries the opening position, no history and the new scene", () => {
    const state = Oracle.stateFor(seed, "I look north", "You look north, and the wind answers.");
    expect(state.story.previous_position).toEqual({
      location: "Castle Black",
      region: "The Wall",
    });
    expect(state.story.recent).toEqual([]);
    expect(state.scene).toEqual({
      action: "I look north",
      narration: "You look north, and the wind answers.",
    });
  });

  it("shows only the last few exchanges", () => {
    const turns = [1, 2, 3, 4, 5].map((index) =>
      playedTurn({ action: `action ${index}`, narration: `narration ${index}` }),
    );
    const state = Oracle.stateFor({ ...seed, turns }, "now", "then");
    expect(state.story.recent.length).toBe(Oracle.recentTurnCount);
    expect(state.story.recent.map((scene) => scene.action)).toEqual([
      "action 3",
      "action 4",
      "action 5",
    ]);
  });
});
