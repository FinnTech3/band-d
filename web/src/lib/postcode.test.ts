import { describe, expect, it } from "vitest";
import { interpret, lookup, normalise, pretty } from "./postcode";

describe("postcodes", () => {
  it("accepts the shapes postcodes come in, however typed", () => {
    expect(normalise(" dh6 5np ")).toBe("DH65NP");
    expect(normalise("SW1A 1AA")).toBe("SW1A1AA");
    expect(normalise("m1 1ae")).toBe("M11AE");
    expect(pretty("SW1A1AA")).toBe("SW1A 1AA");
  });

  it("refuses what cannot be a postcode, before anything is sent", () => {
    for (const bad of ["", "DH6", "12345", "DH6 5N", "not a postcode"]) expect(normalise(bad)).toBeNull();
  });

  it("reads the service's answer", () => {
    const ok = {
      status: 200,
      result: { country: "England", codes: { lsoa21: "E01020696", admin_district: "E06000047" } },
    };
    expect(interpret(200, ok)).toEqual({ kind: "found", lsoa: "E01020696", district: "E06000047" });
    expect(interpret(404, null)).toEqual({ kind: "unknown" });
    expect(interpret(200, { status: 200, result: { country: "Wales", codes: { lsoa21: "W01000001" } } })).toEqual({
      kind: "elsewhere",
      country: "Wales",
    });
    expect(interpret(500, null)).toEqual({ kind: "offline" });
  });

  it("treats a failed request as offline rather than throwing", async () => {
    const failing = (() => Promise.reject(new Error("no network"))) as unknown as typeof fetch;
    expect(await lookup("DH65NP", failing)).toEqual({ kind: "offline" });
  });
});
