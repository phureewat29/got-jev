import { describe, expect, it } from "vitest";
import * as Position from "@/core/Position";
import * as Prompt from "@/core/Prompt";
import * as Story from "@/core/Story";
import { decision, playedTurn, sessionId } from "./helpers";

const seed = Story.seed(sessionId, new Date("2026-01-01T00:00:00.000Z"));
const action = "I climb the winch cage and look north";

const systemOf = (messages: ReadonlyArray<{ role: string; content: string }>): string =>
  messages.find((message) => message.role === "system")?.content ?? "";

const userOf = (messages: ReadonlyArray<{ role: string; content: string }>): string =>
  messages.find((message) => message.role === "user")?.content ?? "";

/** A story that has been on the road since `since`, about to play `turns + 1`. */
const onRoadFor = (since: number, turns: number): Story.StoryState => ({
  ...seed,
  position: Position.onRoad({ from: "castle-black", toward: "The North", since }),
  turns: Array.from({ length: turns }, () => playedTurn()),
});

describe("Prompt.build", () => {
  it("keeps the player's action out of the rules", () => {
    const messages = Prompt.build(seed, action, { isFinalTurn: false });
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(userOf(messages)).toBe(`<action>${action}</action>`);
    expect(systemOf(messages)).not.toContain(action);
  });

  it("carries the current place's lore", () => {
    const system = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    expect(system).toContain("Castle Black");
    expect(system).toContain("Night's Watch");
    expect(system).toContain("This is the opening scene of the story.");
  });

  it("asks for a closing chapter only on the final turn", () => {
    const ordinary = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    const closing = systemOf(Prompt.build(seed, action, { isFinalTurn: true }));
    expect(ordinary).not.toContain("bring this chapter to a close");
    expect(ordinary).toContain("Write the next scene.");
    expect(closing).toContain("bring this chapter to a close");
  });

  it("offers an arrival, then insists once the road has run long", () => {
    const early = systemOf(Prompt.build(onRoadFor(2, 2), action, { isFinalTurn: false }));
    const late = systemOf(Prompt.build(onRoadFor(1, 2), action, { isFinalTurn: false }));
    expect(early).toContain("you may arrive somewhere plausible");
    expect(early).not.toContain("have him arrive this turn");
    expect(late).toContain("have him arrive this turn");
  });

  it("carries last turn's beat, mood and danger forward", () => {
    const played = playedTurn({
      decision: decision({ beat: "battle", mood: "battle", danger: "deadly" }),
    });
    const system = systemOf(
      Prompt.build({ ...seed, turns: [played] }, action, { isFinalTurn: false }),
    );
    expect(system).toContain("pitched battle");
    expect(system).toContain("its mood was battle");
    expect(system).toContain("Jon's danger was deadly");
  });

  it("adds the stricter reminder only on the regeneration", () => {
    const first = systemOf(Prompt.build(seed, action, { isFinalTurn: false }));
    const second = systemOf(
      Prompt.build(seed, action, { isFinalTurn: false, strictReminder: true }),
    );
    expect(first).not.toContain("left the fiction");
    expect(second).toContain("left the fiction");
  });
});
