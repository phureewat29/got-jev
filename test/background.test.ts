import { Option } from "effect";
import { describe, expect, it } from "vitest";
import * as Background from "@/core/Background";
import * as Beat from "@/core/Beat";
import * as Location from "@/core/Location";
import * as Position from "@/core/Position";
import { defaultBackground, regionBackground } from "@/core/data/backgrounds";
import { openingLocationId } from "@/core/data/prologue";

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

describe("Background.forScene", () => {
  it("lets a beat that is the whole scene take the frame from the place", () => {
    expect(Background.forScene(Position.at("winterfell"), Option.some("battle"))).toBe(
      "/scenes/beat-battle.webp",
    );
    expect(Background.forScene(Position.at("meereen"), Option.some("battle"))).toBe(
      "/scenes/beat-battle.webp",
    );
  });

  it("leaves the place chain untouched for a beat with no look of its own", () => {
    expect(Background.forScene(Position.at("winterfell"), Option.some("journey"))).toBe(
      Background.forPosition(Position.at("winterfell")),
    );
    expect(Background.forScene(Position.at("great-pyramid"), Option.some("quiet"))).toBe(
      "/scenes/great-pyramid.webp",
    );
  });

  it("shows the opening its own plate, because nothing has happened yet", () => {
    expect(Background.forScene(Position.at(openingLocationId), Option.none())).toBe(
      Background.forPosition(Position.at(openingLocationId)),
    );
    expect(Background.forScene(Position.at(openingLocationId), Option.none())).toBe(
      "/scenes/castle-black.webp",
    );
  });

  it("gives every beat that claims artwork a stem nothing else answers to", () => {
    const claimed = Beat.all.filter((beat) => Option.isSome(Beat.stemOf(beat.id)));
    const stems = claimed.flatMap((beat) => Option.toArray(Beat.stemOf(beat.id)));

    expect(claimed.map((beat) => beat.id)).toEqual([
      "battle",
      "intrigue",
      "feast",
      "wedding",
      "trial",
      "siege",
      "parley",
      "vision",
      "supernatural",
    ]);
    expect(stems).toEqual(claimed.map((beat) => `beat-${beat.id}`));
    expect(new Set(stems).size).toBe(stems.length);
    expect(stems.every((stem) => scene.test(Background.pathOf(stem)))).toBe(true);

    const places = new Set<string>([
      ...Location.all.map((location) => location.background),
      ...Object.values(regionBackground),
      defaultBackground,
    ]);
    expect(stems.filter((stem) => places.has(stem))).toEqual([]);
  });

  it("leaves the ordinary turns to the place on purpose", () => {
    const bare = Beat.all
      .filter((beat) => Option.isNone(Beat.stemOf(beat.id)))
      .map((beat) => beat.id);
    expect(bare).toEqual(["duel", "journey", "oath", "stealth", "quiet"]);
  });
});
