import { useEffect, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { defaultBackdrop, type Position } from "./api";

type Slot = 0 | 1;
type Decks = {
  readonly slot: Slot;
  readonly images: readonly [string | null, string | null];
};

type SceneBackgroundProps = {
  /** Where the story opened, used until Jev has labelled a scene. */
  readonly fallback: Position;
};

/** A scene labelled before backdrops existed carries no artwork, so the guard checks for it. */
const hasBackdrop = (value: unknown): value is Position =>
  typeof value === "object" && value !== null && "background" in value;

const other = (slot: Slot): Slot => (slot === 0 ? 1 : 0);

const layerClass = (slot: Slot, showing: Slot): string =>
  slot === showing ? "backdrop-layer is-showing" : "backdrop-layer";

const paint = (image: string | null): string => (image ? `url("${image}")` : "none");

/**
 * Two stacked layers take turns holding the current scene, so a move is a
 * crossfade. The fade, and its absence under `prefers-reduced-motion`, live in
 * `globals.css`.
 */
export const SceneBackground = ({ fallback }: SceneBackgroundProps) => {
  const backdrop = useAuiState((state) => {
    const labelled = state.thread.messages.findLast((message) =>
      hasBackdrop(message.metadata.custom.position),
    );
    const position = labelled?.metadata.custom.position;
    return hasBackdrop(position) ? position.background : fallback.background;
  });

  const [decks, setDecks] = useState<Decks>({ slot: 0, images: [backdrop, null] });

  /**
   * The swap waits on `decode()` rather than on the request, so the incoming layer
   * is already painted when it starts to rise and the fade cannot show a half-drawn
   * frame.
   *
   * A plate that will not load falls back to the default one. The catalog's chain —
   * place, parent, region, default — runs on the server and only knows which stems
   * are empty; it cannot know that a file is missing from the bucket. Without this
   * arm that case fades up to a bare dark frame.
   */
  useEffect(() => {
    let live = true;
    const preload = new Image();
    preload.src = backdrop;

    const show = (image: string): void => {
      if (!live) return;
      setDecks((current) => {
        if (current.images[current.slot] === image) return current;
        const slot = other(current.slot);
        return {
          slot,
          images: slot === 0 ? [image, current.images[1]] : [current.images[0], image],
        };
      });
    };

    void preload.decode().then(
      () => show(backdrop),
      () => show(defaultBackdrop),
    );
    return () => {
      live = false;
    };
  }, [backdrop]);

  return (
    <div className="backdrop" aria-hidden="true">
      <div
        className={layerClass(0, decks.slot)}
        style={{ backgroundImage: paint(decks.images[0]) }}
      />
      <div
        className={layerClass(1, decks.slot)}
        style={{ backgroundImage: paint(decks.images[1]) }}
      />
      <div className="backdrop-scrim" />
    </div>
  );
};
