import { Feather } from "lucide-react";

type SplashProps = {
  /** True once the opening scene's artwork and music are in the browser. */
  readonly ready: boolean;
  readonly onEnter: () => void;
};

/**
 * The opening screen, and the reason the music can start at all.
 *
 * A page is not allowed to play audio until the reader has touched it, so a
 * splash that dismisses itself hands the story over with no gesture on record
 * and the bards stay silent until something else is clicked. This screen ends on
 * a deliberate press instead: the same click that opens the tale is the one that
 * frees the sound.
 *
 * While the assets load it is a quill working at a line with the ink running
 * underneath, sharing the duration and easing of the loader inside the thread so
 * the two read as one hand.
 */
export const Splash = ({ ready, onEnter }: SplashProps) => (
  <div className="splash" role="status" aria-live="polite">
    <Feather className="quill" size={20} aria-hidden />
    {ready ? (
      <button type="button" className="button splash-enter" onClick={onEnter} autoFocus>
        Unroll the tale
      </button>
    ) : (
      <>
        <p className="notice">The tale is being unrolled…</p>
        <span className="splash-rule" aria-hidden="true" />
      </>
    )}
  </div>
);
