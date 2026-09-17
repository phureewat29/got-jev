/**
 * Wire types and fetch helpers for the story API. The shapes mirror the HTTP
 * contract of the Route Handlers; nothing here imports the server core.
 */
import { assetUrl } from "@/cdn";

export const MOODS = [
  "martial", "battle", "tense", "scheming", "ominous", "mystical", "sorrowful",
  "romantic", "calm", "relaxed", "bustling", "curious", "triumphant",
] as const;

export type MoodId = (typeof MOODS)[number];

/**
 * The looping track a mood plays. `Mood.trackFor` says the same thing server-side;
 * `test/wire.test.ts` holds the two together.
 */
export const trackFor = (mood: MoodId): string => assetUrl(`/music/${mood}.mp3`);

export const BEATS = [
  "battle", "duel", "intrigue", "feast", "wedding", "trial", "journey",
  "oath", "siege", "parley", "vision", "stealth", "supernatural", "quiet",
] as const;

export type BeatId = (typeof BEATS)[number];

export const DANGERS = ["safe", "uneasy", "dangerous", "perilous", "deadly"] as const;

export type DangerId = (typeof DANGERS)[number];

export type LocationRef = {
  readonly id: string;
  readonly name: string;
  readonly region: string;
};

/**
 * The backdrop travels with the position, already resolved to a public path by
 * the server, so the browser never carries the location catalog to work it out.
 */
export type Position = {
  readonly location: LocationRef;
  readonly background: string;
};

export type StoryMessage = {
  readonly id: string;
  readonly role: "assistant" | "user";
  readonly text: string;
  readonly position?: Position;
  readonly mood?: MoodId;
  readonly beat?: BeatId;
  readonly danger?: DangerId;
};

export type Story = {
  readonly sessionId: string;
  readonly position: Position;
  readonly mood: MoodId;
  readonly turn: number;
  readonly turnsRemaining: number;
  readonly ended: boolean;
  readonly messages: readonly StoryMessage[];
};

export type TurnResult = {
  readonly position: Position;
  readonly mood: MoodId;
  readonly beat: BeatId;
  readonly danger: DangerId;
  readonly text: string;
  readonly turn: number;
  readonly turnsRemaining: number;
  readonly ended: boolean;
};

/** In-theme wording for every failure the composer can surface. */
export const FAILURES = {
  invalid_request: "That deed cannot be done. Try fewer words.",
  story_ended: "Your tale has already ended.",
  turn_conflict: "The tale moved on without you. Try again.",
  rate_limited: "The ravens are weary. Wait a moment.",
  upstream_failed: "The ravens did not return. Try again.",
  budget_exhausted: "The maesters are out of ink for today.",
  network: "No raven could be found. Try again.",
  unknown: "The ravens did not return. Try again.",
} as const;

export type FailureCode = keyof typeof FAILURES;

export type TurnOutcome =
  | { readonly kind: "ok"; readonly result: TurnResult }
  | { readonly kind: "error"; readonly code: FailureCode };

const isFailureCode = (value: string): value is FailureCode => value in FAILURES;

const failureOf = async (response: Response): Promise<FailureCode> => {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  const code = body?.error;
  if (!code) return "unknown";
  if (!isFailureCode(code)) return "unknown";
  return code;
};

export const fetchStory = async (sessionId: string, signal: AbortSignal): Promise<Story> => {
  const response = await fetch(`/api/story/${sessionId}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`story_unavailable_${response.status}`);
  return (await response.json()) as Story;
};

/**
 * Plays one turn. Transport and status failures come back as an outcome so the
 * adapter can branch on them; an abort is rethrown so the runtime can treat it
 * as a cancellation rather than an error.
 */
export const postTurn = async (
  sessionId: string,
  body: { readonly action: string; readonly turn: number },
  signal: AbortSignal,
): Promise<TurnOutcome> => {
  try {
    const response = await fetch(`/api/story/${sessionId}/turn`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) return { kind: "error", code: await failureOf(response) };
    return { kind: "ok", result: (await response.json()) as TurnResult };
  } catch (cause) {
    if (signal.aborted) throw cause;
    return { kind: "error", code: "network" };
  }
};
