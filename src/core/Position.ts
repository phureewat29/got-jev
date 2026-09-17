import { Match, Schema } from "effect";
import * as Location from "@/core/Location";

/** Jon stands in a named place. */
export const At = Schema.TaggedStruct("At", {
  location: Location.LocationId,
});

/** Jon is between named places, travelling toward a region. */
export const OnRoad = Schema.TaggedStruct("OnRoad", {
  from: Location.LocationId,
  toward: Location.Region,
  /** The turn the journey started on, so the prompt can push for an arrival. */
  since: Schema.Int,
});

/** Where the story currently stands. Ids only; names are resolved from the catalog. */
export const Position = Schema.Union(At, OnRoad);

/** Where the story currently stands. */
export type Position = typeof Position.Type;

/** Jon stands in a named place. */
export const at = (location: Location.LocationId): Position => At.make({ location });

/** Jon is between named places, travelling toward a region. */
export const onRoad = (options: {
  readonly from: Location.LocationId;
  readonly toward: Location.Region;
  readonly since: number;
}): Position => OnRoad.make(options);

/** The place a journey from here would start: where Jon stands, or where he set out from. */
export const anchorOf: (position: Position) => Location.LocationId = Match.type<Position>().pipe(
  Match.tag("At", (position) => position.location),
  Match.tag("OnRoad", (position) => position.from),
  Match.exhaustive,
);

/** One line of context for the models: where Jon was when the scene opened. */
export const describe: (position: Position) => string = Match.type<Position>().pipe(
  Match.tag("At", (position) => Location.describe(position.location)),
  Match.tag(
    "OnRoad",
    (position) => `on the road from ${Location.describe(position.from)} toward ${position.toward}`,
  ),
  Match.exhaustive,
);
