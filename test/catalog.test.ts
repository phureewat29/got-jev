import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Beat from "@/core/Beat";
import * as Danger from "@/core/Danger";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import * as Position from "@/core/Position";
import { regions } from "@/core/data/seed";

const idsOf = (entries: ReadonlyArray<{ readonly id: string }>): ReadonlyArray<string> =>
  entries.map((entry) => entry.id);

describe("location catalog", () => {
  it("has unique ids and indexes every one of them", () => {
    const ids = idsOf(Location.all);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(Location.byId).length).toBe(ids.length);
  });

  it("only names regions the seed knows", () => {
    const unknown = Location.all.filter((location) => !Location.isRegion(location.region));
    expect(unknown).toEqual([]);
    expect(new Set(regions).size).toBe(regions.length);
  });

  it("resolves every adjacency", () => {
    const dangling = Location.all.flatMap((location) =>
      location.adjacent.filter((id) => !Location.isLocationId(id)).map((id) => `${location.id} -> ${id}`),
    );
    expect(dangling).toEqual([]);
  });

  it("resolves every parent and never makes a place its own parent", () => {
    const broken = Location.all
      .map((location) => ({ id: location.id, parent: Location.parentOf(location.id) }))
      .filter(
        (entry) =>
          Option.isSome(entry.parent) &&
          (entry.parent.value === entry.id || !Location.isLocationId(entry.parent.value)),
      );
    expect(broken).toEqual([]);
  });

  it("agrees with itself about children", () => {
    const mismatched = Location.all.filter((parent) =>
      Location.childrenOf(parent.id).some((child) =>
        Option.getOrNull(Location.parentOf(child)) !== parent.id,
      ),
    );
    expect(mismatched).toEqual([]);
    expect(Location.childrenOf("kings-landing")).toContain("red-keep-throne-room");
    expect(Location.childrenOf("braavos")).toEqual(["house-of-black-and-white"]);
    expect(Location.childrenOf("winterfell")).toEqual([]);
  });

  it("decodes catalog ids and rejects anything else", () => {
    const decode = Schema.decodeUnknownEither(Location.LocationId);
    expect(decode("castle-black")._tag).toBe("Right");
    expect(decode("kings-cross")._tag).toBe("Left");
  });
});

describe("beat and mood catalogs", () => {
  it("have unique ids and total indexes", () => {
    expect(new Set(idsOf(Beat.all)).size).toBe(Beat.all.length);
    expect(new Set(idsOf(Mood.all)).size).toBe(Mood.all.length);
    expect(Object.keys(Beat.byId).length).toBe(Beat.all.length);
    expect(Object.keys(Mood.byId).length).toBe(Mood.all.length);
  });

  it("names a track per mood", () => {
    expect(Mood.trackFor("battle")).toBe("/music/battle.mp3");
    expect(Mood.all.map((mood) => Mood.trackFor(mood.id))).toContain("/music/calm.mp3");
  });

  it("keeps the fallbacks inside their catalogs", () => {
    expect(Location.isLocationId(Location.fallback)).toBe(true);
    expect(Beat.isBeatId(Beat.fallback)).toBe(true);
    expect(Mood.isMoodId(Mood.fallback)).toBe(true);
    expect(Danger.isDangerId(Danger.fallback)).toBe(true);
  });
});

describe("danger rubric", () => {
  it("offers one description per level", () => {
    expect(Danger.criteria.length).toBe(Danger.levels.length);
    expect(Danger.criteria.every((description) => description.length > 0)).toBe(true);
  });

  it("rounds and clamps a score to a level", () => {
    expect(Danger.fromScore(0)).toBe("safe");
    expect(Danger.fromScore(3.4)).toBe("perilous");
    expect(Danger.fromScore(3.6)).toBe("deadly");
    expect(Danger.fromScore(9)).toBe("deadly");
    expect(Danger.fromScore(-2)).toBe("safe");
    expect(Danger.fromScore(Number.NaN)).toBe(Danger.fallback);
  });
});

describe("position", () => {
  it("round-trips through its schema", () => {
    const where = Position.at("castle-black");
    const encoded = Schema.encodeSync(Position.Position)(where);
    expect(Schema.decodeSync(Position.Position)(encoded)).toEqual(where);
  });

  it("only ever stands somewhere the catalog knows", () => {
    const decode = Schema.decodeUnknownEither(Position.Position);
    expect(decode({ location: "winterfell" })._tag).toBe("Right");
    expect(decode({ location: "kings-cross" })._tag).toBe("Left");
  });
});
