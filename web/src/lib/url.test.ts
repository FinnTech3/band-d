import { describe, expect, it } from "vitest";
import { readPlace, writePlace } from "./url";

describe("page address", () => {
  it("round-trips an area and a council", () => {
    for (const p of [
      { kind: "area", code: "E01020767" },
      { kind: "council", code: "E06000047" },
    ] as const) {
      expect(readPlace(writePlace(p))).toEqual(p);
    }
  });

  it("ignores anything that is not an English code", () => {
    for (const s of ["?area=W01000001", "?area=DH65NP", "?council=S12000033", "?area=<script>", ""]) {
      expect(readPlace(s)).toBeNull();
    }
  });
});
