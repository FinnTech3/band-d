import { describe, expect, it } from "vitest";
import { gbp, pctDown, relative } from "./format";

describe("format", () => {
  it("prints pounds the British way", () => {
    expect(gbp(1801.69)).toBe("£1,802");
    expect(gbp(45.0434, 2)).toBe("£45.04");
    expect(gbp(-959.2)).toBe("-£959");
  });

  it("never rounds a share up to a claim it has not earned", () => {
    expect(pctDown(0.99996)).toBe("99.9%");
    expect(pctDown(0.7269)).toBe("72.6%");
  });

  it("describes a comparison in words", () => {
    expect(relative(4_350_000, 39_999)).toBe("109 times as much");
    expect(relative(300, 100)).toBe("3.0 times as much");
    expect(relative(1638, 1802)).toBe("9% less");
    expect(relative(1000, 1010)).toBe("about the same");
    expect(relative(40_000, 280_000)).toBe("about a seventh as much");
    expect(relative(1, 50)).toBe("less than a tenth as much");
  });
});
