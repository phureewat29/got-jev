import { KeyValueStore } from "@effect/platform";
import { Effect, Layer, Option } from "effect";
import { describeCause, StoryCorrupt } from "@/core/Errors";
import { type SessionId, StoryState } from "@/core/Story";
import { StoryStore, type StoryStoreService } from "@/core/StoryStore";

/**
 * A `StoryStore` over whatever `KeyValueStore` is in context: one Schema-encoded
 * document per session. The Redis store and the memory store differ only in which
 * backend they hand this.
 */
export const make = Effect.gen(function* () {
  const documents = (yield* KeyValueStore.KeyValueStore).forSchema(StoryState);

  /**
   * A document this code can no longer decode reads as no story at all.
   *
   * The catalogs move — a location is renamed, a question is dropped — and a story
   * saved last week was written against the shape of the code that saved it. Stories
   * are ephemeral here: they carry a TTL and the reader has a button to start again.
   * Handing that reader a fresh opening is a better answer than a 500 about a
   * document they never knew existed.
   *
   * Only a decode failure is forgiven. A backend that cannot be reached still fails,
   * because pretending a reachable store is empty would quietly overwrite a story
   * that is still there.
   */
  const load = Effect.fn("StoryStore.load")((id: SessionId) =>
    documents.get(id).pipe(
      Effect.catchTag("ParseError", (cause) =>
        Effect.logWarning(`story ${id} was written under a shape this build cannot read`).pipe(
          Effect.zipRight(Effect.logDebug(cause.message)),
          Effect.as(Option.none<StoryState>()),
        ),
      ),
      Effect.mapError(
        (cause) => new StoryCorrupt({ sessionId: id, message: describeCause(cause) }),
      ),
    ),
  );

  const save = Effect.fn("StoryStore.save")((state: StoryState) =>
    documents
      .set(state.sessionId, state)
      .pipe(
        Effect.mapError(
          (cause) => new StoryCorrupt({ sessionId: state.sessionId, message: describeCause(cause) }),
        ),
      ),
  );

  const service: StoryStoreService = { load, save };
  return service;
});

/** Wrap a key-value backend as the story store. */
export const layerOver = <E, R>(
  backend: Layer.Layer<KeyValueStore.KeyValueStore, E, R>,
): Layer.Layer<StoryStore, E, R> => Layer.effect(StoryStore, make).pipe(Layer.provide(backend));
