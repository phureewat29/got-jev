import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
import { Config, type ConfigError, Duration, Effect, Layer, type Redacted, Schedule, Schema } from "effect";
import { describeCause, NarratorError } from "@/core/Errors";
import { type Message, Narrator, type NarratorService } from "@/core/Narrator";

export interface Options {
  readonly apiKey: Redacted.Redacted<string>;
  readonly model: string;
}

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

/** How long one scene may take before the turn is abandoned. */
const deadline = Duration.seconds(45);

/** Just enough of OpenRouter's response to lift the prose out of it. Excess keys decode fine. */
const Completion = Schema.Struct({
  choices: Schema.NonEmptyArray(
    Schema.Struct({
      message: Schema.Struct({ content: Schema.String }),
    }),
  ),
});

const toNarratorError = (cause: unknown): NarratorError =>
  cause instanceof NarratorError ? cause : new NarratorError({ message: describeCause(cause) });

/**
 * The live `Narrator`. Status filtering and transient retries are configured once on the
 * client, and everything that can go wrong downstream folds into one `NarratorError`.
 */
export const make = Effect.fn("OpenRouter.make")(function* (options: Options) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({ times: 2, schedule: Schedule.exponential("300 millis") }),
  );

  const request = (messages: ReadonlyArray<Message>) =>
    HttpClientRequest.post(endpoint).pipe(
      HttpClientRequest.bearerToken(options.apiKey),
      HttpClientRequest.bodyJson({
        model: options.model,
        messages,
        max_tokens: 500,
        temperature: 0.9,
        reasoning: { effort: "none" },
      }),
    );

  const narrate = Effect.fn("Narrator.narrate")(function* (messages: ReadonlyArray<Message>) {
    const response = yield* client.execute(yield* request(messages));
    const completion = yield* HttpClientResponse.schemaBodyJson(Completion)(response);
    const prose = completion.choices[0].message.content.trim();
    if (prose.length === 0) {
      return yield* new NarratorError({ message: "the narrator returned empty prose" });
    }
    return prose;
  });

  const service: NarratorService = {
    narrate: (messages) =>
      narrate(messages).pipe(Effect.timeout(deadline), Effect.catchAll(toNarratorError)),
  };
  return service;
});

export const layer = (options: Options): Layer.Layer<Narrator, never, HttpClient.HttpClient> =>
  Layer.effect(Narrator, make(options));

export const layerConfig = (
  options: Config.Config.Wrap<Options>,
): Layer.Layer<Narrator, ConfigError.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(Narrator, Effect.flatMap(Config.unwrap(options), make));
