import { Context, type Effect, type Option } from "effect";
import type { StoryCorrupt } from "@/core/Errors";
import type { SessionId, StoryState } from "@/core/Story";

/**
 * One storyline per session. There is deliberately no `clear`: nothing in the app is
 * allowed to wipe every reader's story at once.
 */
export interface StoryStoreService {
  readonly load: (id: SessionId) => Effect.Effect<Option.Option<StoryState>, StoryCorrupt>;
  readonly save: (state: StoryState) => Effect.Effect<void, StoryCorrupt>;
}

/**
 * The persistence port. `providers/RedisStore` is the one backend the app deploys
 * with; `providers/MemoryStore` keeps stories in a map for tests.
 */
export class StoryStore extends Context.Tag("story-effect/StoryStore")<
  StoryStore,
  StoryStoreService
>() {}
