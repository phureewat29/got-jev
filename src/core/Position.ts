import { Schema } from "effect";
import * as Location from "@/core/Location";

/**
 * Where the story stands: the named place Jon is in, and nothing else. Ids only;
 * names are resolved from the catalog.
 *
 * A struct rather than a bare `LocationId` so `StoryState` and `Decision` keep a
 * field that reads as a domain value, and so a later field has somewhere to land.
 */
export const Position = Schema.Struct({
  location: Location.LocationId,
});

/** Where the story stands. */
export type Position = typeof Position.Type;

/** Jon stands in a named place. */
export const at = (location: Location.LocationId): Position => ({ location });
