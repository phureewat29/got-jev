import { Feather } from "lucide-react";

/**
 * The opening screen, held until the first scene's artwork and music have
 * arrived.
 *
 * A quill working at a line with the ink running along underneath it, on the same
 * 2400ms as the loader inside the thread so the two read as one hand rather than
 * two widgets. Nothing here reports progress: the wait is a few seconds and a bar
 * that fills to an unknown end is a worse lie than a pen that keeps writing.
 */
export const Splash = () => (
  <div className="splash" role="status" aria-live="polite">
    <Feather className="quill" size={20} aria-hidden />
    <p className="notice">The tale is being unrolled…</p>
    <span className="splash-rule" aria-hidden="true" />
  </div>
);
