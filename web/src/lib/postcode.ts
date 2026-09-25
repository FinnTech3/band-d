// Postcode to small area, through postcodes.io, an open service built on the
// ONS postcode directory. It is the only request the page makes with anything
// the reader typed, and it sends nothing but the postcode.

// The shape of a UK postcode: outward code, then a digit and two letters.
const POSTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;

export function normalise(input: string): string | null {
  const pc = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return POSTCODE.test(pc) ? pc : null;
}

export function pretty(pc: string): string {
  return `${pc.slice(0, -3)} ${pc.slice(-3)}`;
}

export type Lookup =
  | { kind: "found"; lsoa: string; district: string | null }
  | { kind: "elsewhere"; country: string }
  | { kind: "unknown" }
  | { kind: "offline" };

interface Response {
  status: number;
  result?: { country?: string; codes?: { lsoa21?: string | null; admin_district?: string | null } };
}

export function interpret(status: number, body: Response | null): Lookup {
  if (status === 404) return { kind: "unknown" };
  const r = body?.result;
  if (status !== 200 || !r) return { kind: "offline" };
  if (r.country && r.country !== "England") return { kind: "elsewhere", country: r.country };
  const lsoa = r.codes?.lsoa21;
  if (!lsoa) return { kind: "unknown" };
  return { kind: "found", lsoa, district: r.codes?.admin_district ?? null };
}

export async function lookup(pc: string, fetcher: typeof fetch = fetch): Promise<Lookup> {
  try {
    const res = await fetcher(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
    const body = (await res.json().catch(() => null)) as Response | null;
    return interpret(res.status, body);
  } catch {
    return { kind: "offline" };
  }
}
