// The app's arithmetic against the pipeline's. Every number here is one the
// README quotes, so if the app and the write-up ever disagree, this fails.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AreasFile, England, SUPPRESSED_AS, decodeArea } from "./england";
import type { Summary } from "./summary";

const file = JSON.parse(readFileSync("public/data/areas.json", "utf8")) as AreasFile;
const summary = JSON.parse(readFileSync("public/data/summary.json", "utf8")) as Summary;
const england = new England(file);

describe("decoding", () => {
  it("holds every small area in England, in code order", () => {
    expect(england.areas).toHaveLength(33_755);
    const codes = england.areas.map((a) => a.code);
    expect([...codes].sort()).toEqual(codes);
  });

  it("values exactly the areas the pipeline valued, and covers the same homes", () => {
    expect(england.valued).toHaveLength(summary.areas);
    expect(england.homes).toBeCloseTo(summary.homes, 6);
  });

  it("counts a suppressed band as 2.5 homes", () => {
    const i = file.bands.findIndex((b) => b.includes(-1));
    const a = decodeArea(file, i, "x");
    const b = file.bands[i]!.indexOf(-1);
    expect(a.homesByBand[b]).toBe(SUPPRESSED_AS);
    expect(a.suppressed[b]).toBe(true);
  });
});

describe("the app lands on the README's numbers exactly", () => {
  it("every quantile", () => {
    for (const [q, v] of Object.entries(summary.quantiles)) expect(england.quantile(Number(q))).toBe(v);
  });

  it("the five highest and five lowest areas, rate and bill", () => {
    const top = england.valued.slice(-5).reverse();
    const bottom = england.valued.slice(0, 5);
    summary.highest.forEach((e, i) => {
      expect(top[i]!.code).toBe(e.code);
      expect(top[i]!.rate).toBe(e.rate);
      expect(top[i]!.bill).toBe(e.bill);
    });
    summary.lowest.forEach((e, i) => {
      expect(bottom[i]!.code).toBe(e.code);
      expect(bottom[i]!.rate).toBe(e.rate);
    });
  });

  it("the names the README prints", () => {
    expect(england.highest.name).toBe("County Durham 036C");
    expect(england.lowest.name).toBe("Westminster 002A");
  });
});

describe("placing a reader", () => {
  it("no home pays less than the lowest area, and almost all pay less than the highest", () => {
    expect(england.shareBelow(england.lowest.rate)).toBe(0);
    expect(england.shareBelow(england.highest.rate)).toBeCloseTo(1 - england.highest.homes / england.homes, 12);
  });

  it("the middle area sits at the median", () => {
    expect(england.middle.rate).toBe(summary.quantiles["0.5"]);
    const s = england.shareBelow(england.middle.rate);
    expect(s).toBeLessThan(0.5);
    expect(s + england.middle.homes / england.homes).toBeGreaterThanOrEqual(0.5);
  });

  it("finds any area by code, and nothing that is not one", () => {
    for (const a of [england.areas[0]!, england.areas[20_000]!, england.areas.at(-1)!]) {
      expect(england.find(a.code)).toBe(a);
    }
    expect(england.find("E01999999")).toBeUndefined();
    expect(england.find("W01000001")).toBeUndefined();
  });

  it("puts every valued home in exactly one bin", () => {
    const bins = england.bins(0.25, 60, 60);
    expect(bins.reduce((a, b) => a + b, 0)).toBeCloseTo(england.homes, 6);
  });
});

describe("tenths of England by value", () => {
  it("cuts the same ten groups as the pipeline", () => {
    const counts = new Array<number>(10).fill(0);
    for (const a of england.valued) counts[england.valueDecile(a.code)! - 1]! += 1;
    expect(counts).toEqual(summary.deciles.map((d) => d.areas));
  });

  it("puts the cheapest area in the first tenth and the dearest in the last", () => {
    const byPrice = [...england.valued].sort((a, b) => a.median - b.median);
    expect(england.valueDecile(byPrice[0]!.code)).toBe(1);
    expect(england.valueDecile(byPrice.at(-1)!.code)).toBe(10);
  });

  it("shares below, at and above an area add to one", () => {
    const a = england.middle;
    const at = england.valued.filter((v) => v.rate === a.rate).reduce((s, v) => s + v.homes, 0) / england.homes;
    expect(england.shareBelow(a.rate) + at + england.shareAbove(a.rate)).toBeCloseTo(1, 12);
  });
});
