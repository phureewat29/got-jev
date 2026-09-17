"use client";

import { useEffect, useState } from "react";
import { fetchStory, type Story } from "./api";
import { loadSessionId, newSessionId } from "./session";
import { Chat } from "./Chat";

type State =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly story: Story };

/**
 * Owns the session id and the opening fetch. Each tale is keyed by its session,
 * so beginning a new one remounts the chat, its thread and its music.
 */
export const StoryApp = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => setSessionId(loadSessionId()), []);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchStory(sessionId, controller.signal)
      .then((story) => setState({ status: "ready", story }))
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({ status: "failed" });
      });
    return () => controller.abort();
  }, [sessionId, attempt]);

  if (state.status === "loading") {
    return (
      <main className="app app-centred">
        <p className="notice">The tale is being unrolled…</p>
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
    <main className="app">
      <Chat
        key={state.story.sessionId}
        story={state.story}
        onNewTale={() => setSessionId(newSessionId())}
      />
    </main>
  );
};
