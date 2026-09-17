import { Option } from "effect";
import { defaultBackground, regionBackground } from "@/core/data/backgrounds";
import * as Beat from "@/core/Beat";
import * as Location from "@/core/Location";
import type * as Position from "@/core/Position";
import { assetUrl } from "@/cdn";

export const pathOf = (stem: string): string => assetUrl(`/scenes/${stem}.webp`);

const named = (stem: string): Option.Option<string> =>
  Option.liftPredicate(stem, (value) => value.length > 0);

const catalogStem = (id: Location.LocationId): string => Location.byId[id].background;

const regionStem = (region: string): Option.Option<string> =>
  Location.isRegion(region) ? named(regionBackground[region]) : Option.none();

const parentStem = (
  id: Location.LocationId,
  artworkOf: (id: Location.LocationId) => string,
): Option.Option<string> =>
  Location.parentOf(id).pipe(Option.flatMap((parent) => named(artworkOf(parent))));

/**
 * `artworkOf` is a parameter so a test can pass a gapped catalog. Every real entry names
 * a file of its own, so the fallbacks below are unreachable through the catalog itself,
 * and they are where a location whose artwork failed to generate lands.
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

/** The region tail of `stemAt` alone, for the sweep that proves every region has a picture. */
export const stemForRegion = (region: string): string =>
  regionStem(region).pipe(Option.getOrElse(() => defaultBackground));

export const forPosition = (position: Position.Position): string =>
  pathOf(stemAt(position.location));

/**
 * The beat's own artwork when the beat has some, and the place otherwise. The beat
 * arrives as an `Option` because the opening message has no beat at all.
 */
export const forScene = (
  position: Position.Position,
  beat: Option.Option<Beat.BeatId>,
): string =>
  beat.pipe(
    Option.flatMap(Beat.stemOf),
    Option.flatMap(named),
    Option.map(pathOf),
    Option.getOrElse(() => forPosition(position)),
  );
