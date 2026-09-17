import { Schema } from "effect";

/**
 * The danger rubric, ordered from zero upward. The descriptions are what Jev
 * scores against; the ids are what a decision records.
 */
export const levels = [
  {
    id: "safe",
    description: "Safe: no threat to Jon's body — among friends, or alone somewhere secure.",
  },
  {
    id: "uneasy",
    description:
      "Uneasy: a threat is watching or implied — hostile eyes, foul weather, a standoff that has not broken.",
  },
  {
    id: "dangerous",
    description: "Dangerous: harm is likely if the scene keeps going the way it is going.",
  },
  {
    id: "perilous",
    description: "Perilous: Jon is already fighting, falling, freezing or cornered.",
  },
  {
    id: "deadly",
    description: "Deadly: Jon is a breath from death — outnumbered, wounded, or badly overmatched.",
  },
] as const;

/** The rubric as the SDK wants it: descriptions indexed by score from zero. */
export const criteria = [
  levels[0].description,
  levels[1].description,
  levels[2].description,
  levels[3].description,
  levels[4].description,
] as const;

/** The literal union of danger level ids. */
export type DangerId = (typeof levels)[number]["id"];

const ids: ReadonlyArray<string> = levels.map((level) => level.id);

/** Whether a value names a danger level. */
export const isDangerId = (value: unknown): value is DangerId =>
  typeof value === "string" && ids.includes(value);

/** A danger level id. */
export const DangerId = Schema.String.pipe(Schema.filter(isDangerId, { identifier: "DangerId" }));

/** The level a scene with no danger reading falls back to. */
export const fallback: DangerId = "safe";

/** Round Jev's expected score to the nearest rubric level, clamped to the rubric. */
export const fromScore = (score: number): DangerId => {
  if (!Number.isFinite(score)) return fallback;
  const index = Math.min(levels.length - 1, Math.max(0, Math.round(score)));
  return levels[index].id;
};
