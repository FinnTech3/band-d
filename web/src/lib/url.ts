// The page address holds the answer, so a shared link opens on the same area.
// It holds the area or council code, never the postcode that found it.

export type Place = { kind: "area"; code: string } | { kind: "council"; code: string };

export function readPlace(search: string): Place | null {
  const p = new URLSearchParams(search);
  const area = p.get("area");
  if (area && /^E01\d{6}$/.test(area)) return { kind: "area", code: area };
  const council = p.get("council");
  if (council && /^E0[6-9]\d{6}$/.test(council)) return { kind: "council", code: council };
  return null;
}

export function writePlace(place: Place | null): string {
  return place ? `?${place.kind}=${place.code}` : "";
}
