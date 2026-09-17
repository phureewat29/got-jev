import { Schema } from "effect";
import * as Location from "@/core/Location";

/**
 * A struct rather than a bare `LocationId` so `StoryState` and `Decision` keep a field
 * that reads as a domain value, and so a later field has somewhere to land.
 */
export const Position = Schema.Struct({
  location: Location.LocationId,
});

export type Position = typeof Position.Type;

export const at = (location: Location.LocationId): Position => ({ location });
