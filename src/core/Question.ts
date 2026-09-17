import type { ChoiceResponse, NoulResponse, ScoreResponse } from "@typesafe-ai/sdk";
import { Schema } from "effect";

export { choice, noul, score } from "@typesafe-ai/sdk";

/**
 * A stored choice answer. `probabilities` is deliberately string-keyed: Jev omits
 * options that round away, so a literal-keyed record would fail to decode the very
 * files this schema exists to read back.
 */
export const StoredChoice = Schema.Struct({
  choice: Schema.String,
  confidence: Schema.Number,
  probabilities: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

/** A stored score answer; `probabilities` is keyed by the rubric index as a string. */
export const StoredScore = Schema.Struct({
  score: Schema.Number,
  confidence: Schema.Number,
  probabilities: Schema.Record({ key: Schema.String, value: Schema.Number }),
});

/** A stored yes/no answer. */
export const StoredNoul = Schema.Struct({
  noul: Schema.Number,
});

/**
 * Jev's answers as they are written to disk. The keys mirror `Oracle.questions`;
 * the values are looser than the SDK's literal types so that saved turns stay
 * readable when the catalogs move on. `Decision.resolve` reads this shape, which
 * is what makes policy replay over old turns possible.
 */
export const StoredAnswers = Schema.Struct({
  location: StoredChoice,
  heading: StoredChoice,
  beat: StoredChoice,
  mood: StoredChoice,
  danger: StoredScore,
  inFiction: StoredNoul,
});

/** Jev's answers as they are written to disk. */
export type StoredAnswers = typeof StoredAnswers.Type;

/**
 * The structural shape `toStored` accepts. `Oracle.Answers` satisfies it while
 * keeping its literal `choice` unions at the call site.
 */
export interface AnswersLike {
  readonly location: ChoiceResponse;
  readonly heading: ChoiceResponse;
  readonly beat: ChoiceResponse;
  readonly mood: ChoiceResponse;
  readonly danger: ScoreResponse;
  readonly inFiction: NoulResponse;
}

const storedChoice = (answer: ChoiceResponse): typeof StoredChoice.Type => ({
  choice: answer.choice,
  confidence: answer.confidence,
  probabilities: { ...answer.probabilities },
});

/** Widen one request's typed answers into the shape that is persisted and replayed. */
export const toStored = (answers: AnswersLike): StoredAnswers => ({
  location: storedChoice(answers.location),
  heading: storedChoice(answers.heading),
  beat: storedChoice(answers.beat),
  mood: storedChoice(answers.mood),
  danger: {
    score: answers.danger.score,
    confidence: answers.danger.confidence,
    probabilities: { ...answers.danger.probabilities },
  },
  inFiction: { noul: answers.inFiction.noul },
});
