// The sentences the page writes about a reader's area. Kept apart from the
// components so they can be tested for every kind of area, including the two
// ends of England, where the usual phrasing would be wrong.

import type { England, Valued } from "./england";
import { gbp, pctDown, relative } from "./format";

export function standing(a: Valued, e: England): string {
  if (a.code === e.highest.code) return "The highest rate of any area in England.";
  if (a.code === e.lowest.code) return "The lowest rate of any area in England.";
  const below = e.shareBelow(a.rate);
  const above = e.shareAbove(a.rate);
  return below >= above
    ? `Homes here pay more for what they are worth than ${pctDown(below)} of homes in England.`
    : `Homes here pay less for what they are worth than ${pctDown(above)} of homes in England.`;
}

/** The area at the other end of England from this one. */
export function counterpart(a: Valued, e: England): Valued {
  if (a.code === e.lowest.code) return e.highest;
  return a.rate >= e.middle.rate ? e.lowest : e.highest;
}

export function comparison(a: Valued, e: England): string {
  const o = counterpart(a, e);
  return (
    `The typical home in ${o.name} sold for ${gbp(o.median)}, ${relative(o.median, a.median)}. ` +
    `Its average bill is ${gbp(o.bill)}, ${relative(o.bill, a.bill)}.`
  );
}
