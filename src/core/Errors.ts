import { Schema } from "effect";
import { StoredAnswers } from "@/core/Question";

export const describeCause = (cause: unknown): string =>
  cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);

/** Jev could not be reached, refused the request, or took too long. */
export class QuestionError extends Schema.TaggedError<QuestionError>()("QuestionError", {
  message: Schema.String,
}) {}

/** The narrator model could not be reached, or returned nothing usable. */
export class NarratorError extends Schema.TaggedError<NarratorError>()("NarratorError", {
  message: Schema.String,
}) {}

/**
 * The narration left the fiction. Internal to `StoryEngine`: it carries the
 * rejected attempt so a second failure can still be accepted and stored.
 */
export class OutOfFiction extends Schema.TaggedError<OutOfFiction>()("OutOfFiction", {
  narration: Schema.String,
  answers: StoredAnswers,
  noul: Schema.Number,
}) {}

/** A saved story could not be read back. */
export class StoryCorrupt extends Schema.TaggedError<StoryCorrupt>()("StoryCorrupt", {
  sessionId: Schema.String,
  message: Schema.String,
}) {}

/** The session has already played its last turn. */
export class StoryEnded extends Schema.TaggedError<StoryEnded>()("StoryEnded", {
  turns: Schema.Int,
}) {}

/** The client asked for a turn the story is not on, from two tabs or a reload mid-turn. */
export class TurnConflict extends Schema.TaggedError<TurnConflict>()("TurnConflict", {
  expected: Schema.Int,
  received: Schema.Int,
}) {}

/** The demo's daily allowance of upstream turns is spent. */
export class BudgetExhausted extends Schema.TaggedError<BudgetExhausted>()("BudgetExhausted", {
  maxTurnsPerDay: Schema.Int,
}) {}

/** Too many turns from one address inside the sliding window. */
export class RateLimited extends Schema.TaggedError<RateLimited>()("RateLimited", {
  retryAfterSeconds: Schema.Int,
}) {}

/** The request body or path parameter did not decode. */
export class InvalidRequest extends Schema.TaggedError<InvalidRequest>()("InvalidRequest", {
  message: Schema.String,
}) {}

/**
 * Everything a Route Handler can fail with. `OutOfFiction` is absent on purpose:
 * `StoryEngine` always recovers from it, so it never reaches the edge.
 */
export type AppError =
  | QuestionError
  | NarratorError
  | StoryCorrupt
  | StoryEnded
  | TurnConflict
  | BudgetExhausted
  | RateLimited
  | InvalidRequest;
