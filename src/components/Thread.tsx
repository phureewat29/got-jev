import {
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type MessageState,
  type TextMessagePartComponent,
} from "@assistant-ui/react";
import { Loading } from "./Loading";

const Text: TextMessagePartComponent = () => (
  <MessagePartPrimitive.Text className="prose" component="p" smooth={false} />
);

const Failed = () => {
  const incomplete = useAuiState((state) => state.message.status?.type === "incomplete");
  if (!incomplete) return null;
  return <p className="message-failed">The ravens did not return. Try again.</p>;
};

const UserMessage = () => (
  <MessagePrimitive.Root className="message message-user">
    <MessagePrimitive.Parts components={{ Text }} />
  </MessagePrimitive.Root>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root className="message message-assistant">
    <MessagePrimitive.Parts components={{ Text }} />
    <Failed />
  </MessagePrimitive.Root>
);

// Module scope keeps the render function stable, so the message list memoises.
const renderMessage = ({ message }: { message: MessageState }) =>
  message.role === "user" ? <UserMessage /> : <AssistantMessage />;

/** The page of the book: plain text, no avatars, no actions, no branches. */
export const Thread = () => (
  <ThreadPrimitive.Root className="thread">
    <ThreadPrimitive.Viewport className="viewport">
      <ThreadPrimitive.Messages>{renderMessage}</ThreadPrimitive.Messages>
      <Loading />
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);
