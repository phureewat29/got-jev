import { Schema } from "effect";
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

/** The beat a replayed answer falls back to when its id is no longer in the catalog. */
export const fallback: BeatId = "quiet";
