import { Context, type Effect, type Option } from "effect";
import type { StoryCorrupt } from "@/core/Errors";
import type { SessionId, StoryState } from "@/core/Story";

/** There is deliberately no `clear`: nothing may wipe every reader's story at once. */
export interface StoryStoreService {
  readonly load: (id: SessionId) => Effect.Effect<Option.Option<StoryState>, StoryCorrupt>;
  readonly save: (state: StoryState) => Effect.Effect<void, StoryCorrupt>;
}

/** The persistence port: `providers/RedisStore` in deployment, `providers/MemoryStore` in tests. */
export class StoryStore extends Context.Tag("story-effect/StoryStore")<
  StoryStore,
  StoryStoreService
>() {}
