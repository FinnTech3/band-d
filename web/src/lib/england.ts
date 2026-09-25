// Every small area in England, decoded from data/built/areas.json, with the
// same arithmetic as pipeline/src/bandd/analysis.py. The operations are done
// in the same order as there, so the rates come out identical to the last
// bit, which src/lib/england.test.ts checks against the pipeline's summary.

export const BANDS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type Band = (typeof BANDS)[number];

// Local Government Finance Act 1992, s.5: each band's bill in ninths of Band D.
export const NINTHS = [6, 7, 8, 9, 11, 13, 15, 18] as const;

// The VOA publishes "-" where a band holds one to four homes. Counted as the
// middle of that range, as in the pipeline.
export const SUPPRESSED_AS = 2.5;

export interface AreasFile {
  period: string;
  councils: [code: string, name: string, bandD: number][];
  prefixes: string[];
  code_step: number[];
  prefix: number[];
  suffix: string[];
  council: number[];
  bands: number[][];
  sales: number[];
  median: (number | null)[];
}

export interface Council {
  code: string;
  name: string;
  bandD: number;
}

export interface Area {
  code: string;
  name: string;
  council: Council;
  homesByBand: number[];
  suppressed: boolean[];
  homes: number;
  ratio: number;
  bill: number;
  sales: number;
  median: number | null;
  rate: number | null;
}

export interface Valued extends Area {
  median: number;
  rate: number;
}

export function areaCode(n: number): string {
  return "E" + String(n).padStart(8, "0");
}

export function decodeArea(file: AreasFile, i: number, code: string): Area {
  const [cCode, cName, bandD] = file.councils[file.council[i]!]!;
  const stored = file.bands[i]!;
  const homesByBand = stored.map((n) => (n === -1 ? SUPPRESSED_AS : 10 * n));
  let homes = 0;
  for (const h of homesByBand) homes += h;
  let weighted = 0;
  homesByBand.forEach((h, b) => {
    weighted += (h * NINTHS[b]!) / 9;
  });
  const ratio = weighted / homes;
  const bill = bandD * ratio;
  const median = file.median[i] ?? null;
  return {
    code,
    name: `${file.prefixes[file.prefix[i]!]} ${file.suffix[i]}`,
    council: { code: cCode, name: cName, bandD },
    homesByBand,
    suppressed: stored.map((n) => n === -1),
    homes,
    ratio,
    bill,
    sales: file.sales[i]!,
    median,
    rate: median === null ? null : (1000 * bill) / median,
  };
}

export function isValued(a: Area): a is Valued {
  return a.rate !== null;
}

export class England {
  readonly areas: Area[];
  readonly councils: Council[];
  /** Areas with at least five 2025 sales, lowest rate first. */
  readonly valued: Valued[];
  readonly homes: number;
  private readonly cumulative: number[];
  private deciles: Map<string, number> | undefined;

  constructor(file: AreasFile) {
    let n = 0;
    this.areas = file.code_step.map((step, i) => {
      n += step;
      return decodeArea(file, i, areaCode(n));
    });
    this.councils = file.councils.map(([code, name, bandD]) => ({ code, name, bandD }));
    this.valued = this.areas.filter(isValued).sort((a, b) => a.rate - b.rate || a.homes - b.homes);
    this.cumulative = [];
    let acc = 0;
    for (const a of this.valued) {
      acc += a.homes;
      this.cumulative.push(acc);
    }
    this.homes = acc;
  }

  /** Binary search: codes are stored in order. */
  find(code: string): Area | undefined {
    let lo = 0;
    let hi = this.areas.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = this.areas[mid]!.code;
      if (c === code) return this.areas[mid];
      if (c < code) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }

  council(code: string): Council | undefined {
    return this.councils.find((c) => c.code === code);
  }

  /** Quantile weighted by homes, as analysis.weighted_quantile. */
  quantile(q: number): number {
    const target = q * this.homes;
    for (let i = 0; i < this.valued.length; i++) {
      if (this.cumulative[i]! >= target) return this.valued[i]!.rate;
    }
    return this.valued[this.valued.length - 1]!.rate;
  }

  /** Share of England's homes (in valued areas) paying a strictly lower rate. */
  shareBelow(rate: number): number {
    let lo = 0;
    let hi = this.valued.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.valued[mid]!.rate < rate) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? 0 : this.cumulative[lo - 1]! / this.homes;
  }

  /** Share of England's homes (in valued areas) paying a strictly higher rate. */
  shareAbove(rate: number): number {
    let lo = 0;
    let hi = this.valued.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.valued[mid]!.rate <= rate) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? 1 : 1 - this.cumulative[lo - 1]! / this.homes;
  }

  /**
   * Which tenth of England's homes by value an area falls in, 1 to 10, cut as
   * analysis.by_value_decile cuts them: areas in order of typical price, each
   * placed by the homes that come before it.
   */
  valueDecile(code: string): number | undefined {
    if (!this.deciles) {
      this.deciles = new Map();
      const byPrice = [...this.valued].sort((a, b) => a.median - b.median || (a.code < b.code ? -1 : 1));
      let acc = 0;
      for (const a of byPrice) {
        this.deciles.set(a.code, Math.min(9, Math.floor((10 * acc) / this.homes)) + 1);
        acc += a.homes;
      }
    }
    return this.deciles.get(code);
  }

  get highest(): Valued {
    return this.valued[this.valued.length - 1]!;
  }

  get lowest(): Valued {
    return this.valued[0]!;
  }

  /** The area at the median, weighted by homes: the middle of England. */
  get middle(): Valued {
    const target = 0.5 * this.homes;
    const i = this.cumulative.findIndex((c) => c >= target);
    return this.valued[i]!;
  }

  /** Homes in each of `n` equal steps of log rate between `lo` and `hi`. */
  bins(lo: number, hi: number, n: number): number[] {
    const out = new Array<number>(n).fill(0);
    for (const a of this.valued) out[binOf(a.rate, lo, hi, n)]! += a.homes;
    return out;
  }

  /** The valued areas of one council. */
  inCouncil(code: string): Valued[] {
    return this.valued.filter((a) => a.council.code === code);
  }
}

export function binOf(rate: number, lo: number, hi: number, n: number): number {
  const k = Math.floor(((Math.log(rate) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * n);
  return Math.min(n - 1, Math.max(0, k));
}
