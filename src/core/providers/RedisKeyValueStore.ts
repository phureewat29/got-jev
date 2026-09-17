import { KeyValueStore } from "@effect/platform";
import { type PlatformError, SystemError } from "@effect/platform/Error";
import { Config, Duration, Effect, Option } from "effect";
import { describeCause } from "@/core/Errors";

/**
 * The five commands a story store needs from Redis, so nothing above this interface
 * depends on a particular client. Namespacing, expiry, encoding and error mapping are
 * shared here rather than written per client.
 */
export interface RedisOps {
  readonly get: (key: string) => Effect.Effect<string | null, PlatformError>;
  readonly set: (key: string, value: string) => Effect.Effect<void, PlatformError>;
  readonly remove: (key: string) => Effect.Effect<void, PlatformError>;
  /** This app's keys, already narrowed to `keyPrefix`, never the whole database. */
  readonly keys: () => Effect.Effect<ReadonlyArray<string>, PlatformError>;
  readonly removeAll: (keys: ReadonlyArray<string>) => Effect.Effect<void, PlatformError>;
}

/**
 * Every key this app writes starts here, so `clear` and `size` stay honest on a Redis
 * shared with something else. Nothing in the app issues `FLUSHDB`.
 */
export const keyPrefix = "story:";

/** How long an untouched story lives, so an abandoned session expires on its own. */
export const ttl: Config.Config<Duration.Duration> = Config.integer("STORY_TTL_DAYS").pipe(
  Config.withDefault(7),
  Config.map(Duration.days),
);

/** A whole number of seconds, which is the only expiry Redis takes. */
export const expirySeconds = (duration: Duration.Duration): number =>
  Math.max(1, Math.ceil(Duration.toSeconds(duration)));

/** A Redis failure in the shape `KeyValueStoryStore` already folds into `StoryCorrupt`. */
export const redisError = (method: string, cause: unknown): PlatformError =>
  new SystemError({
    module: "KeyValueStore",
    method,
    reason: "Unknown",
    description: describeCause(cause),
    cause,
  });

const timedOut = (method: string, deadline: Duration.Duration): PlatformError =>
  new SystemError({
    module: "KeyValueStore",
    method,
    reason: "TimedOut",
    description: `redis ${method} did not answer within ${Duration.format(deadline)}`,
  });

export interface RedisCall {
  <A>(method: string, run: () => Promise<A>): Effect.Effect<A, PlatformError>;
}

/**
 * The client is promise-based and takes no `AbortSignal`, so the deadline is enforced
 * here: a stalled call fails the turn rather than holding a serverless invocation open
 * until the platform kills it. `explain` is a client's chance to swap a generic
 * rejection for the reason it really failed.
 */
export const caller = (options: {
  readonly deadline: Duration.Duration;
  readonly explain?: (cause: unknown) => unknown;
}): RedisCall => {
  const explain = options.explain ?? ((cause: unknown) => cause);

  return (method, run) =>
    Effect.tryPromise({ try: run, catch: (cause) => redisError(method, explain(cause)) }).pipe(
      Effect.timeout(options.deadline),
      Effect.catchTag("TimeoutException", () => Effect.fail(timedOut(method, options.deadline))),
      Effect.withSpan("Redis.call", { attributes: { method } }),
    );
};

/**
 * A `KeyValueStore` over `RedisOps`. All this adds is the namespace and the two
 * whole-store operations `makeStringOnly` asks for, both scoped to this app's keys.
 */
export const fromOps = (ops: RedisOps): KeyValueStore.KeyValueStore =>
  KeyValueStore.makeStringOnly({
    get: (key) => Effect.map(ops.get(keyPrefix + key), Option.fromNullable),
    set: (key, value) => ops.set(keyPrefix + key, value),
    remove: (key) => ops.remove(keyPrefix + key),
    clear: Effect.flatMap(ops.keys(), (keys) =>
      keys.length === 0 ? Effect.void : ops.removeAll(keys),
    ),
    size: Effect.map(ops.keys(), (keys) => keys.length),
  });
