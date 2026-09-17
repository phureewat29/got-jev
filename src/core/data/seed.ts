/** Seed shapes for the catalogs; `Location.ts`, `Beat.ts` and `Mood.ts` derive their Schemas from them. */

export const regions = [
  "The North",
  "The Wall",
  "Beyond the Wall",
  "Riverlands",
  "The Vale",
  "Iron Islands",
  "Westerlands",
  "Crownlands",
  "Stormlands",
  "The Reach",
  "Dorne",
  "Essos",
  "The Roads",
] as const;

export type Region = (typeof regions)[number];

export interface LocationSeed {
  /** Stable kebab-case id; the literal union of these is `LocationId`. */
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  /** Filename stem of this location's backdrop under `public/scenes/`. */
  readonly background: string;
  /** One line, at most 15 words: what Jev sees as the option description. */
  readonly summary: string;
  /** Lore paragraph for the narrator prompt. */
  readonly description: string;
  /** Aliases a player or the prose might use ("the capital"); empty for most. */
  readonly also_called: readonly string[];
  /** Ids of plausible next places; context for the narrator, never a constraint. */
  readonly adjacent: readonly string[];
  /** Parent location id for city sub-places (the Red Keep sits within King's Landing). */
  readonly within?: string;
}

export interface BeatSeed {
  readonly id: string;
  readonly name: string;
  /** What Jev sees as the option description. */
  readonly definition: string;
  readonly example: string;
  /** Backdrop stem under `public/scenes/`, for the beats that are the scene rather than a thing inside one. */
  readonly background?: string;
}

export interface MoodSeed {
  /** Also the track name: `/music/<id>.mp3`. */
  readonly id: string;
  /** Same-shaped criteria for Jev: what the mood feels like in the prose. */
  readonly feel: string;
  /** Two or three canonical moments from the story. */
  readonly examples: readonly string[];
}
