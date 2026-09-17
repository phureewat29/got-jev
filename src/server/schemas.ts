import { Either, ParseResult, Schema } from "effect";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import { InvalidRequest } from "@/core/Errors";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import { SessionId } from "@/core/Story";

/** The composer's cap, enforced again on the server so the client cannot lift it. */
export const maxActionLength = 200;

/** One turn as the client sends it. `turn` is how many turns the client believes are done. */
export const TurnRequest = Schema.Struct({
  action: Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(maxActionLength)),
  turn: Schema.Int.pipe(Schema.nonNegative()),
});

/** One turn as the client sends it. */
export type TurnRequest = typeof TurnRequest.Type;

/**
 * A place on the wire. The domain stores ids; the header needs a name, so the id is
 * resolved here rather than in the browser.
 */
export const Place = Schema.Struct({
  id: Location.LocationId,
  name: Schema.String,
  region: Location.Region,
});

/** A place on the wire. */
export type Place = typeof Place.Type;

/**
 * Where the story stands, on the wire. `background` is the public path of the
 * scene's artwork, resolved here so the browser never carries the catalog.
 */
export const Position = Schema.Struct({
  location: Place,
  background: Schema.String,
});

/** Where the story stands, on the wire. */
export type Position = typeof Position.Type;

/** One message in the thread, with the labels that message was written under. */
export const Message = Schema.Struct({
  id: Schema.String,
  role: Schema.Literal("user", "assistant"),
  text: Schema.String,
  position: Schema.optional(Position),
  mood: Schema.optional(Mood.MoodId),
  beat: Schema.optional(Beat.BeatId),
  danger: Schema.optional(Danger.DangerId),
});

/** One message in the thread. */
export type Message = typeof Message.Type;

/** The whole story, as `GET /api/story/[id]` returns it. */
export const StoryView = Schema.Struct({
  sessionId: SessionId,
  position: Position,
  mood: Mood.MoodId,
  /** Turns already played. */
  turn: Schema.Int,
  turnsRemaining: Schema.Int,
  ended: Schema.Boolean,
  messages: Schema.Array(Message),
});

/** The whole story, as `GET /api/story/[id]` returns it. */
export type StoryView = typeof StoryView.Type;

/** One played turn, as `POST /api/story/[id]/turn` returns it. */
export const TurnView = Schema.Struct({
  position: Position,
  mood: Mood.MoodId,
  beat: Beat.BeatId,
  danger: Danger.DangerId,
  text: Schema.String,
  /** Turns played after this one. */
  turn: Schema.Int,
  turnsRemaining: Schema.Int,
  ended: Schema.Boolean,
});

/** One played turn, as `POST /api/story/[id]/turn` returns it. */
export type TurnView = typeof TurnView.Type;

const firstIssue = (error: ParseResult.ParseError): string => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
  const issue = issues[0];
  if (issue === undefined) return "invalid request";
  if (issue.path.length === 0) return issue.message;
  return `${issue.path.join(".")}: ${issue.message}`;
};

const decode = <A, I>(schema: Schema.Schema<A, I>) => {
  const decoder = Schema.decodeUnknownEither(schema);
  return (input: unknown): Either.Either<A, InvalidRequest> =>
    decoder(input).pipe(
      Either.mapLeft((error) => new InvalidRequest({ message: firstIssue(error) })),
    );
};

/** Read the `[id]` path segment as a session id, or fail the request at the edge. */
export const decodeSessionId = decode(SessionId);

/** Read the `POST` body, or fail the request at the edge. */
export const decodeTurnRequest = decode(TurnRequest);
