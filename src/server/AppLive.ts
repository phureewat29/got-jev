import { FetchHttpClient } from "@effect/platform";
import { Config, Layer } from "effect";
import * as Budget from "@/core/Budget";
import * as OpenRouter from "@/core/providers/OpenRouter";
import * as RedisStore from "@/core/providers/RedisStore";
import * as TypeSafe from "@/core/providers/TypeSafe";
import * as Rules from "@/core/Rules";
import * as RateLimiter from "@/server/RateLimiter";

/** Per-attempt timeout for a Jev request, in milliseconds. */
const typeSafeTimeout = Config.integer("TYPESAFE_TIMEOUT_MS").pipe(Config.withDefault(10_000));

/**
 * The whole application, assembled once.
 *
 * Every provider takes its options as `Config`, so the environment is read once, at the
 * edge of the app. The store reads its own names because which names are present is
 * `Layer.orDie` at the end is
 * what makes the runtime's error channel `never`: a missing key or an unusable Redis
 * URL is a boot failure, not a request failure, and `src/instrumentation.ts` is what
 * turns that into a loud start-up crash.
 */
export const AppLive = Layer.mergeAll(
  TypeSafe.layerConfig({
    apiKey: Config.redacted("TYPESAFE_API_KEY"),
    model: Config.string("TYPESAFE_MODEL").pipe(Config.withDefault("jev-latest")),
    timeoutMillis: typeSafeTimeout,
  }),
  OpenRouter.layerConfig({
    apiKey: Config.redacted("OPENROUTER_API_KEY"),
    model: Config.string("OPENROUTER_MODEL").pipe(Config.withDefault("openai/gpt-5.6-luna")),
  }),
  RedisStore.layerConfig,
  Budget.layerConfig({
    maxTurnsPerDay: Config.integer("MAX_TURNS_PER_DAY").pipe(Config.withDefault(500)),
  }),
  Rules.layerConfig({
    maxTurns: Config.integer("MAX_TURNS").pipe(Config.withDefault(15)),
  }),
  RateLimiter.layerConfig,
).pipe(Layer.provide(FetchHttpClient.layer), Layer.orDie);

/** Everything a Route Handler may ask for. */
export type AppServices = Layer.Layer.Success<typeof AppLive>;
