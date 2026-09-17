import { Option } from "effect";
import { defaultBackground, regionBackground } from "@/core/data/backgrounds";
import * as Location from "@/core/Location";
import type * as Position from "@/core/Position";
import { assetUrl } from "@/cdn";

/**
 * Where a filename stem is served from. Exported so the tests and the browser
 * agree on the shape of a path without either of them spelling it out again.
 */
export const pathOf = (stem: string): string => assetUrl(`/scenes/${stem}.webp`);

/** A stem only counts as artwork when it actually names a file. */
const named = (stem: string): Option.Option<string> =>
  Option.liftPredicate(stem, (value) => value.length > 0);

/** The stem the catalog hard-codes on a location. */
const catalogStem = (id: Location.LocationId): string => Location.byId[id].background;

/** The artwork a whole region falls back on. A region nobody has heard of has none. */
const regionStem = (region: string): Option.Option<string> =>
  Location.isRegion(region) ? named(regionBackground[region]) : Option.none();

/** The artwork of the place this one sits inside: the Red Keep borrows King's Landing. */
const parentStem = (
  id: Location.LocationId,
  artworkOf: (id: Location.LocationId) => string,
): Option.Option<string> =>
  Location.parentOf(id).pipe(Option.flatMap((parent) => named(artworkOf(parent))));

/**
 * The stem for a named place, narrowest answer first: its own artwork, the
 * place it stands in, the country around it, then the default.
 *
 * `artworkOf` is the catalog, and is a parameter only because every entry in it
 * currently names a file of its own. That puts the folds below out of reach of
 * the real catalog and so untestable without a gapped stand-in — but they are
 * where a location whose artwork failed to generate lands, so they have to be
 * right.
 */
export const stemAt = (
  id: Location.LocationId,
  artworkOf: (id: Location.LocationId) => string = catalogStem,
): string =>
  named(artworkOf(id)).pipe(
    Option.orElse(() => parentStem(id, artworkOf)),
    Option.orElse(() => regionStem(Location.byId[id].region)),
    Option.getOrElse(() => defaultBackground),
  );

/**
 * The tail of the chain above on its own: a whole region's artwork, and the
 * default when even that is missing. A healthy catalog never reaches it through
 * `stemAt`, so it is named here for the sweep that proves every region has a
 * picture and that a region nobody has heard of still resolves to something.
 */
export const stemForRegion = (region: string): string =>
  regionStem(region).pipe(Option.getOrElse(() => defaultBackground));

/**
 * The backdrop a scene is played against. Total at every step, so a location
 * with no picture of its own still renders something of the right country
 * rather than a blank frame.
 */
export const forPosition = (position: Position.Position): string =>
  pathOf(stemAt(position.location));
