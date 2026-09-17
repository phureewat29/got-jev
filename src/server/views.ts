import { Match } from "effect";
import * as Background from "@/core/Background";
import { openingLocationId, openingMoodId, prologue } from "@/core/data/prologue";
import * as Location from "@/core/Location";
import * as Position from "@/core/Position";
import * as Story from "@/core/Story";
import type { TurnResult } from "@/core/StoryEngine";
import type * as Wire from "@/server/schemas";

const place = (id: Location.LocationId): Wire.Place => ({
  id,
  name: Location.byId[id].name,
  region: Location.byId[id].region,
});

const whereabouts = Match.type<Position.Position>().pipe(
  Match.tag("At", (at) => ({ kind: "at" as const, location: place(at.location) })),
  Match.tag("OnRoad", (road) => ({
    kind: "on_road" as const,
    from: place(road.from),
    toward: road.toward,
  })),
  Match.exhaustive,
);

/**
 * The domain stores ids; the wire carries the names the header shows and the
 * path the artwork is fetched from. Both arms get a backdrop, so resolving it
 * sits outside the match rather than once per tag.
 */
export const position = (at: Position.Position): Wire.Position => ({
  ...whereabouts(at),
  background: Background.forPosition(at),
});

/**
 * The opening message. It carries the opening position and mood, so the header and the
 * soundtrack have something to read before a single turn is played.
 */
const opening: Wire.Message = {
  id: "prologue",
  role: "assistant",
  text: `${prologue.jon}\n\n${prologue.narrator}`,
  position: position(Position.at(openingLocationId)),
  mood: openingMoodId,
};

const exchange = (turn: Story.Turn, index: number): ReadonlyArray<Wire.Message> => [
  { id: `turn-${index}-user`, role: "user", text: turn.action },
  {
    id: `turn-${index}-assistant`,
    role: "assistant",
    text: turn.narration,
    position: position(turn.decision.position),
    mood: turn.decision.mood,
    beat: turn.decision.beat,
    danger: turn.decision.danger,
  },
];

/** The whole thread: the prologue, then every saved turn as a pair of messages. */
export const story = (state: Story.StoryState, maxTurns: number): Wire.StoryView => ({
  sessionId: state.sessionId,
  position: position(state.position),
  mood: state.mood,
  turn: state.turns.length,
  turnsRemaining: Story.turnsRemaining(state, maxTurns),
  ended: state.ended,
  messages: [opening, ...state.turns.flatMap((played, index) => exchange(played, index + 1))],
});

/** One played turn, as the composer's response. */
export const turn = (result: TurnResult): Wire.TurnView => ({
  position: position(result.decision.position),
  mood: result.decision.mood,
  beat: result.decision.beat,
  danger: result.decision.danger,
  text: result.text,
  turn: result.turn,
  turnsRemaining: result.turnsRemaining,
  ended: result.ended,
});
