import type {
  ChoiceQuestion,
  EntryType,
  Question,
  Questions,
  ScoreQuestion,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import { Effect, Layer, Option, Schema } from "effect";
import * as Location from "@/core/Location";
import { QuestionModel, type QuestionModelService } from "@/core/QuestionModel";

/**
 * Exact answers for one narration, keyed by question name, in the shape the SDK
 * returns them. Anything a fixture leaves out is answered by the keyword rules.
 */
export type Fixtures = Record<string, Record<string, unknown>>;

/** The scene the rules read: the words of the turn, and where the story stood. */
interface Scene {
  readonly text: string;
  readonly narration: string;
  readonly previous: string | undefined;
}

const battle = /\b(battle|wight|walker|charge|steel|blade|sword|longclaw|blood|kill|strike)\b/;
const travel = /\b(ride|rides|riding|road|sail|sails|march|travel|travels|journey|saddle|horse)\b/;
const outOfFiction = /\b(ai|assistant|language model|model|prompt|instruction|instructions|roleplay)\b/;

/** As much of `Oracle.stateFor` as the rules need; anything else is ignored. */
const CannedState = Schema.Struct({
  story: Schema.Struct({
    previous_position: Schema.Struct({ location: Schema.String }),
  }),
  scene: Schema.Struct({ action: Schema.String, narration: Schema.String }),
});

const decodeState = Schema.decodeUnknownOption(CannedState);

const idOfName = (name: string): string | undefined =>
  Location.all.find((location) => location.name === name)?.id;

const readScene = (state: EntryType): Scene =>
  decodeState(state).pipe(
    Option.map((decoded) => ({
      text: `${decoded.scene.action} ${decoded.scene.narration}`.toLowerCase(),
      narration: decoded.scene.narration,
      previous: idOfName(decoded.story.previous_position.location),
    })),
    Option.getOrElse(() => ({ text: "", narration: "", previous: undefined })),
  );

/** Words of an option label worth looking for; short ones match far too much. */
const significantWords = (label: string): ReadonlyArray<string> =>
  (label.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length >= 4);

const mentions = (text: string, label: string): boolean => {
  const words = significantWords(label);
  if (words.length === 0) return false;
  return words.every((word) => text.includes(word));
};

/** Options that stand in when nothing in the prose picks a side. */
const fallbacks: ReadonlyArray<string> = ["journey", "curious"];

const fallbackFor = (labels: ReadonlyArray<string>, previous: string | undefined): string => {
  if (previous !== undefined && labels.includes(previous)) return previous;
  return fallbacks.find((candidate) => labels.includes(candidate)) ?? labels[0];
};

const choose = (labels: ReadonlyArray<string>, scene: Scene): string => {
  const named = labels.find((label) => mentions(scene.text, label));
  if (named !== undefined) return named;
  if (battle.test(scene.text) && labels.includes("battle")) return "battle";
  return fallbackFor(labels, scene.previous);
};

const dangerFor = (text: string, levels: number): number => {
  if (battle.test(text)) return Math.min(4, levels - 1);
  if (travel.test(text)) return Math.min(1, levels - 1);
  return 0;
};

const choiceAnswer = (question: ChoiceQuestion, scene: Scene) => {
  const chosen = choose(Object.keys(question.criteria), scene);
  return {
    type: "choice",
    choice: chosen,
    confidence: 0.9,
    /** Only the chosen label, the way Jev drops options that round away. */
    probabilities: { [chosen]: 0.9 },
  };
};

const scoreAnswer = (question: ScoreQuestion, scene: Scene) => {
  const level = dangerFor(scene.text, question.criteria.length);
  return {
    type: "score",
    score: level,
    confidence: 0.9,
    legend: Object.fromEntries(
      question.criteria.map((description, index) => [String(index), description]),
    ),
    probabilities: { [String(level)]: 0.9 },
  };
};

const answerFor = (question: Question, scene: Scene): unknown => {
  if (question.type === "noul") return { type: "noul", noul: outOfFiction.test(scene.text) ? 0.08 : 0.96 };
  if (question.type === "score") return scoreAnswer(question, scene);
  return choiceAnswer(question, scene);
};

/**
 * Jev answered from keyword rules over the scene, so the whole engine — including
 * the verify-and-retry path — runs without a network. The result is assembled
 * dynamically and asserted once here; the rules answer whatever questions they are
 * handed, which is why `Oracle.questions` can change without touching this file.
 */
export const make = (fixtures: Fixtures = {}): QuestionModelService => ({
  evaluate: <const Q extends Questions>(state: EntryType, questions: Q) =>
    Effect.sync(() => {
      const scene = readScene(state);
      const ruled = Object.entries(questions).map(
        ([name, question]) => [name, answerFor(question, scene)] as const,
      );
      const answers = { ...Object.fromEntries(ruled), ...fixtures[scene.narration] };
      return {
        model: "canned-jev",
        answers,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as unknown as SystemOneResult<Q>;
    }),
});

/** Jev answered from keyword rules alone. */
export const layer: Layer.Layer<QuestionModel> = Layer.succeed(QuestionModel, make());

/** Jev answered from exact fixtures, falling back to the keyword rules per question. */
export const fromFixtures = (fixtures: Fixtures): Layer.Layer<QuestionModel> =>
  Layer.succeed(QuestionModel, make(fixtures));
