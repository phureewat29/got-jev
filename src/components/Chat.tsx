import { useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { Story, StoryMessage } from "./api";
import { createStoryAdapter } from "./runtime";
import { usePrefetch } from "./prefetch";
import { Composer } from "./Composer";
import { Ended } from "./Ended";
import { Header } from "./Header";
import { MusicPlayer } from "./MusicPlayer";
import { RestartButton } from "./RestartButton";
import { SceneBackground } from "./SceneBackground";
import { Thread } from "./Thread";

type ChatProps = {
  readonly story: Story;
  readonly onNewTale: () => void;
};

type Progress = {
  readonly turn: number;
  readonly total: number;
  readonly ended: boolean;
};

const progressOf = (turn: number, turnsRemaining: number, ended: boolean): Progress => ({
  turn,
  total: turn + turnsRemaining,
  ended,
});

const toThreadMessage = (message: StoryMessage): ThreadMessageLike => {
  if (message.role === "user") {
    return { id: message.id, role: "user", content: [{ type: "text", text: message.text }] };
  }
  return {
    id: message.id,
    role: "assistant",
    content: [{ type: "text", text: message.text }],
    metadata: {
      custom: {
        position: message.position,
        mood: message.mood,
        beat: message.beat,
        danger: message.danger,
      },
    },
  };
};

/**
 * The turn count lives in a ref so the adapter always posts the number the last
 * response gave it, and in state so the header re-renders.
 */
export const Chat = ({ story, onNewTale }: ChatProps) => {
  const [progress, setProgress] = useState<Progress>(
    progressOf(story.turn, story.turnsRemaining, story.ended),
  );
  const [started, setStarted] = useState(false);
  const turnRef = useRef(story.turn);

  const initialMessages = useMemo(() => story.messages.map(toThreadMessage), [story.messages]);

  const adapter = useMemo(
    () =>
      createStoryAdapter({
        sessionId: story.sessionId,
        readTurn: () => turnRef.current,
        onTurn: (result) => {
          turnRef.current = result.turn;
          setProgress(progressOf(result.turn, result.turnsRemaining, result.ended));
        },
        onEnded: () => setProgress((current) => ({ ...current, ended: true })),
        onResync: (fresh) => {
          turnRef.current = fresh.turn;
          setProgress(progressOf(fresh.turn, fresh.turnsRemaining, fresh.ended));
        },
      }),
    [story.sessionId],
  );

  const runtime = useLocalRuntime(adapter, { initialMessages });

  // The opening scene is already on screen by the time this mounts, so warm the rest.
  usePrefetch(true);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SceneBackground fallback={story.position} />
      <Header
        turn={progress.turn}
        total={progress.total}
        positionFallback={story.position}
        moodFallback={story.mood}
      />
      <section className="chatbox">
        <Thread />
        {progress.ended ? (
          <Ended onNewTale={onNewTale} />
        ) : (
          <Composer onSend={() => setStarted(true)} />
        )}
      </section>
      <div className="controls">
        <RestartButton onRestart={onNewTale} />
        <MusicPlayer fallback={story.mood} started={started} />
      </div>
    </AssistantRuntimeProvider>
  );
};
