import { KeyValueStore } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, type ConfigError, Duration, Effect, Layer } from "effect";
import { Redis } from "ioredis";
import { layerOver } from "@/core/providers/KeyValueStoryStore";
import {
  caller,
  expirySeconds,
  fromOps,
  keyPrefix,
  redisError,
  type RedisOps,
  ttl,
} from "@/core/providers/RedisKeyValueStore";
import type { StoryStore } from "@/core/StoryStore";

export interface Options {
  readonly url: string;
  readonly ttl: Duration.Duration;
}

/** A Redis on the same machine answers in microseconds; two seconds means it is gone. */
const commandTimeoutMillis = 2_000;

/** The backstop, a little wider, for a promise the client settles neither way. */
const deadline = Duration.seconds(3);

const scanBatch = 500;

/**
 * ioredis reports a refused connection on the client's `error` event and then fails the
 * queued command with a bare "reached the max retries per request limit", and prints
 * `Unhandled error event` while nothing is listening. One listener fixes both: the
 * operator reads `connect ECONNREFUSED` instead. The client's own status is what keeps a
 * stale connection error away from a real command error.
 */
const explainerFor = (client: Redis): ((cause: unknown) => unknown) => {
  let lastConnectionError: unknown = undefined;
  client.on("error", (error) => {
    lastConnectionError = error;
  });

  return (cause) => {
    if (client.status === "ready") return cause;
    return lastConnectionError ?? cause;
  };
};

const ops = (client: Redis, expiry: number): RedisOps => {
  const call = caller({ deadline, explain: explainerFor(client) });

  const scanFrom = (
    cursor: string,
    found: ReadonlyArray<string>,
  ): Effect.Effect<ReadonlyArray<string>, PlatformError> =>
    call("keys", () => client.scan(cursor, "MATCH", `${keyPrefix}*`, "COUNT", scanBatch)).pipe(
      Effect.flatMap(([next, keys]) => {
        const all = [...found, ...keys];
        if (next === "0") return Effect.succeed(all);
        return scanFrom(next, all);
      }),
    );

  return {
    get: (key) => call("get", () => client.get(key)),
    set: (key, value) => Effect.asVoid(call("set", () => client.setex(key, expiry, value))),
    remove: (key) => Effect.asVoid(call("remove", () => client.del(key))),
    keys: () => scanFrom("0", []),
    removeAll: (keys) => Effect.asVoid(call("removeAll", () => client.del([...keys]))),
  };
};

/**
 * `lazyConnect` keeps the constructor off the network, so building the layer cannot hang
 * and the first command is what dials. The timeouts and the single retry turn "nothing
 * is listening on 6379" into a failed turn with a real message, rather than a command
 * sitting in the offline queue until the request gives up.
 */
export const make = Effect.fn("RedisStore.make")(function* (options: Options) {
  const client = yield* Effect.acquireRelease(
    Effect.try({
      try: () =>
        new Redis(options.url, {
          lazyConnect: true,
          connectTimeout: commandTimeoutMillis,
          commandTimeout: commandTimeoutMillis,
          maxRetriesPerRequest: 1,
        }),
      catch: (cause) => redisError("make", cause),
    }),
    (client) => Effect.sync(() => client.disconnect()),
  );

  return ops(client, expirySeconds(options.ttl));
});

export const layer = (options: Options): Layer.Layer<StoryStore, PlatformError> =>
  layerOver(Layer.scoped(KeyValueStore.KeyValueStore, Effect.map(make(options), fromOps)));

export const layerConfig: Layer.Layer<StoryStore, ConfigError.ConfigError | PlatformError> =
  Layer.unwrapEffect(
    Effect.map(
      Config.all({
        url: Config.string("REDIS_URL").pipe(
          Config.map((value) => value.trim()),
          // Whitespace passes `nonEmptyString`, then fails much later as a socket error.
          Config.validate({ message: "REDIS_URL must not be blank", validation: (v) => v.length > 0 }),
        ),
        ttl,
      }),
      layer,
    ),
  );
