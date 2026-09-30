import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AreasFile, England } from "./england";
import { type PointsFile, decodePoints, looksLikePointsFile } from "./points";

const england = new England(JSON.parse(readFileSync("public/data/areas.json", "utf8")) as AreasFile);
const points = decodePoints(JSON.parse(readFileSync("public/data/points.json", "utf8")) as PointsFile);

describe("the map's points", () => {
  it("give every area a place, in the same order", () => {
    expect(points.x).toHaveLength(england.size);
    expect(points.y).toHaveLength(england.size);
  });

  it("span England, from Cornwall to Northumberland", () => {
    expect(points.minX).toBeGreaterThan(80_000);
    expect(points.maxX).toBeLessThan(660_000);
    expect(points.maxY).toBeGreaterThan(600_000);
  });

  // Checks that the order lines up: if the points were shifted by one area,
  // these would land somewhere else entirely.
  it("put the lowest rate in Westminster and the highest in County Durham", () => {
    const lo = england.indexOf(england.lowest.code);
    const hi = england.indexOf(england.highest.code);
    expect(points.x[lo]).toBeGreaterThan(523_000);
    expect(points.x[lo]).toBeLessThan(533_000);
    expect(points.y[lo]).toBeGreaterThan(176_000);
    expect(points.y[lo]).toBeLessThan(184_000);
    expect(points.y[hi]).toBeGreaterThan(520_000);
    expect(points.y[hi]).toBeLessThan(560_000);
  });
});

describe("the points load guard", () => {
  it("accepts the real file and rejects anything that is not it", () => {
    const raw = JSON.parse(readFileSync("public/data/points.json", "utf8"));
    expect(looksLikePointsFile(raw)).toBe(true);
    for (const bad of [null, undefined, {}, [], [1, 2, 3], { x: [], y: [] }, "text", 5])
      expect(looksLikePointsFile(bad)).toBe(false);
  });
});
