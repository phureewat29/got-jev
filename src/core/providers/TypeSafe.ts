import { type EntryType, type Questions, TypeSafeClient } from "@typesafe-ai/sdk";
import { Config, type ConfigError, Duration, Effect, Layer, Redacted } from "effect";
import { describeCause, QuestionError } from "@/core/Errors";
import { QuestionModel, type QuestionModelService } from "@/core/QuestionModel";

export interface Options {
  readonly apiKey: Redacted.Redacted<string>;
  readonly model: string;
  /** Timeout for a single HTTP attempt, in milliseconds; the SDK retries inside it. */
  readonly timeoutMillis: number;
}

/** Retries are left to the SDK, which honours `Retry-After` on a 429. Effect's own would not. */
const maxRetries = 2;

/** Slack over the worst case of every attempt timing out, for backoff between them. */
const backoffAllowance = Duration.seconds(5);

const totalBudget = (timeoutMillis: number): Duration.Duration =>
  Duration.sum(Duration.millis(timeoutMillis * (maxRetries + 1)), backoffAllowance);

/**
 * `Effect.tryPromise` is the edge here because Effect has no module for this SDK. The
 * `AbortSignal` it hands the callback is threaded into `systemOne`, so the outer
 * `Effect.timeout` and any interruption really cancel the request instead of abandoning it.
 */
export const make = Effect.fn("TypeSafe.make")(function* (options: Options) {
  const client = yield* Effect.try({
    try: () =>
      new TypeSafeClient({
        apiKey: Redacted.value(options.apiKey),
        defaultModel: options.model,
        timeout: options.timeoutMillis,
        retry: { maxRetries },
      }),
    catch: (cause) => new QuestionError({ message: describeCause(cause) }),
  });

  const budget = totalBudget(options.timeoutMillis);

  /**
   * Not wrapped in `Effect.fn`: that would erase the `const Q` generic, which is what
   * carries the catalog ids into `Answers`. The span is added by hand instead.
   */
  const evaluate = <const Q extends Questions>(state: EntryType, questions: Q) =>
    Effect.tryPromise({
      try: (signal) => client.systemOne({ state, questions }, { signal }),
      catch: (cause) => new QuestionError({ message: describeCause(cause) }),
    }).pipe(
      Effect.timeout(budget),
      Effect.catchTag(
        "TimeoutException",
        () => new QuestionError({ message: `Jev did not answer within ${Duration.format(budget)}` }),
      ),
      Effect.withSpan("QuestionModel.evaluate", { attributes: { model: options.model } }),
    );

  const service: QuestionModelService = { evaluate };
  return service;
});

export const layer = (options: Options): Layer.Layer<QuestionModel, QuestionError> =>
  Layer.effect(QuestionModel, make(options));

export const layerConfig = (
  options: Config.Config.Wrap<Options>,
): Layer.Layer<QuestionModel, ConfigError.ConfigError | QuestionError> =>
  Layer.effect(QuestionModel, Effect.flatMap(Config.unwrap(options), make));
