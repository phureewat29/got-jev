import { Option, Schema } from "effect";
import { beats, type BeatId as CatalogBeatId } from "@/core/data/beats";

export type Beat = (typeof beats)[number];

export const all = beats;

export const byId: Record<CatalogBeatId, Beat> = Object.fromEntries(
  beats.map((beat) => [beat.id, beat]),
) as Record<CatalogBeatId, Beat>;

export const isBeatId = (value: unknown): value is CatalogBeatId =>
  typeof value === "string" && Object.hasOwn(byId, value);

export const BeatId = Schema.String.pipe(Schema.filter(isBeatId, { identifier: "BeatId" }));

export type BeatId = typeof BeatId.Type;

export const nameOf = (id: BeatId): string => byId[id].name;

/** The catalog is a union and only some entries carry `background`, so it is read through a guard. */
const backgroundOf = (beat: Beat): string | undefined =>
  "background" in beat ? beat.background : undefined;

/** The artwork a beat brings with it. Most beats have none and leave the frame to the place. */
export const stemOf = (id: BeatId): Option.Option<string> =>
  Option.fromNullable(backgroundOf(byId[id]));

/** The beat a replayed answer falls back to when its id is no longer in the catalog. */
export const fallback: BeatId = "quiet";
