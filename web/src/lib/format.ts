// Numbers as the page prints them. British conventions throughout.

export function gbp(x: number, dp = 0): string {
  const s = Math.abs(x).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (x < 0 ? "-£" : "£") + s;
}

/** A share as a percentage, rounded down so "more than 99.9%" is never a rounded-up 100%. */
export function pctDown(share: number, dp = 1): string {
  const f = 10 ** dp;
  return (Math.floor(share * 100 * f) / f).toFixed(dp) + "%";
}

const FRACTIONS = [
  "",
  "",
  "half",
  "a third",
  "a quarter",
  "a fifth",
  "a sixth",
  "a seventh",
  "an eighth",
  "a ninth",
  "a tenth",
];

/**
 * How one amount compares with another, in words a reader says out loud:
 * "17 times as much", "22% more", "about a seventh as much". Worded without
 * "yours", so it reads right whether the reader found their own area or is
 * looking at someone else's.
 */
export function relative(other: number, base: number): string {
  const r = other / base;
  if (r >= 1.95) return `${r >= 10 ? Math.round(r) : r.toFixed(1)} times as much`;
  if (r >= 1.05) return `${Math.round((r - 1) * 100)}% more`;
  if (r > 0.95) return "about the same";
  if (r > 0.5) return `${Math.round((1 - r) * 100)}% less`;
  const n = Math.round(1 / r);
  return n > 10 ? "less than a tenth as much" : `about ${FRACTIONS[n]} as much`;
}
