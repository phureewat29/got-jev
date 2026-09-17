import { describe, expect, it } from "vitest";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import * as Mood from "@/core/Mood";
import { BEATS, DANGERS, MOODS } from "@/components/api";

/**
 * The browser keeps its own copy of the label lists so the catalogs — lore,
 * criteria and all — stay out of the bundle. The copy is hand-written, and a
 * label the client has never heard of fails its guard silently: the header
 * simply stops showing that row, and a new mood never reaches the soundtrack.
 *
 * Nothing else notices, so this does.
 */
describe("the client's label lists", () => {
  it("mirrors the mood catalog exactly", () => {
    expect([...MOODS]).toEqual(Mood.all.map((mood) => mood.id));
  });

  it("mirrors the beat catalog exactly", () => {
    expect([...BEATS]).toEqual(Beat.all.map((beat) => beat.id));
  });

  it("mirrors the danger rubric exactly", () => {
    expect([...DANGERS]).toEqual(Danger.levels.map((level) => level.id));
  });
});
