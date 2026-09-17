import { Feather } from "lucide-react";

type SplashProps = {
  /** True once the opening scene's artwork and music are in the browser. */
  readonly ready: boolean;
  /** True while the screen is lifting away and the scene is rising under it. */
  readonly leaving: boolean;
  readonly onEnter: () => void;
};

/**
 * A page may not play audio until the reader has touched it, so this screen ends on
 * a deliberate press: the same click that opens the tale frees the sound. A splash
 * that dismissed itself would hand the story over with no gesture on record, and
 * the bards would stay silent until something else was clicked.
 */
export const Splash = ({ ready, leaving, onEnter }: SplashProps) => (
  <div className={leaving ? "splash is-leaving" : "splash"} role="status" aria-live="polite">
    <Feather className="quill" size={20} aria-hidden />
    {ready ? (
      <button
        type="button"
        className="button splash-enter"
        onClick={onEnter}
        disabled={leaving}
        autoFocus
      >
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
