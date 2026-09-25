import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AreasFile, England, type Valued } from "./england";
import { comparison, counterpart, standing } from "./story";

const england = new England(JSON.parse(readFileSync("public/data/areas.json", "utf8")) as AreasFile);
const byName = (n: string) => england.valued.find((a) => a.name === n) as Valued;

describe("the sentences", () => {
  it("names the two ends of England rather than giving a percentage", () => {
    expect(standing(england.highest, england)).toBe("The highest rate of any area in England.");
    expect(standing(england.lowest, england)).toBe("The lowest rate of any area in England.");
  });

  it("says more or less depending on which side of the middle an area sits", () => {
    expect(standing(byName("Blackpool 010D"), england)).toMatch(/^Homes here pay more .* than 9\d\.\d% of homes/);
    expect(standing(byName("Bromley 005C"), england)).toMatch(/^Homes here pay less .* than 8\d\.\d% of homes/);
  });

  it("compares a high-rate area with the lowest, and the lowest with the highest", () => {
    expect(counterpart(england.highest, england).code).toBe(england.lowest.code);
    expect(counterpart(england.lowest, england).code).toBe(england.highest.code);
    expect(counterpart(byName("Bromley 005C"), england).code).toBe(england.highest.code);
  });

  it("writes the comparison the README quotes for the two ends", () => {
    expect(comparison(england.highest, england)).toBe(
      "The typical home in Westminster 002A sold for £4,350,000, 109 times as much. Its average bill is £1,638, 9% less.",
    );
    expect(comparison(england.lowest, england)).toBe(
      "The typical home in County Durham 036C sold for £39,999, less than a tenth as much. Its average bill is £1,802, 10% more.",
    );
  });
});
