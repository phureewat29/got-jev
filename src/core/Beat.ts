import { Option, Schema } from "effect";
import { beats, type BeatId as CatalogBeatId } from "@/core/data/beats";

/** One entry of the beat catalog. */
export type Beat = (typeof beats)[number];

/** Every beat, in catalog order. */
export const all = beats;

/** Every beat by id. Total over `BeatId`. */
export const byId: Record<CatalogBeatId, Beat> = Object.fromEntries(
  beats.map((beat) => [beat.id, beat]),
) as Record<CatalogBeatId, Beat>;

/** Whether a value names a beat in the catalog. */
export const isBeatId = (value: unknown): value is CatalogBeatId =>
  typeof value === "string" && Object.hasOwn(byId, value);

/** A beat id, validated against the catalog. */
export const BeatId = Schema.String.pipe(Schema.filter(isBeatId, { identifier: "BeatId" }));

/** The literal union of beat ids. */
export type BeatId = typeof BeatId.Type;

/** `"Pitched battle"` — what a beat is called in prose. */
export const nameOf = (id: BeatId): string => byId[id].name;

/** Only some beats carry artwork, so the catalog's optional field is read through a guard. */
const backgroundOf = (beat: Beat): string | undefined =>
  "background" in beat ? beat.background : undefined;

/**
 * The artwork a beat brings with it. A battle, a wedding or a trial is the scene
 * and so has a picture of its own; a journey or a quiet word is what an ordinary
 * turn looks like and leaves the frame to the place, which is the absence here.
 */
export const stemOf = (id: BeatId): Option.Option<string> =>
  Option.fromNullable(backgroundOf(byId[id]));

/** The beat a replayed answer falls back to when its id is no longer in the catalog. */
export const fallback: BeatId = "quiet";
