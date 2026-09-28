import { describe, expect, it } from "vitest";
import { MIDDLE, STEPS, lean, ramp, rgb, stepOf, towardsFlat } from "./shade";

describe("the map's colour scale", () => {
  it("puts England's own rate in the middle", () => {
    expect(stepOf(5.92, 5.92)).toBe(MIDDLE);
  });

  it("treats half and double as equally far out", () => {
    expect(lean(2.96, 5.92)).toBeCloseTo(-lean(11.84, 5.92), 12);
  });

  it("clips at the ends rather than running off them", () => {
    expect(stepOf(0.38, 5.92)).toBe(0);
    expect(stepOf(45.04, 5.92)).toBe(STEPS - 1);
  });

  it("never runs backwards", () => {
    let last = -1;
    for (let r = 0.3; r < 50; r *= 1.01) {
      const s = stepOf(r, 5.92);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it("starts at the low colour, passes the neutral one and ends at the high one", () => {
    const lut = ramp(rgb("#1b4f9c"), rgb("#c4b89d"), rgb("#b0243f"));
    expect(lut).toHaveLength(STEPS);
    expect(lut[0]).toBe("rgb(27,79,156)");
    expect(lut[MIDDLE]).toBe("rgb(196,184,157)");
    expect(lut[STEPS - 1]).toBe("rgb(176,36,63)");
  });

  it("reaches a flat charge at the end of the slider and today's rate at the start", () => {
    expect(towardsFlat(45.04, 5.92, 0)).toBe(45.04);
    expect(towardsFlat(45.04, 5.92, 1)).toBe(5.92);
  });
});
