import { Schema } from "effect";
import { moods, type MoodId as CatalogMoodId } from "@/core/data/moods";
import { openingMoodId } from "@/core/data/prologue";
import { assetUrl } from "@/cdn";

export type Mood = (typeof moods)[number];

export const all = moods;

export const byId: Record<CatalogMoodId, Mood> = Object.fromEntries(
  moods.map((mood) => [mood.id, mood]),
) as Record<CatalogMoodId, Mood>;

export const isMoodId = (value: unknown): value is CatalogMoodId =>
  typeof value === "string" && Object.hasOwn(byId, value);

export const MoodId = Schema.String.pipe(Schema.filter(isMoodId, { identifier: "MoodId" }));

export type MoodId = typeof MoodId.Type;

/** The mood a replayed answer falls back to when its id is no longer in the catalog. */
export const fallback: MoodId = openingMoodId;

export const trackFor = (id: MoodId): string => assetUrl(`/music/${id}.mp3`);
