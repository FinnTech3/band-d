// How a rate becomes a colour on the map. Distance from England's rate is
// measured by multiples, not pounds, because the two ends are over a hundred
// times apart: an area paying half England's rate is as far to the blue side
// as one paying double is to the red. Anything past 3.3 times either way
// takes the end colour, which only 1% of homes reach at each end.

export const STEPS = 129;
export const MIDDLE = (STEPS - 1) / 2;
export const SPAN = Math.log(3.3);

export type RGB = [number, number, number];

/** Where a rate sits between the two ends, from -1 (blue) through 0 to 1 (red). */
export function lean(rate: number, national: number): number {
  const t = Math.log(rate / national) / SPAN;
  return t < -1 ? -1 : t > 1 ? 1 : t;
}

/** The colour step for a rate, 0 to STEPS - 1, with England's own rate in the middle. */
export function stepOf(rate: number, national: number): number {
  return Math.round(((lean(rate, national) + 1) / 2) * (STEPS - 1));
}

/**
 * The colour of every step. The ends are reached on a gentle curve, so the
 * areas close to England's rate stay close to the neutral colour rather than
 * turning half blue at the first step.
 */
export function ramp(lo: RGB, mid: RGB, hi: RGB): string[] {
  const out: string[] = [];
  for (let s = 0; s < STEPS; s++) {
    const t = s / MIDDLE - 1;
    const a = Math.abs(t) ** 0.75;
    const end = t < 0 ? lo : hi;
    const c = mid.map((m, j) => Math.round(m + (end[j]! - m) * a));
    out.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  return out;
}

export function rgb(hex: string): RGB {
  const h = hex.trim().replace("#", "");
  return [0, 2, 4].map((j) => parseInt(h.slice(j, j + 2), 16)) as RGB;
}

/**
 * An area's rate part of the way from today's bands to a flat charge on
 * value, as the revalue slider draws it: each bill moves in a straight line
 * from what it is now to England's rate times the home's value.
 */
export function towardsFlat(rate: number, national: number, t: number): number {
  return (1 - t) * rate + t * national;
}
