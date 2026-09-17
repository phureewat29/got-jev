import { Option, Schema } from "effect";
import { Decision } from "@/core/Decision";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import { openingLocationId, openingMoodId } from "@/core/data/prologue";
import { StoredAnswers } from "@/core/Question";

/** A browser-generated session id; one story per id. */
export const SessionId = Schema.UUID.pipe(Schema.brand("SessionId"));

export type SessionId = typeof SessionId.Type;

/** One played turn: what the player did, what the narrator wrote, and what Jev made of it. */
export const Turn = Schema.Struct({
  action: Schema.String,
  narration: Schema.String,
  answers: StoredAnswers,
  decision: Decision,
  at: Schema.Date,
});

export type Turn = typeof Turn.Type;

/** A whole storyline, as it is written to the store. */
export const StoryState = Schema.Struct({
  sessionId: SessionId,
  position: Position.Position,
  mood: Mood.MoodId,
  turns: Schema.Array(Turn),
  ended: Schema.Boolean,
  updatedAt: Schema.Date,
});

export type StoryState = typeof StoryState.Type;

/** The opening state: Castle Black, nothing played yet. */
export const seed = (sessionId: SessionId, at: Date): StoryState => ({
  sessionId,
  position: Position.at(openingLocationId),
  mood: openingMoodId,
  turns: [],
  ended: false,
  updatedAt: at,
});

/** The turn about to be played, counting from one. */
export const nextTurnIndex = (state: StoryState): number => state.turns.length + 1;

export const turnsRemaining = (state: StoryState, maxTurns: number): number =>
  Math.max(0, maxTurns - state.turns.length);

const lastTurn = (state: StoryState): Option.Option<Turn> =>
  Option.fromNullable(state.turns.at(-1));

export const lastDecision = (state: StoryState): Option.Option<Decision> =>
  Option.map(lastTurn(state), (turn) => turn.decision);

export const recentTurns = (state: StoryState, count: number): ReadonlyArray<Turn> =>
  state.turns.slice(-count);

/** Append a played turn; the decision it carries becomes the story's new state. */
export const appendTurn = (state: StoryState, turn: Turn, maxTurns: number): StoryState => {
  const turns = [...state.turns, turn];
  return {
    ...state,
    position: turn.decision.position,
    mood: turn.decision.mood,
    turns,
    ended: turns.length >= maxTurns,
    updatedAt: turn.at,
  };
};
