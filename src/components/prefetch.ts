import { useEffect } from "react";

/**
 * Warms the browser cache with the artwork and music the story might reach.
 *
 * All 93 plates are fetched: any location can come next and they are only a few
 * megabytes between them. The thirteen music files are most of the weight, so they
 * are fetched only where the connection suggests nobody is paying by the megabyte.
 * The current track always loads on demand regardless.
 */

type Manifest = { readonly scenes: readonly string[]; readonly music: readonly string[] };

/**
 * Caps the opening wait: long enough for one plate and one track on an ordinary
 * connection, short enough that a CDN which is down costs a pause rather than the story.
 */
const firstSceneBudgetMs = 6000;

const ignore = (): undefined => undefined;

const artworkReady = (url: string): Promise<void> => {
  const image = new Image();
  image.src = url;
  return image.decode().then(ignore, ignore);
};

/**
 * A `fetch` and not an `<audio>` element: iOS Safari will not load media before a
 * gesture, so waiting on `canplaythrough` would wait out the whole budget there
 * every time.
 */
const trackReady = (url: string, signal: AbortSignal): Promise<void> =>
  fetch(url, { signal, cache: "force-cache" }).then(ignore, ignore);

/** Holds the opening screen until the first backdrop and track arrive, or the budget runs out. */
export const awaitFirstScene = (
  backdrop: string,
  track: string,
  signal: AbortSignal,
): Promise<void> =>
  Promise.race([
    Promise.all([artworkReady(backdrop), trackReady(track, signal)]).then(ignore),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, firstSceneBudgetMs);
    }),
  ]);

/** Four at a time, so the warm-up does not crowd out the page's own requests. */
const LANES = 4;

type Connection = { readonly saveData?: boolean; readonly effectiveType?: string };

const connection = (): Connection =>
  (navigator as Navigator & { connection?: Connection }).connection ?? {};

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
 * Failures are swallowed on purpose: this is a cache warm-up, and a missing file
 * must behave exactly as it does without one.
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
