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

export type TurnRequest = typeof TurnRequest.Type;

/** The domain stores ids; the header needs the name, so the id is resolved server-side. */
export const Place = Schema.Struct({
  id: Location.LocationId,
  name: Schema.String,
  region: Location.Region,
});

export type Place = typeof Place.Type;

/** `background` is the artwork's public path, so the browser never carries the catalog. */
export const Position = Schema.Struct({
  location: Place,
  background: Schema.String,
});

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

export const decodeSessionId = decode(SessionId);

export const decodeTurnRequest = decode(TurnRequest);
