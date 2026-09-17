import { useEffect, useState } from "react";
import { AuiIf } from "@assistant-ui/react";
import { Feather } from "lucide-react";

const LINES = [
  "The ravens are flying…",
  "Winter is coming…",
  "The maesters consult their scrolls…",
  "The Old Gods are listening…",
  "A raven beats north through the snow…",
] as const;

const ROTATE_MS = 2500;

const Waiting = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % LINES.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="loading" role="status" aria-live="polite">
      <Feather className="quill" size={17} aria-hidden />
      <span className="loading-line">{LINES[index]}</span>
    </div>
  );
};

/** Shown inside the thread while a turn is in flight. */
export const Loading = () => (
  <AuiIf condition={(state) => state.thread.isRunning}>
    <Waiting />
  </AuiIf>
);
