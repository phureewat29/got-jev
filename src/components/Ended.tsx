import { RotateCcw } from "lucide-react";

type EndedProps = {
  readonly onNewTale: () => void;
};

/** Replaces the composer once the fifteenth turn has been narrated. */
export const Ended = ({ onNewTale }: EndedProps) => (
  <div className="ended">
    <p className="ended-line">Your tale ends here — for now.</p>
    <button type="button" className="button" onClick={onNewTale}>
      <RotateCcw size={15} aria-hidden />
      Begin a new tale
    </button>
  </div>
);
