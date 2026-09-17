import { Cause, Exit, Match, Option } from "effect";
import type { AppError } from "@/core/Errors";

interface Failure {
  readonly status: number;
  readonly body: { readonly error: string; readonly message?: string };
  readonly headers?: Record<string, string>;
}

/**
 * Every failure the app can reach the edge with, given a status code.
 *
 * `Match.exhaustive` is the point: a new `Schema.TaggedError` in the union stops the
 * build here until someone decides what the browser should see.
 */
const failureOf: (error: AppError) => Failure = Match.type<AppError>().pipe(
  Match.tag("StoryEnded", () => ({ status: 409, body: { error: "story_ended" } })),
  Match.tag("TurnConflict", () => ({ status: 409, body: { error: "turn_conflict" } })),
  Match.tag("RateLimited", (error) => ({
    status: 429,
    body: { error: "rate_limited" },
    headers: { "retry-after": String(error.retryAfterSeconds) },
  })),
  Match.tag("BudgetExhausted", () => ({ status: 503, body: { error: "budget_exhausted" } })),
  Match.tag("InvalidRequest", (error) => ({
    status: 400,
    body: { error: "invalid_request", message: error.message },
  })),
  Match.tag("QuestionError", "NarratorError", () => ({
    status: 502,
    body: { error: "upstream_failed" },
  })),
  Match.tag("StoryCorrupt", () => ({ status: 500, body: { error: "story_corrupt" } })),
  Match.exhaustive,
);

/** A cause with no typed failure in it: the client went away, or the app has a bug. */
const fromDefect = (cause: Cause.Cause<AppError>): Response => {
  if (Cause.isInterruptedOnly(cause)) return new Response(null, { status: 499 });
  console.error(Cause.pretty(cause));
  return Response.json({ error: "internal" }, { status: 500 });
};

/**
 * Turn the result of running one program into an HTTP response.
 *
 * The Route Handlers do nothing else with failure: they hand the `Exit` here and every
 * outcome — success, a typed failure, an interruption, a defect — has exactly one answer.
 */
export const respond = <A>(exit: Exit.Exit<A, AppError>): Response => {
  if (Exit.isSuccess(exit)) return Response.json(exit.value);
  return Option.match(Cause.failureOption(exit.cause), {
    onNone: () => fromDefect(exit.cause),
    onSome: (error) => {
      const failure = failureOf(error);
      return Response.json(failure.body, { status: failure.status, headers: failure.headers });
    },
  });
};
