import { Schema } from "effect";
import { moods, type MoodId as CatalogMoodId } from "@/core/data/moods";
import { openingMoodId } from "@/core/data/prologue";
import { assetUrl } from "@/cdn";

/** One entry of the mood catalog. */
export type Mood = (typeof moods)[number];

/** Every mood, in catalog order. */
export const all = moods;

/** Every mood by id. Total over `MoodId`. */
export const byId: Record<CatalogMoodId, Mood> = Object.fromEntries(
  moods.map((mood) => [mood.id, mood]),
) as Record<CatalogMoodId, Mood>;

/** Whether a value names a mood in the catalog. */
export const isMoodId = (value: unknown): value is CatalogMoodId =>
  typeof value === "string" && Object.hasOwn(byId, value);

/** A mood id, validated against the catalog. */
export const MoodId = Schema.String.pipe(Schema.filter(isMoodId, { identifier: "MoodId" }));

/** The literal union of mood ids. Also the name of the loop the client plays. */
export type MoodId = typeof MoodId.Type;

/** The mood a replayed answer falls back to when its id is no longer in the catalog. */
export const fallback: MoodId = openingMoodId;

/** The looping track a mood selects. */
export const trackFor = (id: MoodId): string => assetUrl(`/music/${id}.mp3`);
