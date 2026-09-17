import { Option } from "effect";
import { describe, expect, it } from "vitest";
import * as Background from "@/core/Background";
import * as Location from "@/core/Location";
import * as Position from "@/core/Position";
import { defaultBackground, regionBackground } from "@/core/data/backgrounds";

/** What a resolved path has to look like, whatever step of the chain produced it. */
const scene = /^\/scenes\/[a-z0-9-]+\.webp$/;

/**
 * The catalog with holes punched in it. Every real entry names artwork of its
 * own, so this is the only way to reach the folds that carry a location whose
 * picture failed to generate.
 */
const without =
  (...blank: ReadonlyArray<Location.LocationId>) =>
  (id: Location.LocationId): string =>
    blank.includes(id) ? "" : Location.byId[id].background;

describe("Background.forPosition", () => {
  it("shows a place the artwork the catalog gives it", () => {
    expect(Background.forPosition(Position.at("winterfell"))).toBe("/scenes/winterfell.webp");
    expect(Background.pathOf("winterfell")).toBe("/scenes/winterfell.webp");
  });

  it("gives every place in the catalog a picture to show", () => {
    const blank = Location.all
      .map((location) => ({
        id: location.id,
        path: Background.forPosition(Position.at(location.id)),
      }))
      .filter((entry) => !scene.test(entry.path));
    expect(blank).toEqual([]);
  });

  it("gives every region a picture to show", () => {
    const blank = Location.allRegions.filter(
      (region) => !scene.test(Background.pathOf(Background.stemForRegion(region))),
    );
    expect(blank).toEqual([]);
  });
});

describe("Background fallbacks", () => {
  it("folds a place with no artwork onto the one it sits inside", () => {
    expect(Location.parentOf("red-keep-throne-room")).toEqual(Option.some("kings-landing"));
    expect(Background.stemAt("red-keep-throne-room", without("red-keep-throne-room"))).toBe(
      Location.byId["kings-landing"].background,
    );
  });

  it("falls past a parent with no artwork of its own to the region", () => {
    expect(
      Background.stemAt("red-keep-throne-room", without("red-keep-throne-room", "kings-landing")),
    ).toBe(regionBackground.Crownlands);
  });

  it("falls to the region when a place stands alone", () => {
    expect(Location.parentOf("winterfell")).toEqual(Option.none());
    expect(Background.stemAt("winterfell", without("winterfell"))).toBe(
      regionBackground["The North"],
    );
  });

  it("falls to the default when the region is not one of ours", () => {
    expect(Background.stemForRegion("Yi Ti")).toBe(defaultBackground);
    expect(Background.stemForRegion("")).toBe(defaultBackground);
  });
});
