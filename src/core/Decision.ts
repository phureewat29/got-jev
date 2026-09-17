/**
 * Turns one turn's answers into the next state.
 *
 * `Oracle` asks Jev; this reads what came back. The answers arrive as
 * `Question.StoredAnswers`, the persisted widening of the SDK's `ChoiceResponse`,
 * `ScoreResponse` and `NoulResponse`, so nothing here imports the SDK or makes a
 * request.
 *
 * The shape that matters: a choice answer carries `probabilities` over every
 * option the question was given, not just the label it settled on. `placed` reads
 * that distribution, and the fold above it is why.
 *
 * Pure, and a function of the stored answers alone, so a saved turn re-resolves to
 * the decision it was saved with.
 */
import { Option, Schema } from "effect";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import type { StoredAnswers } from "@/core/Question";

/** Above this, `inFiction` counts as a yes. */
export const inFictionThreshold = 0.5;

/** What one turn's answers resolve to: the state the next turn is written from. */
export const Decision = Schema.Struct({
  position: Position.Position,
  mood: Mood.MoodId,
  beat: Beat.BeatId,
  danger: Danger.DangerId,
  inFiction: Schema.Boolean,
});

/** What one turn's answers resolve to. */
export type Decision = typeof Decision.Type;

type Probabilities = Readonly<Record<string, number>>;

/** One stored choice answer, as `Question.StoredAnswers` carries it. */
type StoredChoice = StoredAnswers["location"];

/**
 * A stored `choice` is a bare string, because a catalog that has moved on must not
 * make an old story unreadable. Narrowing it back costs one guard and gives the
 * rest of the app a literal union again.
 */
const narrowed = <A extends string>(
  answer: { readonly choice: string },
  isMember: (value: unknown) => value is A,
  fallback: A,
): A => (isMember(answer.choice) ? answer.choice : fallback);

/** Jev omits options whose probability rounds away, so an absent label is zero. */
const probabilityOf = (probabilities: Probabilities, label: string): number => {
  const value = probabilities[label];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

/** A place's own probability plus every sub-place's. */
const massOf = (probabilities: Probabilities, id: Location.LocationId): number =>
  Location.childrenOf(id).reduce(
    (total, child) => total + probabilityOf(probabilities, child),
    probabilityOf(probabilities, id),
  );

/**
 * The most probable option. Jev's own `choice` seeds the reduce, so it wins ties
 * and still answers when every probability rounded away.
 */
const topPlace = (answer: StoredChoice): Location.LocationId =>
  Location.all.reduce(
    (best, location) =>
      probabilityOf(answer.probabilities, location.id) >
      probabilityOf(answer.probabilities, best)
        ? location.id
        : best,
    narrowed(answer, Location.isLocationId, Location.fallback),
  );

/**
 * Whether a sub-place holds more mass than the rest of its family put together:
 * its parent's own share plus its siblings'. A majority rather than a threshold,
 * so there is no constant to tune.
 */
const holdsMost = (
  probabilities: Probabilities,
  child: Location.LocationId,
  parent: Location.LocationId,
): boolean => {
  const own = probabilityOf(probabilities, child);
  return own >= massOf(probabilities, parent) - own;
};

/**
 * Which option to count the mass at. A sub-place lends its mass to its parent
 * unless it holds most of the family's: "through the gates of King's Landing"
 * spreads over the city, the Red Keep and Flea Bottom and resolves to the city,
 * while "the throne room" at 0.9 keeps the throne room.
 */
const foldTarget = (probabilities: Probabilities, top: Location.LocationId): Location.LocationId =>
  Option.match(Location.parentOf(top), {
    onNone: () => top,
    onSome: (parent) => (holdsMost(probabilities, top, parent) ? top : parent),
  });

/**
 * Reads the `probabilities` rather than the `choice`. A city and the places inside
 * it are separate options, so one scene's mass splits between them and the label
 * Jev picks can be a single street of a city the scene is really about.
 */
const placed = (answer: StoredChoice): Position.Position =>
  Position.at(foldTarget(answer.probabilities, topPlace(answer)));

/**
 * One field per answer, each read its own way: a `choice` distribution folded to a
 * place, two `choice` labels narrowed back to catalog ids, a `score` bucketed
 * against the danger rubric, a `noul` thresholded into a yes. Every read is total,
 * so a turn saved under an older catalog falls back instead of throwing.
 */
export const resolve = (answers: StoredAnswers): Decision => ({
  position: placed(answers.location),
  mood: narrowed(answers.mood, Mood.isMoodId, Mood.fallback),
  beat: narrowed(answers.beat, Beat.isBeatId, Beat.fallback),
  danger: Danger.fromScore(answers.danger.score),
  inFiction: answers.inFiction.noul >= inFictionThreshold,
});
