import { Option, Schema } from "effect";
import { locations, type LocationId as CatalogLocationId } from "@/core/data/locations";
import { openingLocationId } from "@/core/data/prologue";
import { regions, type Region as SeedRegion } from "@/core/data/seed";

export type Location = (typeof locations)[number];

export const all = locations;

export const allRegions = regions;

/**
 * `Object.fromEntries` cannot prove the result covers every id, so this is the single
 * place that asserts it. `test/catalog.test.ts` checks the assertion holds.
 */
const indexById = <A>(f: (location: Location) => A): Record<CatalogLocationId, A> =>
  Object.fromEntries(locations.map((location) => [location.id, f(location)])) as Record<
    CatalogLocationId,
    A
  >;

export const byId: Record<CatalogLocationId, Location> = indexById((location) => location);

export const isLocationId = (value: unknown): value is CatalogLocationId =>
  typeof value === "string" && Object.hasOwn(byId, value);

export const isRegion = (value: unknown): value is SeedRegion =>
  typeof value === "string" && (regions as ReadonlyArray<string>).includes(value);

export const LocationId = Schema.String.pipe(
  Schema.filter(isLocationId, { identifier: "LocationId" }),
);

export type LocationId = typeof LocationId.Type;

/** Where a story with no better answer stands. */
export const fallback: LocationId = openingLocationId;

export const Region = Schema.String.pipe(Schema.filter(isRegion, { identifier: "Region" }));

export type Region = typeof Region.Type;

/** The catalog is a union and only some entries carry `within`, so it is read through a guard. */
const withinOf = (location: Location): string | undefined =>
  "within" in location ? location.within : undefined;

export const parentOf = (id: LocationId): Option.Option<LocationId> =>
  Option.fromNullable(withinOf(byId[id])).pipe(Option.filter(isLocationId));

const childIds: Record<LocationId, ReadonlyArray<LocationId>> = indexById((parent) =>
  locations.filter((child) => withinOf(child) === parent.id).map((child) => child.id),
);

export const childrenOf = (id: LocationId): ReadonlyArray<LocationId> => childIds[id];

export const nameOf = (id: LocationId): string => byId[id].name;

/** Plausible next places, as context for the narrator, never a constraint on it. */
export const nearby = (id: LocationId): ReadonlyArray<Location> =>
  byId[id].adjacent.filter(isLocationId).map((neighbour) => byId[neighbour]);
