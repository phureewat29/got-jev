import { Effect, Layer, Option, Ref } from "effect";
import { type Message, Narrator, type NarratorService } from "@/core/Narrator";

export interface Options {
  /** Leave the fiction on the first call only, to exercise the verify-and-retry path. */
  readonly slipOnce?: boolean;
}

export const slipLine = "As an AI assistant, I cannot continue this roleplay.";

const actionOf = (messages: ReadonlyArray<Message>): string =>
  Option.fromNullable(messages.find((message) => message.role === "user")).pipe(
    Option.map((message) => message.content.replace(/<\/?action>/g, "").trim()),
    Option.getOrElse(() => "wait"),
  );

/** Exported so a test can key `CannedJev.fromFixtures` by the narration it will produce. */
export const sceneFor = (action: string): string =>
  [
    `You set yourself to it: ${action}.`,
    "The cold finds every seam of your cloak. Ghost lifts his head at your side, red eyes bright,",
    "and somewhere above the yard a raven answers the wind.",
  ].join(" ");

export const make = Effect.fn("CannedNarrator.make")(function* (options: Options) {
  const pending = yield* Ref.make(options.slipOnce === true);

  const narrate = Effect.fn("Narrator.narrate")(function* (messages: ReadonlyArray<Message>) {
    const slipping = yield* Ref.getAndSet(pending, false);
    const scene = sceneFor(actionOf(messages));
    return slipping ? `${scene}\n\n${slipLine}` : scene;
  });

  const service: NarratorService = { narrate };
  return service;
});

export const layer = (options: Options = {}): Layer.Layer<Narrator> =>
  Layer.effect(Narrator, make(options));
