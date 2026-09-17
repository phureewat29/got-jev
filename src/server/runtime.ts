import { ManagedRuntime } from "effect";
import { AppLive, type AppServices } from "@/server/AppLive";

/** The app runtime, built once per process. */
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;

const cacheKey: unique symbol = Symbol.for("story-effect/runtime");

interface RuntimeCache {
  [cacheKey]?: AppRuntime;
}

const build = (): AppRuntime => {
  const created = ManagedRuntime.make(AppLive);
  // Best effort: a hard kill skips this, and nothing in the app depends on it running.
  process.once("SIGTERM", () => {
    void created.dispose();
  });
  return created;
};

const cache = globalThis as typeof globalThis & RuntimeCache;

/**
 * One runtime for the whole process, cached on `globalThis`. Next reloads server modules
 * on every edit in development; without the cache each reload would build a fresh Jev
 * client, rate-limit window and daily counter, and leak the old ones.
 */
export const runtime: AppRuntime = (cache[cacheKey] ??= build());
