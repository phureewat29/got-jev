import { KeyValueStore } from "@effect/platform";
import { type PlatformError, SystemError } from "@effect/platform/Error";
import { Array as Arr, ConfigProvider, Context, Effect, HashMap, Layer, Option, Ref } from "effect";
import { describe, expect, it } from "vitest";
import * as RedisStore from "@/core/providers/RedisStore";
import { layerOver } from "@/core/providers/KeyValueStoryStore";
import { fromOps, keyPrefix, type RedisOps } from "@/core/providers/RedisKeyValueStore";
import * as Story from "@/core/Story";
import { StoryStore } from "@/core/StoryStore";
import { playedTurn, sessionId } from "./helpers";

/** A Redis in a `Ref`: the same five commands, no socket and no container. */
const fakeOps = (ref: Ref.Ref<HashMap.HashMap<string, string>>): RedisOps => ({
  get: (key) => Effect.map(Ref.get(ref), (keys) => Option.getOrNull(HashMap.get(keys, key))),
  set: (key, value) => Ref.update(ref, HashMap.set(key, value)),
  remove: (key) => Ref.update(ref, HashMap.remove(key)),
  keys: () =>
    Effect.map(Ref.get(ref), (keys) =>
      Arr.filter(Arr.fromIterable(HashMap.keys(keys)), (key) => key.startsWith(keyPrefix)),
    ),
  removeAll: (keys) =>
    Ref.update(ref, (map) => Arr.reduce(keys, map, (rest, key) => HashMap.remove(rest, key))),
});

/** A Redis nobody can reach; every command fails the way a dropped socket would. */
const deadOps: RedisOps = {
  get: () => Effect.fail(unreachable("get")),
  set: () => Effect.fail(unreachable("set")),
  remove: () => Effect.fail(unreachable("remove")),
  keys: () => Effect.fail(unreachable("keys")),
  removeAll: () => Effect.fail(unreachable("removeAll")),
};

function unreachable(method: string): SystemError {
  return new SystemError({
    module: "KeyValueStore",
    method,
    reason: "Unknown",
    description: "connect ECONNREFUSED 127.0.0.1:6379",
  });
}

const storeOver = (ops: RedisOps): Layer.Layer<StoryStore> =>
  layerOver(Layer.succeed(KeyValueStore.KeyValueStore, fromOps(ops)));

/** A story with one turn played, so the round-trip carries a real document. */
const saved = Story.appendTurn(
  Story.seed(sessionId, new Date("2026-01-01T00:00:00.000Z")),
  playedTurn(),
  15,
);

const withRedis = <A, E>(
  program: (ref: Ref.Ref<HashMap.HashMap<string, string>>) => Effect.Effect<A, E, StoryStore>,
  seeded: HashMap.HashMap<string, string> = HashMap.empty<string, string>(),
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const ref = yield* Ref.make(seeded);
      return yield* Effect.provide(program(ref), storeOver(fakeOps(ref)));
    }),
  );

describe("StoryStore over Redis", () => {
  it("round-trips a story through the encoded document", async () => {
    const loaded = await withRedis(() =>
      Effect.gen(function* () {
        const store = yield* StoryStore;
        yield* store.save(saved);
        return yield* store.load(sessionId);
      }),
    );

    expect(loaded).toEqual(Option.some(saved));
  });

  it("has nothing for a session that was never saved", async () => {
    const loaded = await withRedis(() => Effect.flatMap(StoryStore, (store) => store.load(sessionId)));

    expect(Option.isNone(loaded)).toBe(true);
  });

  it("namespaces the key it writes", async () => {
    const keys = await withRedis((ref) =>
      Effect.gen(function* () {
        const store = yield* StoryStore;
        yield* store.save(saved);
        return Arr.fromIterable(HashMap.keys(yield* Ref.get(ref)));
      }),
    );

    expect(keys).toEqual([`${keyPrefix}${sessionId}`]);
  });

  it("reads a story written under an older shape as no story at all", async () => {
    /**
     * A real document from before the travelling position and the heading question
     * were removed: it decodes against nothing this build knows how to read.
     */
    const stale = JSON.stringify({
      sessionId,
      position: { _tag: "OnRoad", from: "castle-black", toward: "The North", since: 1 },
      mood: "calm",
      turns: [],
      ended: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const loaded = await withRedis(
      () => Effect.flatMap(StoryStore, (store) => store.load(sessionId)),
      HashMap.make([`${keyPrefix}${sessionId}`, stale]),
    );

    expect(Option.isNone(loaded)).toBe(true);
  });

  it("reports a dead Redis as a corrupt story rather than a defect", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.flatMap(StoryStore, (store) => store.load(sessionId)),
          storeOver(deadOps),
        ),
      ),
    );

    expect(failure._tag).toBe("StoryCorrupt");
    expect(failure.message).toContain("ECONNREFUSED");
  });
});

/** One key this app owns and one it must never touch. */
const withStranger = <A>(
  program: (
    store: KeyValueStore.KeyValueStore,
    ref: Ref.Ref<HashMap.HashMap<string, string>>,
  ) => Effect.Effect<A, PlatformError>,
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const ref = yield* Ref.make<HashMap.HashMap<string, string>>(
        HashMap.make(["rate:1.2.3.4", "9"]),
      );
      const store = fromOps(fakeOps(ref));
      yield* store.set(sessionId, "{}");
      return yield* program(store, ref);
    }),
  );

describe("RedisKeyValueStore.fromOps", () => {
  it("clears this app's keys and leaves a stranger's alone", async () => {
    const remaining = await withStranger((store, ref) =>
      Effect.flatMap(store.clear, () => Ref.get(ref)),
    );

    expect(Arr.fromIterable(HashMap.keys(remaining))).toEqual(["rate:1.2.3.4"]);
  });

  it("counts only this app's keys", async () => {
    const size = await withStranger((store) => store.size);

    expect(size).toBe(1);
  });
});

/** Building the layer costs nothing: `lazyConnect` means no socket is opened. */
const buildStore = (env: ReadonlyArray<readonly [string, string]>) =>
  Effect.scoped(Layer.build(RedisStore.layerConfig)).pipe(
    Effect.withConfigProvider(ConfigProvider.fromMap(new Map(env))),
  );

describe("RedisStore.layerConfig", () => {
  it("refuses to start without REDIS_URL", async () => {
    const failure = await Effect.runPromise(Effect.flip(buildStore([])));

    expect(String(failure)).toContain("REDIS_URL");
  });

  it("refuses a blank REDIS_URL rather than guessing a default", async () => {
    const failure = await Effect.runPromise(Effect.flip(buildStore([["REDIS_URL", "   "]])));

    expect(String(failure)).toContain("REDIS_URL");
  });

  it("builds when REDIS_URL is given", async () => {
    const context = await Effect.runPromise(buildStore([["REDIS_URL", "redis://127.0.0.1:6379"]]));

    expect(Context.get(context, StoryStore)).toBeDefined();
  });
});
