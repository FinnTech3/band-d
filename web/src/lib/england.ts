// Every small area in England, decoded from data/built/areas.json, with the
// same arithmetic as pipeline/src/bandd/analysis.py. The operations are done
// in the same order as there, so the rates come out identical to the last
// bit, which src/lib/england.test.ts checks against the pipeline's summary.
//
// A phone has to do this for 33,755 areas before it can answer, so the rates
// are worked out in one pass into flat arrays, and an area only becomes an
// object when something asks for it.

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

function homesIn(stored: number): number {
  return stored === -1 ? SUPPRESSED_AS : 10 * stored;
}

/** Homes and average band ratio, summed band by band as analysis.build_areas does. */
function mix(stored: number[]): [homes: number, ratio: number] {
  let homes = 0;
  let weighted = 0;
  for (let b = 0; b < 8; b++) {
    const h = homesIn(stored[b]!);
    homes += h;
    weighted += (h * NINTHS[b]!) / 9;
  }
  return [homes, weighted / homes];
}

export function decodeArea(file: AreasFile, i: number, code: string): Area {
  const [cCode, cName, bandD] = file.councils[file.council[i]!]!;
  const stored = file.bands[i]!;
  const [homes, ratio] = mix(stored);
  const bill = bandD * ratio;
  const median = file.median[i] ?? null;
  return {
    code,
    name: `${file.prefixes[file.prefix[i]!]} ${file.suffix[i]}`,
    council: { code: cCode, name: cName, bandD },
    homesByBand: stored.map(homesIn),
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
  readonly councils: Council[];
  /** Homes in the areas with at least five 2025 sales. */
  readonly homes: number;
  /** How many areas have at least five 2025 sales. */
  readonly valuedCount: number;

  private readonly file: AreasFile;
  private readonly codes: Int32Array;
  /** Every area's rate in code order, NaN where too few homes sold to price it. */
  readonly rates: Float64Array;
  private readonly homesOf: Float64Array;
  /** Indices of valued areas, lowest rate first; ties by fewer homes, as the pipeline sorts. */
  private readonly order: Int32Array;
  private readonly cumulative: Float64Array;
  private readonly cache = new Map<number, Area>();
  private deciles: Map<string, number> | undefined;

  constructor(file: AreasFile) {
    this.file = file;
    const n = file.code_step.length;
    this.codes = new Int32Array(n);
    this.rates = new Float64Array(n);
    this.homesOf = new Float64Array(n);
    let code = 0;
    let valued = 0;
    for (let i = 0; i < n; i++) {
      code += file.code_step[i]!;
      this.codes[i] = code;
      const [homes, ratio] = mix(file.bands[i]!);
      this.homesOf[i] = homes;
      const median = file.median[i];
      if (median == null) {
        this.rates[i] = NaN;
      } else {
        const bill = file.councils[file.council[i]!]![2] * ratio;
        this.rates[i] = (1000 * bill) / median;
        valued++;
      }
    }
    this.valuedCount = valued;

    const order = new Int32Array(valued);
    for (let i = 0, k = 0; i < n; i++) if (!Number.isNaN(this.rates[i]!)) order[k++] = i;
    const r = this.rates;
    const h = this.homesOf;
    order.sort((a, b) => r[a]! - r[b]! || h[a]! - h[b]!);
    this.order = order;

    this.cumulative = new Float64Array(valued);
    let acc = 0;
    for (let k = 0; k < valued; k++) {
      acc += h[order[k]!]!;
      this.cumulative[k] = acc;
    }
    this.homes = acc;
    this.councils = file.councils.map(([code, name, bandD]) => ({ code, name, bandD }));
  }

  get size(): number {
    return this.codes.length;
  }

  /** The area stored at position i, in code order. */
  at(i: number): Area {
    let a = this.cache.get(i);
    if (!a) {
      a = decodeArea(this.file, i, areaCode(this.codes[i]!));
      this.cache.set(i, a);
    }
    return a;
  }

  /** The k-th valued area, lowest rate first. */
  valuedAt(k: number): Valued {
    return this.at(this.order[k]!) as Valued;
  }

  /** Every valued area, lowest rate first. Builds every object: for tests and small councils, not the first paint. */
  get valued(): Valued[] {
    return Array.from(this.order, (i) => this.at(i) as Valued);
  }

  /** Every area in code order. Builds every object, as above. */
  get areas(): Area[] {
    return Array.from({ length: this.size }, (_, i) => this.at(i));
  }

  /** Binary search: codes are stored in order. -1 if there is no such area. */
  indexOf(code: string): number {
    if (!/^E\d{8}$/.test(code)) return -1;
    const target = Number(code.slice(1));
    let lo = 0;
    let hi = this.codes.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = this.codes[mid]!;
      if (c === target) return mid;
      if (c < target) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  find(code: string): Area | undefined {
    const i = this.indexOf(code);
    return i < 0 ? undefined : this.at(i);
  }

  /** Positions of every area in one council, valued or not. */
  indicesIn(code: string): number[] {
    const c = this.file.councils.findIndex(([cc]) => cc === code);
    const out: number[] = [];
    this.file.council.forEach((ci, i) => {
      if (ci === c) out.push(i);
    });
    return out;
  }

  council(code: string): Council | undefined {
    return this.councils.find((c) => c.code === code);
  }

  /** Quantile weighted by homes, as analysis.weighted_quantile. */
  quantile(q: number): number {
    const target = q * this.homes;
    for (let k = 0; k < this.valuedCount; k++) {
      if (this.cumulative[k]! >= target) return this.rates[this.order[k]!]!;
    }
    return this.rates[this.order[this.valuedCount - 1]!]!;
  }

  /** Share of England's homes (in valued areas) paying a strictly lower rate. */
  shareBelow(rate: number): number {
    let lo = 0;
    let hi = this.valuedCount;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.rates[this.order[mid]!]! < rate) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? 0 : this.cumulative[lo - 1]! / this.homes;
  }

  /** Share of England's homes (in valued areas) paying a strictly higher rate. */
  shareAbove(rate: number): number {
    let lo = 0;
    let hi = this.valuedCount;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.rates[this.order[mid]!]! <= rate) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? 1 : 1 - this.cumulative[lo - 1]! / this.homes;
  }

  /**
   * Which tenth of England's homes by value an area falls in, 1 to 10, cut as
   * analysis.by_value_decile cuts them: areas in order of typical price, ties
   * by code, each placed by the homes that come before it.
   */
  valueDecile(code: string): number | undefined {
    if (!this.deciles) {
      this.deciles = new Map();
      const med = this.file.median;
      const byPrice = Int32Array.from(this.order).sort((a, b) => med[a]! - med[b]! || a - b);
      let acc = 0;
      for (const i of byPrice) {
        this.deciles.set(areaCode(this.codes[i]!), Math.min(9, Math.floor((10 * acc) / this.homes)) + 1);
        acc += this.homesOf[i]!;
      }
    }
    return this.deciles.get(code);
  }

  get highest(): Valued {
    return this.valuedAt(this.valuedCount - 1);
  }

  get lowest(): Valued {
    return this.valuedAt(0);
  }

  /** The area at the median, weighted by homes: the middle of England. */
  get middle(): Valued {
    const target = 0.5 * this.homes;
    let k = 0;
    while (this.cumulative[k]! < target) k++;
    return this.valuedAt(k);
  }

  /** Homes in each of `n` equal steps of log rate between `lo` and `hi`. */
  bins(lo: number, hi: number, n: number): number[] {
    const out = new Array<number>(n).fill(0);
    for (const i of this.order) out[binOf(this.rates[i]!, lo, hi, n)]! += this.homesOf[i]!;
    return out;
  }

  /** The valued areas of one council, lowest rate first. */
  inCouncil(code: string): Valued[] {
    const c = this.file.councils.findIndex(([cc]) => cc === code);
    const out: Valued[] = [];
    for (const i of this.order) if (this.file.council[i] === c) out.push(this.at(i) as Valued);
    return out;
  }

  /** Homes in each band across a whole council, valued or not. */
  homesByBandIn(code: string): number[] {
    const c = this.file.councils.findIndex(([cc]) => cc === code);
    const sum = new Array<number>(8).fill(0);
    this.file.council.forEach((ci, i) => {
      if (ci !== c) return;
      const stored = this.file.bands[i]!;
      for (let b = 0; b < 8; b++) sum[b]! += homesIn(stored[b]!);
    });
    return sum;
  }
}

export function binOf(rate: number, lo: number, hi: number, n: number): number {
  const k = Math.floor(((Math.log(rate) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * n);
  return Math.min(n - 1, Math.max(0, k));
}
