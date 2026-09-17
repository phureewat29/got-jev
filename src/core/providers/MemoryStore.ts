import { KeyValueStore } from "@effect/platform";
import type { Layer } from "effect";
import type { StoryStore } from "@/core/StoryStore";
import { layerOver } from "@/core/providers/KeyValueStoryStore";

/**
 * Stories in a map, encoded through the same Schema the Redis store uses — so a test
 * that passes here would round-trip through Redis too.
 */
export const layer: Layer.Layer<StoryStore> = layerOver(KeyValueStore.layerMemory);
