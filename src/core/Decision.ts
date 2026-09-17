import { Option, Schema } from "effect";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import type { StoredAnswers } from "@/core/Question";

/**
 * How much of Jev's probability mass a place needs before the header moves.
 * Weak evidence leaves the story where it was.
 */
export const tauMove = 0.5;

/** Above this, `inFiction` counts as a yes. */
export const inFictionThreshold = 0.5;

/** Everything the location question may answer: the catalog plus `in_transit`. */
export const locationLabels: ReadonlyArray<Location.Whereabouts> = [
  ...Location.all.map((location) => location.id),
  Location.IN_TRANSIT,
];

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

/** Everything `resolve` needs: the answers, where the story was, and which turn this is. */
export interface ResolveInput {
  readonly answers: StoredAnswers;
  readonly previous: Position.Position;
  readonly turnIndex: number;
  /** Overrides `tauMove`, so a saved turn can be replayed under a different policy. */
  readonly tauMove?: number;
}

type Probabilities = Readonly<Record<string, number>>;

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
export const massOf = (probabilities: Probabilities, id: Location.LocationId): number =>
  Location.childrenOf(id).reduce(
    (total, child) => total + probabilityOf(probabilities, child),
    probabilityOf(probabilities, id),
  );

/** The most probable label, ties broken by catalog order. */
const topLabel = (probabilities: Probabilities): Location.Whereabouts =>
  locationLabels.reduce(
    (best, label) =>
      probabilityOf(probabilities, label) > probabilityOf(probabilities, best) ? label : best,
    locationLabels[0],
  );

/** A journey keeps its start turn while it keeps its heading, so the road can grow stale. */
const journeyStart = (
  previous: Position.Position,
  toward: Location.Region,
  turnIndex: number,
): number => {
  if (previous._tag !== "OnRoad") return turnIndex;
  if (previous.toward !== toward) return turnIndex;
  return previous.since;
};

const travelling = (input: ResolveInput): Position.Position => {
  const heading = input.answers.heading.choice;
  const toward = Location.isRegion(heading) ? heading : Location.travelRegion;
  return Position.onRoad({
    from: Position.anchorOf(input.previous),
    toward,
    since: journeyStart(input.previous, toward, input.turnIndex),
  });
};

/**
 * Where the top label's mass should be counted: a sub-place lends its mass to its
 * parent, and a parent counts its own. Folding into the label itself matters for
 * "you ride through the gates of King's Landing", where the city can be the top
 * label while most of the mass sits in the places inside it.
 */
const foldTarget = (label: Location.Whereabouts): Option.Option<Location.LocationId> => {
  if (!Location.isLocationId(label)) return Option.none();
  return Option.orElse(Location.parentOf(label), () => Option.some(label));
};

const positionFor = (input: ResolveInput, tau: number): Position.Position => {
  const probabilities = input.answers.location.probabilities;
  const top = topLabel(probabilities);
  const decisive = probabilityOf(probabilities, top) >= tau;
  if (decisive && top === Location.IN_TRANSIT) return travelling(input);
  if (decisive && Location.isLocationId(top)) return Position.at(top);
  const folded = foldTarget(top);
  if (Option.isNone(folded)) return input.previous;
  if (massOf(probabilities, folded.value) < tau) return input.previous;
  return Position.at(folded.value);
};

/**
 * Turn one request's answers into the next state. Pure, probabilities only, and
 * total: an id the catalog no longer knows falls back rather than throwing, so
 * turns saved under an older catalog still replay.
 */
export const resolve = (input: ResolveInput): Decision => ({
  position: positionFor(input, input.tauMove ?? tauMove),
  mood: Mood.isMoodId(input.answers.mood.choice) ? input.answers.mood.choice : Mood.fallback,
  beat: Beat.isBeatId(input.answers.beat.choice) ? input.answers.beat.choice : Beat.fallback,
  danger: Danger.fromScore(input.answers.danger.score),
  inFiction: input.answers.inFiction.noul >= inFictionThreshold,
});
