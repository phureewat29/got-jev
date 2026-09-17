import { Option } from "effect";
import { defaultBackground, regionBackground } from "@/core/data/backgrounds";
import * as Background from "@/core/Background";
import * as Beat from "@/core/Beat";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";

export const runtime = "nodejs";

/**
 * Every backdrop and track the story can reach. The catalogs stay server-side, but the
 * browser needs the list to warm its cache, and the answer is the same for everyone,
 * so it is computed once per process and cached hard at the edge.
 */
const manifest = {
  scenes: [
    ...new Set([
      ...Location.all.map((location) => Background.pathOf(location.background)),
      ...Beat.all.flatMap((beat) => Option.toArray(Beat.stemOf(beat.id)).map(Background.pathOf)),
      ...Object.values(regionBackground).map(Background.pathOf),
      Background.pathOf(defaultBackground),
    ]),
  ],
  music: Mood.all.map((mood) => Mood.trackFor(mood.id)),
};

export const GET = (): Response =>
  Response.json(manifest, {
    headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
