import { Effect, TestClock, TestContext } from "effect";
import { describe, expect, it } from "vitest";
import * as RateLimiter from "@/server/RateLimiter";

const day = 24 * 60 * 60_000;

/** A burst tier small enough to fill in a test, under a daily tier that stays open. */
const options: RateLimiter.Options = {
  burst: { limit: 3, windowMillis: 60_000 },
  daily: { limit: 100, windowMillis: day },
};

/** The reverse: the burst window can never refuse, so the daily ceiling is what bites. */
const dailyOptions: RateLimiter.Options = {
  burst: { limit: 1000, windowMillis: 60_000 },
  daily: { limit: 4, windowMillis: day },
};

describe("RateLimiter", () => {
  it("admits up to the limit, then says how long to wait", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiter.make(options);
      yield* Effect.forEach([1, 2, 3], () => limiter.check("10.0.0.1"));
      return yield* Effect.flip(limiter.check("10.0.0.1"));
    });

    const error = await Effect.runPromise(Effect.provide(program, TestContext.TestContext));
    expect(error._tag).toBe("RateLimited");
    expect(error.retryAfterSeconds).toBe(60);
  });

  it("keeps a window per caller", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiter.make(options);
      yield* Effect.forEach([1, 2, 3], () => limiter.check("10.0.0.1"));
      return yield* Effect.exit(limiter.check("10.0.0.2"));
    });

    const exit = await Effect.runPromise(Effect.provide(program, TestContext.TestContext));
    expect(exit._tag).toBe("Success");
  });

  it("lets the window slide", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiter.make(options);
      yield* Effect.forEach([1, 2, 3], () => limiter.check("10.0.0.1"));
      yield* TestClock.adjust("61 seconds");
      return yield* Effect.exit(limiter.check("10.0.0.1"));
    });

    const exit = await Effect.runPromise(Effect.provide(program, TestContext.TestContext));
    expect(exit._tag).toBe("Success");
  });

  it("holds a daily ceiling that restarting a tale cannot escape", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiter.make(dailyOptions);
      // Well past the burst window each time, as a visitor starting new tales would be.
      yield* Effect.forEach([1, 2, 3, 4], () =>
        Effect.zipRight(limiter.check("10.0.0.1"), TestClock.adjust("10 minutes")),
      );
      return yield* Effect.flip(limiter.check("10.0.0.1"));
    });

    const error = await Effect.runPromise(Effect.provide(program, TestContext.TestContext));
    expect(error._tag).toBe("RateLimited");
    // The oldest of the four is forty minutes old, so the day still has to run out.
    expect(error.retryAfterSeconds).toBeGreaterThan(23 * 60 * 60);
  });

  it("releases the daily ceiling once the day has passed", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiter.make(dailyOptions);
      yield* Effect.forEach([1, 2, 3, 4], () => limiter.check("10.0.0.1"));
      yield* TestClock.adjust("25 hours");
      return yield* Effect.exit(limiter.check("10.0.0.1"));
    });

    const exit = await Effect.runPromise(Effect.provide(program, TestContext.TestContext));
    expect(exit._tag).toBe("Success");
  });

  it("charges nothing when the daily ceiling refuses", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiter.make(dailyOptions);
      yield* Effect.forEach([1, 2, 3, 4], () => limiter.check("10.0.0.1"));
      // Three refusals must not consume burst capacity for a caller already at the cap.
      yield* Effect.forEach([1, 2, 3], () => Effect.ignore(limiter.check("10.0.0.1")));
      yield* TestClock.adjust("25 hours");
      return yield* Effect.exit(limiter.check("10.0.0.1"));
    });

    const exit = await Effect.runPromise(Effect.provide(program, TestContext.TestContext));
    expect(exit._tag).toBe("Success");
  });
});

describe("RateLimiter.callerOf", () => {
  it("takes the first forwarded hop, and falls back to one shared window", () => {
    expect(RateLimiter.callerOf(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(RateLimiter.callerOf(new Headers())).toBe("local");
    expect(RateLimiter.callerOf(new Headers({ "x-forwarded-for": "  " }))).toBe("local");
  });
});
