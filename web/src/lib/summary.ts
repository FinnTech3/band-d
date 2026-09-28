// The national figures, as data/built/summary.json holds them.

export interface Check {
  name: string;
  passed: boolean;
  summary: string;
  detail: Record<string, number | string | boolean>;
}

export interface Decile {
  decile: number;
  areas: number;
  homes: number;
  average_bill: number;
  average_value: number;
  rate: number;
}

export interface CouncilSummary {
  code: string;
  name: string;
  band_d: number;
  homes: number;
  average_bill: number;
  average_value: number;
  rate: number;
}

export interface Extreme {
  code: string;
  name: string;
  council: string;
  rate: number;
  bill: number;
  median_price: number;
  sales: number;
}

export interface PriceCheck {
  areas: number;
  exact_share: number;
  median_abs_gap: number;
  p90_abs_gap: number;
}

export interface Proportional {
  rate_per_1000: number;
  share_paying_less: number;
  by_decile: { decile: number; average_change: number }[];
}

export interface Summary {
  period: string;
  areas: number;
  homes: number;
  skipped: { too_few_sales: number; too_few_sales_homes: number };
  national_rate: number;
  quantiles: Record<string, number>;
  deciles: Decile[];
  highest: Extreme[];
  lowest: Extreme[];
  councils: CouncilSummary[];
  proportional: Proportional;
  checks: Check[];
  price_checks: Record<string, PriceCheck>;
}
