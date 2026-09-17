import { Effect } from "effect";
import { Rules } from "@/core/Rules";
import * as StoryEngine from "@/core/StoryEngine";
import { respond } from "@/server/respond";
import { runtime as appRuntime } from "@/server/runtime";
import { decodeSessionId } from "@/server/schemas";
import * as views from "@/server/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The whole thread for one session. A session that has never played a turn is served
 * from the unsaved seed, so opening the page writes nothing.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const program = Effect.gen(function* () {
    const sessionId = yield* decodeSessionId(id);
    const { maxTurns } = yield* Rules;
    const state = yield* StoryEngine.openStory(sessionId);
    return views.story(state, maxTurns);
  });
  return respond(await appRuntime.runPromiseExit(program));
}
