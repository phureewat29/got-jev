import { KeyValueStore } from "@effect/platform";
import { Effect, Layer } from "effect";
import { describeCause, StoryCorrupt } from "@/core/Errors";
import { type SessionId, StoryState } from "@/core/Story";
import { StoryStore, type StoryStoreService } from "@/core/StoryStore";

/**
 * A `StoryStore` over whatever `KeyValueStore` is in context: one Schema-encoded
 * document per session. The file store and the memory store differ only in which
 * backend they hand this.
 */
export const make = Effect.gen(function* () {
  const documents = (yield* KeyValueStore.KeyValueStore).forSchema(StoryState);

  const load = Effect.fn("StoryStore.load")((id: SessionId) =>
    documents
      .get(id)
      .pipe(
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
