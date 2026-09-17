import { Option } from "effect";
import * as Background from "@/core/Background";
import * as Beat from "@/core/Beat";
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

/**
 * The domain stores ids; the wire carries the name the header shows and the path
 * the artwork is fetched from, so the browser never carries the catalog.
 *
 * The beat travels beside the place because the backdrop belongs to the scene
 * rather than the map: a battle looks like a battle wherever it is fought. The
 * opening has no beat and hands `Option.none()`, which falls back to the place.
 */
export const position = (
  where: Position.Position,
  beat: Option.Option<Beat.BeatId>,
): Wire.Position => ({
  location: place(where.location),
  background: Background.forScene(where, beat),
});

/** The beat the story currently stands under; none at all before the first turn. */
const standingBeat = (state: Story.StoryState): Option.Option<Beat.BeatId> =>
  Option.map(Story.lastDecision(state), (decision) => decision.beat);

/**
 * The opening message. It carries the opening position and mood, so the header and the
 * soundtrack have something to read before a single turn is played.
 */
const opening: Wire.Message = {
  id: "prologue",
  role: "assistant",
  text: `${prologue.jon}\n\n${prologue.narrator}`,
  position: position(Position.at(openingLocationId), Option.none()),
  mood: openingMoodId,
};

const exchange = (turn: Story.Turn, index: number): ReadonlyArray<Wire.Message> => [
  { id: `turn-${index}-user`, role: "user", text: turn.action },
  {
    id: `turn-${index}-assistant`,
    role: "assistant",
    text: turn.narration,
    position: position(turn.decision.position, Option.some(turn.decision.beat)),
    mood: turn.decision.mood,
    beat: turn.decision.beat,
    danger: turn.decision.danger,
  },
];

/** The whole thread: the prologue, then every saved turn as a pair of messages. */
export const story = (state: Story.StoryState, maxTurns: number): Wire.StoryView => ({
  sessionId: state.sessionId,
  position: position(state.position, standingBeat(state)),
  mood: state.mood,
  turn: state.turns.length,
  turnsRemaining: Story.turnsRemaining(state, maxTurns),
  ended: state.ended,
  messages: [opening, ...state.turns.flatMap((played, index) => exchange(played, index + 1))],
});

/** One played turn, as the composer's response. */
export const turn = (result: TurnResult): Wire.TurnView => ({
  position: position(result.decision.position, Option.some(result.decision.beat)),
  mood: result.decision.mood,
  beat: result.decision.beat,
  danger: result.decision.danger,
  text: result.text,
  turn: result.turn,
  turnsRemaining: result.turnsRemaining,
  ended: result.ended,
});
