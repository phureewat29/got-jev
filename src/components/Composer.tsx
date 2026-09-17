import type { FormEvent } from "react";
import { ComposerPrimitive, useAuiState } from "@assistant-ui/react";

const MAX_CHARS = 200;

type ComposerProps = {
  /** Called on the first accepted send, which unlocks audio playback. */
  readonly onSend: () => void;
};

export const Composer = ({ onSend }: ComposerProps) => {
  const length = useAuiState((state) => state.composer.text.trim().length);
  const overflow = length > MAX_CHARS;
  const blocked = overflow || length === 0;

  // Enter reaches the runtime through the form; a blocked submit stops there.
  const guard = (event: FormEvent<HTMLFormElement>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onSend();
  };

  return (
    <ComposerPrimitive.Root className="composer" onSubmit={guard}>
      <ComposerPrimitive.Input
        className="composer-input"
        submitMode="enter"
        placeholder="What do you do?"
        minRows={2}
        maxRows={6}
      />
      <div className="composer-foot">
        <span className={overflow ? "counter counter-over" : "counter"}>
          {length} / {MAX_CHARS}
        </span>
        <ComposerPrimitive.Send className="button" disabled={blocked} onClick={onSend}>
          Send
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};
