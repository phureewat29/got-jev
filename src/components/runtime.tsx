import type { ChatModelAdapter, TextMessagePart, ThreadMessage } from "@assistant-ui/react";
import { FAILURES, fetchStory, postTurn, type Story, type TurnResult } from "./api";

type AdapterOptions = {
  readonly sessionId: string;
  /** The number of completed turns the client currently knows. */
  readonly readTurn: () => number;
  readonly onTurn: (result: TurnResult) => void;
  readonly onEnded: () => void;
  readonly onResync: (story: Story) => void;
};

const isText = (part: ThreadMessage["content"][number]): part is TextMessagePart =>
  part.type === "text";

const lastUserAction = (messages: readonly ThreadMessage[]): string => {
  const last = messages.findLast((message) => message.role === "user");
  if (!last) return "";
  return last.content
    .filter(isText)
    .map((part) => part.text)
    .join(" ")
    .trim();
};

/**
 * Turns the composer's last user message into one POST. A turn conflict
 * refreshes the client's idea of the story before failing, so the next attempt
 * carries the right turn number.
 */
export const createStoryAdapter = ({
  sessionId,
  readTurn,
  onTurn,
  onEnded,
  onResync,
}: AdapterOptions): ChatModelAdapter => ({
  run: async ({ messages, abortSignal }) => {
    const action = lastUserAction(messages);
    if (!action) throw new Error(FAILURES.invalid_request);

    const outcome = await postTurn(sessionId, { action, turn: readTurn() }, abortSignal);

    if (outcome.kind === "ok") {
      const { position, mood, beat, danger, text } = outcome.result;
      onTurn(outcome.result);
      return {
        content: [{ type: "text", text }],
        metadata: { custom: { position, mood, beat, danger } },
      };
    }

    if (outcome.code === "story_ended") onEnded();
    if (outcome.code === "turn_conflict") {
      const story = await fetchStory(sessionId, abortSignal).catch(() => null);
      if (story) onResync(story);
    }

    throw new Error(FAILURES[outcome.code]);
  },
});
