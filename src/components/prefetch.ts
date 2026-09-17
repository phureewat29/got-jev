import { useEffect } from "react";

/**
 * Warms the browser cache with the artwork and music the story might reach, so a
 * scene change is a crossfade rather than a wait.
 *
 * Everything here is deliberately low priority and late: it starts only once the
 * first scene is on screen and the main thread is idle, fetches a few files at a
 * time, and stops the moment the reader navigates away. A Web Worker would buy
 * nothing — `fetch` does not block rendering, and a worker writes to the same HTTP
 * cache the main thread does.
 *
 * The two kinds of asset are not treated alike. The artwork is 93 files but only a
 * few megabytes and any location can come next, so all of it is fetched. The music
 * is thirteen files and most of the weight, so it is fetched only where the connection
 * suggests nobody is paying by the megabyte — the current track always loads on
 * demand regardless, so the worst case is the fade we already had.
 */

type Manifest = { readonly scenes: readonly string[]; readonly music: readonly string[] };

/** Enough parallelism to keep the pipe busy, few enough to stay out of the way. */
const LANES = 4;

type Connection = { readonly saveData?: boolean; readonly effectiveType?: string };

const connection = (): Connection =>
  (navigator as Navigator & { connection?: Connection }).connection ?? {};

/** Whether this reader has signalled, or the network implies, that bytes are costly. */
const bytesAreCheap = (): boolean => {
  const { saveData, effectiveType } = connection();
  if (saveData === true) return false;
  if (effectiveType === undefined) return true;
  return effectiveType === "4g";
};

const idle = (run: () => void): (() => void) => {
  const scheduler = window.requestIdleCallback;
  if (scheduler === undefined) {
    const timer = window.setTimeout(run, 1200);
    return () => window.clearTimeout(timer);
  }
  const handle = scheduler(() => run(), { timeout: 4000 });
  return () => window.cancelIdleCallback(handle);
};

/**
 * Pulls a list through a fixed number of lanes. Failures are swallowed on purpose:
 * this is a cache warm-up, and a missing file must behave exactly as it does today.
 */
const drain = async (urls: readonly string[], signal: AbortSignal): Promise<void> => {
  const queue = [...urls];
  const lane = async (): Promise<void> => {
    for (;;) {
      const url = queue.shift();
      if (url === undefined || signal.aborted) return;
      await fetch(url, { signal, cache: "force-cache", priority: "low" }).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: LANES }, lane));
};

/**
 * Starts warming the cache once `ready` turns true. Runs at most once per mount,
 * and abandons everything in flight on unmount.
 */
export const usePrefetch = (ready: boolean): void => {
  useEffect(() => {
    if (!ready) return;

    const controller = new AbortController();
    const cancelIdle = idle(() => {
      void (async () => {
        const manifest = await fetch("/api/assets", { signal: controller.signal })
          .then((response) => (response.ok ? (response.json() as Promise<Manifest>) : null))
          .catch(() => null);
        if (manifest === null || controller.signal.aborted) return;

        // Artwork first: it is the cheaper half and the one a reader sees change.
        await drain(manifest.scenes, controller.signal);
        if (!bytesAreCheap()) return;
        await drain(manifest.music, controller.signal);
      })();
    });

    return () => {
      cancelIdle();
      controller.abort();
    };
  }, [ready]);
};
