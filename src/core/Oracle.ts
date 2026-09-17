import type { SystemOneResult } from "@typesafe-ai/sdk";
import { Effect, Match } from "effect";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import { choice, noul, score } from "@/core/Question";
import { QuestionModel } from "@/core/QuestionModel";
import * as Story from "@/core/Story";

/**
 * A `location` option as Jev sees it. Every option is the same shape, so the model
 * compares like with like instead of reading fifty-seven differently written blurbs.
 */
type LocationOption = {
  region: string;
  summary: string;
  also_called: string[];
};

/** A `mood` option as Jev sees it: what the scene feels like, with canonical examples. */
type MoodOption = {
  feel: string;
  examples: string[];
};

/** One exchange of the story, as Jev reads it. */
type Scene = {
  readonly action: string;
  readonly narration: string;
};

/** Where the story stood before this scene, in words rather than ids. */
type PreviousPosition =
  | { readonly kind: "at"; readonly location: string; readonly region: string }
  | { readonly kind: "on_road"; readonly from: string; readonly toward: string };

/**
 * The single state every question is asked about. Questions point at it by backticked
 * path — `scene.narration`, `story.previous_position` — so one request answers six
 * questions over one payload.
 */
export type OracleState = {
  readonly story: {
    readonly previous_position: PreviousPosition;
    readonly recent: Array<Scene>;
  };
  readonly scene: Scene;
};

/**
 * Build a criteria record whose keys stay literal. `Object.fromEntries` widens them,
 * and the SDK's `const` generic is what carries the catalog ids into `Answers`.
 */
const criteriaOf = <K extends string, A>(entries: ReadonlyArray<readonly [K, A]>): Record<K, A> =>
  Object.fromEntries(entries) as Record<K, A>;

const describeLocation = (location: Location.Location): LocationOption => ({
  region: location.region,
  summary: location.summary,
  also_called: [...location.also_called],
});

const locationCriteria: Record<Location.Whereabouts, LocationOption> = {
  ...criteriaOf(Location.all.map((location) => [location.id, describeLocation(location)] as const)),
  [Location.IN_TRANSIT]: {
    region: "between regions",
    summary:
      "The scene ends on the road or at sea between named places, no named location reached",
    also_called: ["on the road", "at sea", "between places", "still travelling"],
  },
};

const headingCriteria: Record<Location.Region, null> = criteriaOf(
  Location.allRegions.map((region) => [region, null] as const),
);

const beatCriteria: Record<Beat.BeatId, string> = criteriaOf(
  Beat.all.map((beat) => [beat.id, beat.definition] as const),
);

const moodCriteria: Record<Mood.MoodId, MoodOption> = criteriaOf(
  Mood.all.map(
    (mood) => [mood.id, { feel: mood.feel, examples: [...mood.examples] }] as const,
  ),
);

/**
 * The six questions Jev answers about every scene, in one request.
 *
 * A module constant, not a function: the criteria are literal, so the SDK's `const`
 * generics carry the catalog ids all the way into `Answers` and `byId[choice]` is total.
 * Question names are not sent to the model, so each `instructions` string stands alone.
 */
export const questions = {
  location: choice(
    "Where is Jon Snow at the END of `scene.narration`? Pick the named place the scene leaves him in. " +
      "Use `story.previous_position` as context when the prose does not move him: a scene that only talks, " +
      "fights or reflects leaves him where he already was. Pick `in_transit` only when the scene ends with " +
      "him still travelling and no named place reached.",
    locationCriteria,
  ),
  heading: choice(
    "If `scene.narration` ends with Jon Snow still travelling, which region of the known world is he " +
      "travelling toward? Answer from the direction, the road and the destinations named in the prose. " +
      "Answer this even when the scene ends somewhere settled — it is read only when he is on the road.",
    headingCriteria,
  ),
  beat: choice(
    "What kind of scene is `scene.narration`? Judge the scene as a whole, by what most of it is spent doing, " +
      "not by a single line inside it.",
    beatCriteria,
  ),
  mood: choice(
    "What background music should play under `scene.narration`? Choose the feeling a listener should carry " +
      "through the whole scene, not the feeling of its loudest moment.",
    moodCriteria,
  ),
  danger: score(
    "How much physical danger is Jon Snow in at the END of `scene.narration`? Judge his body, not his " +
      "reputation or his conscience, and judge where the scene leaves him rather than where it began.",
    Danger.criteria,
  ),
  inFiction: noul(
    "Does `scene.narration` stay inside the fiction? It must address Jon in the second person throughout, " +
      "stay inside the world of Westeros, and never break the fourth wall.",
    {
      true: "The prose is second-person narration set in the world, with no aside to the reader and no mention of an AI, an assistant, a model, a player, rules, prompts or instructions",
      false:
        "The prose slips out of the second person, speaks to the reader or the player directly, refuses or comments on the request, or mentions an AI, an assistant, a model, rules, prompts or instructions",
    },
  ),
};

/** Every answer of one turn, with the catalog ids carried through as literal types. */
export type Answers = SystemOneResult<typeof questions>["answers"];

const previousPosition: (position: Position.Position) => PreviousPosition = Match.type<
  Position.Position
>().pipe(
  Match.tag("At", (position) => ({
    kind: "at" as const,
    location: Location.nameOf(position.location),
    region: Location.byId[position.location].region,
  })),
  Match.tag("OnRoad", (position) => ({
    kind: "on_road" as const,
    from: Location.nameOf(position.from),
    toward: position.toward,
  })),
  Match.exhaustive,
);

/** How many earlier turns Jev is shown for continuity. */
export const recentTurnCount = 3;

/**
 * Build the state the six questions are asked about: where the story stood, the last
 * three exchanges, and the scene that was just written.
 */
export const stateFor = (state: Story.StoryState, action: string, narration: string): OracleState => ({
  story: {
    previous_position: previousPosition(state.position),
    recent: Story.recentTurns(state, recentTurnCount).map((turn) => ({
      action: turn.action,
      narration: turn.narration,
    })),
  },
  scene: { action, narration },
});

/** Label one scene: a single Jev request answering all six questions in parallel. */
export const judge = Effect.fn("Oracle.judge")(function* (state: OracleState) {
  const model = yield* QuestionModel;
  const result = yield* model.evaluate(state, questions);
  yield* Effect.annotateCurrentSpan("jev.input_tokens", result.usage.input_tokens);
  return result.answers;
});
