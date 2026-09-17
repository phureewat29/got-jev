"use client";

import { useEffect, useState } from "react";
import { fetchStory, type Story, trackFor } from "./api";
import { loadSessionId, newSessionId } from "./session";
import { awaitFirstScene } from "./prefetch";
import { Chat } from "./Chat";
import { Splash } from "./Splash";

type State =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  /** Assets are in; the tale waits on the press that also frees the music. */
  | { readonly status: "waiting"; readonly story: Story }
  /** The press has landed and the splash is lifting away. */
  | { readonly status: "leaving"; readonly story: Story }
  | { readonly status: "ready"; readonly story: Story };

/** Matches `splash-leave` in `globals.css`; the scene is mounted as the splash clears. */
const leaveMillis = 420;

const motionIsReduced = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Owns the session id and the opening fetch. A new tale remounts the chat, keyed by session. */
export const StoryApp = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => setSessionId(loadSessionId()), []);

  /**
   * Waiting out the splash's exit on a timer rather than on `animationend`, which
   * never fires when reduced motion has switched the animation off and would leave
   * the reader holding a screen that will not open.
   */
  useEffect(() => {
    if (state.status !== "leaving") return;
    const { story } = state;
    const timer = window.setTimeout(
      () => setState({ status: "ready", story }),
      motionIsReduced() ? 0 : leaveMillis,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchStory(sessionId, controller.signal)
      .then(async (story) => {
        await awaitFirstScene(story.position.background, trackFor(story.mood), controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: "waiting", story });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({ status: "failed" });
      });
    return () => controller.abort();
  }, [sessionId, attempt]);

  if (state.status !== "ready" && state.status !== "failed") {
    return (
      <main className="app app-centred">
        <Splash
          ready={state.status !== "loading"}
          leaving={state.status === "leaving"}
          onEnter={() => {
            if (state.status !== "waiting") return;
            setState({ status: "leaving", story: state.story });
          }}
        />
      </main>
    );
  }

  if (state.status === "failed") {
    return (
      <main className="app app-centred">
        <p className="notice">The ravens have not returned.</p>
        <button type="button" className="button" onClick={() => setAttempt((n) => n + 1)}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="app app-enter">
      <Chat
        key={state.story.sessionId}
        story={state.story}
        onNewTale={() => setSessionId(newSessionId())}
      />
    </main>
  );
};
