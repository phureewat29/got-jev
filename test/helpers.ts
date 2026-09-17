import { Schema } from "effect";
import type { Decision } from "@/core/Decision";
import * as Position from "@/core/Position";
import type { StoredAnswers } from "@/core/Question";
import { SessionId, type Turn } from "@/core/Story";

/** A fixed session id, so a failing test names the same file every time. */
export const sessionId = Schema.decodeSync(SessionId)("2f6a9c1e-6d7b-4d0e-9d2a-7f2c8b1a4e55");

/** Stored answers with only the fields a test cares about spelled out. */
export const storedAnswers = (options: {
  readonly location?: Record<string, number>;
  /** Jev's own pick, when a test wants it to disagree with the distribution. */
  readonly choice?: string;
  readonly beat?: string;
  readonly mood?: string;
  readonly danger?: number;
  readonly inFiction?: number;
}): StoredAnswers => ({
  location: {
    choice: options.choice ?? Object.keys(options.location ?? {})[0] ?? "castle-black",
    confidence: 0.8,
    probabilities: options.location ?? {},
  },
  beat: {
    choice: options.beat ?? "journey",
    confidence: 0.8,
    probabilities: { [options.beat ?? "journey"]: 0.8 },
  },
  mood: {
    choice: options.mood ?? "calm",
    confidence: 0.8,
    probabilities: { [options.mood ?? "calm"]: 0.8 },
  },
  danger: {
    score: options.danger ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.danger ?? 0)]: 0.8 },
  },
  inFiction: { noul: options.inFiction ?? 0.95 },
});

/** A decision with sensible defaults, for building saved turns. */
export const decision = (overrides: Partial<Decision> = {}): Decision => ({
  position: Position.at("castle-black"),
  mood: "calm",
  beat: "journey",
  danger: "safe",
  inFiction: true,
  ...overrides,
});

/** A saved turn, for states a test wants to start part-way through. */
export const playedTurn = (overrides: Partial<Turn> = {}): Turn => ({
  action: "I keep the watch.",
  narration: "You keep the watch, and the cold keeps you.",
  answers: storedAnswers({}),
  decision: decision(),
  at: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
