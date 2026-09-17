import type { EntryType, Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { Context, type Effect } from "effect";
import type { QuestionError } from "@/core/Errors";

/** One labelling request: shared state in, one typed answer per question out. */
export interface QuestionModelService {
  readonly evaluate: <const Q extends Questions>(
    state: EntryType,
    questions: Q,
  ) => Effect.Effect<SystemOneResult<Q>, QuestionError>;
}

/**
 * The typed-judgement port. `providers/TypeSafe` talks to Jev; `providers/CannedJev`
 * answers from keyword rules so the engine can be tested without a network.
 */
export class QuestionModel extends Context.Tag("story-effect/QuestionModel")<
  QuestionModel,
  QuestionModelService
>() {}
