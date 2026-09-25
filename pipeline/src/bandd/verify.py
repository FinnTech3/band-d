"""The checks that have to pass before anything in this project is interpreted.

Four of them, each against a figure somebody else published:

1. Band ratios. MHCLG publishes, for every council, homes by band after
   discounts (table 1.26) and the same homes converted to Band D equivalents
   (table 1.27). Rebuilding the second from the first with the statutory
   ninths, for all 296 councils, proves the band arithmetic here is the
   arithmetic councils use.

2. Council charges. Each council's total Band D bill (line 17) should be its
   own Band D (line 8) plus the precepts of the county, police, fire and
   combined authorities above it (line 16). If it is, the field this project
   reads as "what a Band D home pays" really is that.

3. Homes by band. The VOA's valuation list and the councils' own tax base
   returns count the same homes from two different administrative systems,
   six months apart. They should agree closely, and they do, which is the
   evidence that the small-area counts can be trusted.

4. House prices. Small-area medians rebuilt from HM Land Registry sales should
   reproduce the ONS's published small-area medians. They do not reproduce
   them exactly, and the way they fail is itself the check: agreement falls the
   more recent the period, which is the signature of sales registered after the
   ONS took its extract rather than of a method error.

Each check returns a Result carrying the numbers it was judged on, so a report
can print them and a test can assert on them. Each has a can-fail twin in the
tests.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field

from .bands import BANDS, DISABLED_A_NINTHS, NINTHS
from .prices import median_by_area
from .sources import AreaStock, CouncilCharge, TaxBase


@dataclass
class Result:
    name: str
    passed: bool
    summary: str
    detail: dict = field(default_factory=dict)


# 1 ------------------------------------------------------------------------

def check_band_ratios(tax_base: dict[str, TaxBase], ninths: dict[str, int] = NINTHS,
                      tolerance: float = 0.5) -> Result:
    """Rebuild table 1.27 from table 1.26 for every council and band.

    The published values are rounded to two decimals, and a few councils round
    per dwelling class before summing, so a band may differ from the rebuild by
    a few hundredths. Half a Band D equivalent is far below any real error: a
    wrong ratio moves a band by thousands.
    """
    worst, worst_at = 0.0, ""
    cells = 0
    for code, tb in tax_base.items():
        rebuilt = {"A-": tb.dwellings_after_discounts["A-"] * DISABLED_A_NINTHS / 9}
        rebuilt.update({b: tb.dwellings_after_discounts[b] * ninths[b] / 9 for b in BANDS})
        for key, value in rebuilt.items():
            gap = abs(value - tb.band_d_equivalents[key])
            cells += 1
            if gap > worst:
                worst, worst_at = gap, f"{tb.name} band {key}"
        total_gap = abs(sum(rebuilt.values()) - tb.band_d_equivalents_total)
        if total_gap > worst:
            worst, worst_at = total_gap, f"{tb.name} total"
    return Result(
        "band ratios",
        worst <= tolerance,
        f"{cells} council-band cells rebuilt; largest gap {worst:.2f} Band D equivalents ({worst_at})",
        {"cells": cells, "largest_gap": worst, "largest_gap_at": worst_at},
    )


# 2 ------------------------------------------------------------------------

def check_council_charges(charges: dict[str, CouncilCharge], tolerance: float = 0.015) -> Result:
    worst, worst_at = 0.0, ""
    for c in charges.values():
        gap = abs(c.band_d_own + c.band_d_majors - c.band_d_area)
        if gap > worst:
            worst, worst_at = gap, c.name
    return Result(
        "council charges",
        worst <= tolerance,
        f"{len(charges)} councils; line 8 + line 16 = line 17 to within £{worst:.2f} ({worst_at})",
        {"councils": len(charges), "largest_gap_pounds": worst, "largest_gap_at": worst_at},
    )


# 3 ------------------------------------------------------------------------

# Barnsley and Sheffield took new codes after a boundary change between them.
# The VOA table still uses the old ones.
RECODED = {"E08000038": "E08000016", "E08000039": "E08000019"}


def check_homes_by_band(voa: dict[str, AreaStock], tax_base: dict[str, TaxBase],
                        tolerance_pct: float = 1.0, share_required: float = 0.95,
                        band_share_points: float = 1.0) -> Result:
    """Compare the VOA's count of homes with the councils' own, council by council.

    The VOA rounds to tens and counts on 31 March 2025; the tax base returns are
    exact and count on 6 October 2025, so new homes built in between appear in
    one and not the other. The check is that almost every council agrees to
    within one per cent on total homes, and that for the typical council no
    band's share of homes differs by more than a percentage point. Totals alone
    would not notice bands read into the wrong columns; the band mix would.
    """
    gaps, mix_gaps = [], []
    for code, tb in tax_base.items():
        v = voa.get(code) or voa.get(RECODED.get(code, ""))
        if v is None:
            continue
        ctb_total = sum(tb.valuation_list.values())
        voa_total = sum(v.counts.values())
        gaps.append(100 * abs(voa_total - ctb_total) / ctb_total)
        # band mix: largest difference in any band's share of the stock
        mix_gaps.append(max(abs(100 * v.counts[b] / voa_total - 100 * tb.valuation_list[b] / ctb_total)
                            for b in BANDS))
    within = sum(1 for g in gaps if g <= tolerance_pct) / len(gaps)
    return Result(
        "homes by band",
        within >= share_required and statistics.median(mix_gaps) <= band_share_points,
        f"{len(gaps)} councils compared; {within:.1%} agree on total homes to within {tolerance_pct}%, "
        f"median gap {statistics.median(gaps):.2f}%, median largest band-share gap "
        f"{statistics.median(mix_gaps):.2f} points",
        {"councils": len(gaps), "share_within": within, "median_gap_pct": statistics.median(gaps),
         "median_band_share_gap": statistics.median(mix_gaps), "max_gap_pct": max(gaps)},
    )


# 4 ------------------------------------------------------------------------

def compare_prices(sales: dict[str, list[int]], published: dict[str, float]) -> dict:
    rebuilt = median_by_area(sales)
    common = [a for a in published if a in rebuilt]
    diffs = sorted(abs(rebuilt[a] - published[a]) for a in common)
    exact = sum(1 for d in diffs if d < 0.5)
    return {
        "areas": len(common),
        "exact_share": exact / len(common),
        "median_abs_gap": diffs[len(diffs) // 2],
        "p90_abs_gap": diffs[int(len(diffs) * 0.9)],
    }


def check_prices(by_period: dict[str, dict], exact_required: float = 0.8) -> Result:
    """Judge the price rebuild on the shape of its agreement with the ONS.

    `by_period` maps each period, oldest first, to compare_prices() output. A
    rebuild that is right in method but reads a later snapshot of the Land
    Registry than the ONS did should: match most areas to the pound in the
    oldest period, where late registrations have long since arrived, have a
    median gap of zero there, and agree less with every more recent period.
    A method error (the wrong sales, the wrong average) fails the first two
    whatever the period.
    """
    periods = list(by_period)
    oldest = by_period[periods[0]]
    shares = [by_period[p]["exact_share"] for p in periods]
    declining = all(a >= b for a, b in zip(shares, shares[1:]))
    passed = oldest["exact_share"] >= exact_required and oldest["median_abs_gap"] == 0 and declining
    lines = ", ".join(f"{p}: {r['exact_share']:.1%}" for p, r in by_period.items())
    return Result(
        "house prices",
        passed,
        f"{oldest['areas']} areas; {oldest['exact_share']:.1%} match the ONS median to the pound in "
        f"{periods[0]}, median gap £{oldest['median_abs_gap']:.0f}; exact share by period: {lines}",
        {"by_period": by_period, "declining": declining},
    )
