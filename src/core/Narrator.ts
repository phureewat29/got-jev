import { Context, type Effect } from "effect";
import type { NarratorError } from "@/core/Errors";

/** One chat message on the way to the story model. */
export interface Message {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** Writes the next scene from the messages `Prompt.build` produced. */
export interface NarratorService {
  readonly narrate: (
    messages: ReadonlyArray<Message>,
  ) => Effect.Effect<string, NarratorError>;
}

/**
 * The prose port. `providers/OpenRouter` calls the story model over `HttpClient`;
 * `providers/CannedNarrator` returns fixed prose so tests stay offline.
 */
export class Narrator extends Context.Tag("story-effect/Narrator")<Narrator, NarratorService>() {}
