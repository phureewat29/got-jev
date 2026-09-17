import { Clock, Config, type ConfigError, Context, Effect, HashMap, Layer, Option, Ref } from "effect";
import { RateLimited } from "@/core/Errors";

/** Sliding windows per caller, so one browser cannot spend the whole demo's budget. */
export interface RateLimiterService {
  /** Admit one turn for this caller, or fail with the seconds they should wait. */
  readonly check: (key: string) => Effect.Effect<void, RateLimited>;
}

/** The public-demo guard in front of `POST`. */
export class RateLimiter extends Context.Tag("story-effect/RateLimiter")<
  RateLimiter,
  RateLimiterService
>() {}

export interface Tier {
  readonly limit: number;
  readonly windowMillis: number;
}

/**
 * The burst window stops a script hammering the endpoint. The daily window stops one
 * visitor draining the whole demo's budget, which the per-session cap cannot do:
 * starting a new tale mints a new session id, so only the caller is durable.
 */
export interface Options {
  readonly burst: Tier;
  readonly daily: Tier;
}

const day = 24 * 60 * 60_000;

/** Ten turns a minute is faster than anyone reads; sixty a day is four full tales. */
export const defaults: Options = {
  burst: { limit: 10, windowMillis: 60_000 },
  daily: { limit: 60, windowMillis: day },
};

/** Above this many tracked callers, stale entries are swept before the next admission. */
const sweepAbove = 1024;

type Windows = HashMap.HashMap<string, ReadonlyArray<number>>;

interface State {
  readonly burst: Windows;
  readonly daily: Windows;
}

const empty: State = { burst: HashMap.empty(), daily: HashMap.empty() };

const sweep = (windows: Windows, cutoff: number): Windows => {
  if (HashMap.size(windows) <= sweepAbove) return windows;
  return HashMap.filter(windows, (hits) => hits.some((hit) => hit > cutoff));
};

const recentOf = (windows: Windows, key: string, cutoff: number): ReadonlyArray<number> =>
  HashMap.get(windows, key).pipe(
    Option.getOrElse((): ReadonlyArray<number> => []),
    (hits) => hits.filter((hit) => hit > cutoff),
  );

/** How long until the oldest hit in a full window falls out of it. */
const waitFor = (recent: ReadonlyArray<number>, cutoff: number): number =>
  Math.max(1, Math.ceil(((recent[0] ?? cutoff) - cutoff) / 1000));

/**
 * Pure, and returns the next state, so the whole decision is one atomic `Ref.modify`.
 * Both tiers are judged before either records a hit: admitting into the burst window
 * and then refusing on the daily one would charge the caller for a turn they never got.
 */
const admit = (
  state: State,
  key: string,
  now: number,
  options: Options,
): readonly [Option.Option<number>, State] => {
  const burstCutoff = now - options.burst.windowMillis;
  const dailyCutoff = now - options.daily.windowMillis;
  const burstWindows = sweep(state.burst, burstCutoff);
  const dailyWindows = sweep(state.daily, dailyCutoff);
  const burstRecent = recentOf(burstWindows, key, burstCutoff);
  const dailyRecent = recentOf(dailyWindows, key, dailyCutoff);

  /** Trimmed but uncharged, so a refusal still drops expired hits. */
  const trimmed: State = {
    burst: HashMap.set(burstWindows, key, burstRecent),
    daily: HashMap.set(dailyWindows, key, dailyRecent),
  };

  if (burstRecent.length >= options.burst.limit) {
    return [Option.some(waitFor(burstRecent, burstCutoff)), trimmed];
  }
  if (dailyRecent.length >= options.daily.limit) {
    return [Option.some(waitFor(dailyRecent, dailyCutoff)), trimmed];
  }

  return [
    Option.none(),
    {
      burst: HashMap.set(burstWindows, key, [...burstRecent, now]),
      daily: HashMap.set(dailyWindows, key, [...dailyRecent, now]),
    },
  ];
};

/** One `Ref` of timestamps per tier per caller, held in this process alone. */
export const make = Effect.fn("RateLimiter.make")(function* (options: Options = defaults) {
  const state = yield* Ref.make<State>(empty);

  const check = Effect.fn("RateLimiter.check")(function* (key: string) {
    const now = yield* Clock.currentTimeMillis;
    const wait = yield* Ref.modify(state, (current) => admit(current, key, now, options));
    if (Option.isNone(wait)) return;
    return yield* new RateLimited({ retryAfterSeconds: wait.value });
  });

  const service: RateLimiterService = { check };
  return service;
});

export const layer = (options: Options = defaults): Layer.Layer<RateLimiter> =>
  Layer.effect(RateLimiter, make(options));

/** The limiter with its two ceilings read from configuration. */
export const layerConfig: Layer.Layer<RateLimiter, ConfigError.ConfigError> = Layer.effect(
  RateLimiter,
  Effect.flatMap(
    Config.all({
      burstLimit: Config.integer("MAX_TURNS_PER_MINUTE").pipe(
        Config.withDefault(defaults.burst.limit),
      ),
      dailyLimit: Config.integer("MAX_TURNS_PER_IP_PER_DAY").pipe(
        Config.withDefault(defaults.daily.limit),
      ),
    }),
    ({ burstLimit, dailyLimit }) =>
      make({
        burst: { limit: burstLimit, windowMillis: defaults.burst.windowMillis },
        daily: { limit: dailyLimit, windowMillis: defaults.daily.windowMillis },
      }),
  ),
);

/**
 * The first `x-forwarded-for` hop. Run locally there is no such header, so everyone
 * shares one window.
 */
export const callerOf = (headers: Headers): string =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
