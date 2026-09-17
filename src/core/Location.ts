import { Option, Schema } from "effect";
import { locations, type LocationId as CatalogLocationId } from "@/core/data/locations";
import { openingLocationId } from "@/core/data/prologue";
import { regions, type Region as SeedRegion } from "@/core/data/seed";

/** One entry of the location catalog, exactly as written in `data/locations.ts`. */
export type Location = (typeof locations)[number];

/** The whole catalog, in catalog order. */
export const all = locations;

/** Every region name, in catalog order. */
export const allRegions = regions;

/**
 * Index the catalog by id. `Object.fromEntries` cannot prove the result covers
 * every id, so this is the single place that asserts it; `test/catalog.test.ts`
 * checks the assertion holds.
 */
export const indexById = <A>(f: (location: Location) => A): Record<CatalogLocationId, A> =>
  Object.fromEntries(locations.map((location) => [location.id, f(location)])) as Record<
    CatalogLocationId,
    A
  >;

/** Every location by id. Total over `LocationId`, so lookups never widen to `undefined`. */
export const byId: Record<CatalogLocationId, Location> = indexById((location) => location);

/** Whether a value names a location in the catalog. */
export const isLocationId = (value: unknown): value is CatalogLocationId =>
  typeof value === "string" && Object.hasOwn(byId, value);

/** Whether a value names a region in the catalog. */
export const isRegion = (value: unknown): value is SeedRegion =>
  typeof value === "string" && (regions as ReadonlyArray<string>).includes(value);

/** A location id, validated against the catalog rather than a hand-written literal union. */
export const LocationId = Schema.String.pipe(
  Schema.filter(isLocationId, { identifier: "LocationId" }),
);

/** The literal union of catalog location ids. */
export type LocationId = typeof LocationId.Type;

/** Where a story with no better answer stands: the place it opens in. */
export const fallback: LocationId = openingLocationId;

/** A region name, validated against the catalog. */
export const Region = Schema.String.pipe(Schema.filter(isRegion, { identifier: "Region" }));

/** The literal union of region names. */
export type Region = typeof Region.Type;

/** Only some sub-places carry a parent, so the catalog's optional field is read through a guard. */
const withinOf = (location: Location): string | undefined =>
  "within" in location ? location.within : undefined;

/** The parent location a sub-place sits inside — the Red Keep is within King's Landing. */
export const parentOf = (id: LocationId): Option.Option<LocationId> =>
  Option.fromNullable(withinOf(byId[id])).pipe(Option.filter(isLocationId));

const childIds: Record<LocationId, ReadonlyArray<LocationId>> = indexById((parent) =>
  locations.filter((child) => withinOf(child) === parent.id).map((child) => child.id),
);

/** The sub-places that sit inside a location; empty for most of the catalog. */
export const childrenOf = (id: LocationId): ReadonlyArray<LocationId> => childIds[id];

/** `"Winterfell"` — what a place is called. */
export const nameOf = (id: LocationId): string => byId[id].name;

/** `"Winterfell (The North)"` — how a place is named to the models and in logs. */
export const describe = (id: LocationId): string => {
  const location = byId[id];
  return `${location.name} (${location.region})`;
};

/** Plausible next places, as context for the narrator — never a constraint on it. */
export const nearby = (id: LocationId): ReadonlyArray<Location> =>
  byId[id].adjacent.filter(isLocationId).map((neighbour) => byId[neighbour]);
