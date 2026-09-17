/**
 * One Jev request in, the next state out.
 *
 * Jev answers five questions about a scene in a single round trip, and hands back
 * four different shapes of evidence: a distribution over seventy places, two
 * literal choices, a fractional score and a probability. This module is where
 * those collapse into the one record the next turn is written from — each field
 * below is a separate way of reading evidence, and nothing here talks to anything.
 *
 * It is pure, total and a function of the answers as they are stored rather than
 * as the SDK returns them, which is what lets a saved turn be re-resolved later
 * without asking the model again.
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
 * A stored choice is a bare string, because a catalog that has moved on must not
 * make an old story unreadable. Narrowing it back costs one guard and gives the
 * rest of the app a literal union again.
 */
const narrowed = <A extends string>(
  answer: { readonly choice: string },
  isMember: (value: unknown) => value is A,
  fallback: A,
): A => (isMember(answer.choice) ? answer.choice : fallback);

/** Jev omits options that round away, so an absent label is zero, not a gap. */
const probabilityOf = (probabilities: Probabilities, label: string): number => {
  const value = probabilities[label];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

/**
 * A place's own probability plus its sub-places'. "You ride through the gates of
 * King's Landing" spreads across the city and the places inside it; folding the
 * children back into the parent is what recovers the city.
 */
const massOf = (probabilities: Probabilities, id: Location.LocationId): number =>
  Location.childrenOf(id).reduce(
    (total, child) => total + probabilityOf(probabilities, child),
    probabilityOf(probabilities, id),
  );

/**
 * The most probable place. Jev's own pick seeds the reduce, so it wins ties and
 * still answers a distribution whose options all rounded away.
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
 * Whether a sub-place is the scene itself or only the loudest street of one: its
 * own mass against everything else its family holds — the parent's, and its
 * siblings'. A majority, not a tuned threshold.
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
 * Where the top place's mass should be counted. A sub-place lends its mass to its
 * parent, and the parent takes the scene unless the sub-place holds most of what
 * the family holds: "you ride through the gates of King's Landing" spreads across
 * the city, the Red Keep and Flea Bottom with no one street the scene, while "the
 * throne room" keeps it.
 */
const foldTarget = (probabilities: Probabilities, top: Location.LocationId): Location.LocationId =>
  Option.match(Location.parentOf(top), {
    onNone: () => top,
    onSome: (parent) => (holdsMost(probabilities, top, parent) ? top : parent),
  });

/**
 * Which place the distribution names. A named place always wins — there is no
 * standing still and nowhere between places to stand — so the only judgment left
 * is how wide to read the answer.
 */
const placed = (answer: StoredChoice): Position.Position =>
  Position.at(foldTarget(answer.probabilities, topPlace(answer)));

/**
 * The fan-out. Five fields, five different readings of the same round trip:
 * a folded distribution, two narrowed choices, a rounded score and a probability.
 * Every one is total, so an answer the catalog no longer recognises degrades to a
 * sensible value instead of throwing.
 */
export const resolve = (answers: StoredAnswers): Decision => ({
  position: placed(answers.location),
  mood: narrowed(answers.mood, Mood.isMoodId, Mood.fallback),
  beat: narrowed(answers.beat, Beat.isBeatId, Beat.fallback),
  danger: Danger.fromScore(answers.danger.score),
  inFiction: answers.inFiction.noul >= inFictionThreshold,
});
