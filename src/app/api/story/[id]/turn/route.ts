import { Effect } from "effect";
import { InvalidRequest } from "@/core/Errors";
import * as StoryEngine from "@/core/StoryEngine";
import { callerOf, RateLimiter } from "@/server/RateLimiter";
import { respond } from "@/server/respond";
import { runtime as appRuntime } from "@/server/runtime";
import { decodeSessionId, decodeTurnRequest } from "@/server/schemas";
import * as views from "@/server/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readJson = (request: Request) =>
  Effect.tryPromise({
    try: (): Promise<unknown> => request.json(),
    catch: () => new InvalidRequest({ message: "the request body must be JSON" }),
  });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const program = Effect.gen(function* () {
    const sessionId = yield* decodeSessionId(id);
    const limiter = yield* RateLimiter;
    yield* limiter.check(callerOf(request.headers));
    const { action, turn } = yield* decodeTurnRequest(yield* readJson(request));
    return views.turn(yield* StoryEngine.playTurn(sessionId, turn, action));
  });
  return respond(await appRuntime.runPromiseExit(program));
}
