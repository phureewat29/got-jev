import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Position from "@/core/Position";
import * as Story from "@/core/Story";
import * as Wire from "@/server/schemas";
import * as views from "@/server/views";
import { decision, playedTurn, sessionId } from "./helpers";

const seed = Story.seed(sessionId, new Date("2026-01-01T00:00:00.000Z"));

describe("views.position", () => {
  it("resolves a place id into the name the header shows and the artwork behind it", () => {
    expect(views.position(Position.at("kings-landing"))).toEqual({
      location: { id: "kings-landing", name: "King's Landing", region: "Crownlands" },
      background: "/scenes/kings-landing.webp",
    });
  });
});

describe("views.story", () => {
  it("opens a fresh session with the prologue alone", () => {
    const view = views.story(seed, 15);
    expect(Schema.decodeUnknownSync(Wire.StoryView)(view)).toEqual(view);
    expect(view.turn).toBe(0);
    expect(view.turnsRemaining).toBe(15);
    expect(view.ended).toBe(false);
    expect(view.messages.length).toBe(1);
    expect(view.messages[0].id).toBe("prologue");
    expect(view.messages[0].role).toBe("assistant");
    expect(view.messages[0].mood).toBe("calm");
    expect(view.messages[0].position).toEqual(views.position(Position.at("castle-black")));
  });

  it("follows the prologue with one pair of messages per played turn", () => {
    const played = playedTurn({
      action: "I ride south",
      narration: "You ride south.",
      decision: decision({ position: Position.at("winterfell"), mood: "triumphant" }),
    });
    const view = views.story({ ...seed, turns: [played], position: Position.at("winterfell") }, 15);

    expect(Schema.decodeUnknownSync(Wire.StoryView)(view)).toEqual(view);
    expect(view.messages.map((message) => message.id)).toEqual([
      "prologue",
      "turn-1-user",
      "turn-1-assistant",
    ]);
    expect(view.messages[1].text).toBe("I ride south");
    expect(view.messages[2].mood).toBe("triumphant");
    expect(view.messages[2].position).toEqual(views.position(Position.at("winterfell")));
    expect(view.turn).toBe(1);
    expect(view.turnsRemaining).toBe(14);
  });
});

describe("views.turn", () => {
  it("answers a played turn with its labels", () => {
    const view = views.turn({
      decision: decision({ position: Position.at("winterfell"), mood: "battle", beat: "battle" }),
      text: "You ride through the gates.",
      turn: 4,
      turnsRemaining: 11,
      ended: false,
    });
    expect(Schema.decodeUnknownSync(Wire.TurnView)(view)).toEqual(view);
    expect(view.mood).toBe("battle");
    expect(view.beat).toBe("battle");
    expect(view.position).toEqual(views.position(Position.at("winterfell")));
  });
});

describe("request schemas", () => {
  it("trims an action and rejects an empty or oversized one", () => {
    expect(Either.getOrNull(Wire.decodeTurnRequest({ action: "  I wait  ", turn: 0 }))).toEqual({
      action: "I wait",
      turn: 0,
    });
    expect(Wire.decodeTurnRequest({ action: "   ", turn: 0 })._tag).toBe("Left");
    expect(Wire.decodeTurnRequest({ action: "x".repeat(201), turn: 0 })._tag).toBe("Left");
    expect(Wire.decodeTurnRequest({ action: "I wait", turn: -1 })._tag).toBe("Left");
    expect(Wire.decodeTurnRequest({ action: "I wait" })._tag).toBe("Left");
  });

  it("rejects a session id that is not a uuid", () => {
    expect(Wire.decodeSessionId(sessionId)._tag).toBe("Right");
    expect(Wire.decodeSessionId("not-a-uuid")._tag).toBe("Left");
  });
});
