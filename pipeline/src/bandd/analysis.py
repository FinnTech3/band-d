"""What council tax takes, measured against what homes are worth.

The unit throughout is pounds of council tax a year for every £1,000 of home
value. It reads the same for a flat in Hartlepool and a house in Chelsea, which
is the point: the tax is levied on property, so the natural question is how much
of each pound of property it takes.

For each small area (a 2021 LSOA, around 700 homes):

    average bill  = the council's total Band D bill x the area's average band ratio
    typical home  = the median price of homes sold there in 2025 (category A sales)
    rate          = 1000 x average bill / typical home

The median is used for anything said about a single area, because a small area
has only a few dozen sales a year and one of them can be enormous: Westminster
019E's 2025 mean is pulled to £6.0m by a single £34m sale, while its median is
£2.55m. For England as a whole and for its tenths, the rate is total council
tax over total housing value, built from means, where no single sale moves the
answer and a ratio of totals is the honest summary.

Bands the VOA suppresses (between one and four homes) are counted as 2.5 homes,
the middle of that range. `suppressed_as` exists so the report can show that 1
or 4 change nothing that matters.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .bands import BANDS, NINTHS
from .prices import mean_by_area, median_by_area
from .sources import AreaStock, CouncilCharge


def add_up(xs) -> float:
    """Add up left to right, one at a time, as the app does.

    Python 3.12's sum() compensates for rounding and 3.11's does not, so the
    last digit of a sum would otherwise depend on the Python version, and the
    app could no longer match the pipeline to the bit.
    """
    out = 0.0
    for x in xs:
        out += x
    return out


SUPPRESSED_AS = 2.5


@dataclass(frozen=True)
class Area:
    code: str
    name: str
    council: str
    council_name: str
    homes: float
    band_counts: dict[str, float]
    band_d: float           # council's total Band D bill, 2026-27
    mean_ratio: float       # average band ratio of the area's homes (Band D = 1)
    bill: float             # average bill per home, 2026-27
    sales: int
    mean_price: float
    median_price: float

    @property
    def rate(self) -> float:
        """Pounds of council tax a year per £1,000 of the typical home's value."""
        return 1000 * self.bill / self.median_price

    @property
    def rate_mean(self) -> float:
        """The same against the mean sale price; used only as a robustness check."""
        return 1000 * self.bill / self.mean_price


def build_areas(stock: dict[str, AreaStock], authority: dict[str, str],
                charges: dict[str, CouncilCharge], sales: dict[str, list[int]],
                suppressed_as: float = SUPPRESSED_AS) -> tuple[list[Area], dict]:
    """Every English small area with enough sales to value, plus what was left out."""
    means, medians = mean_by_area(sales), median_by_area(sales)
    out: list[Area] = []
    skipped = {"too_few_sales": 0, "too_few_sales_homes": 0.0}
    for code, st in stock.items():
        if not code.startswith("E01"):
            continue
        counts = {b: st.counts[b] + (suppressed_as if b in st.suppressed else 0.0) for b in BANDS}
        homes = add_up(counts.values())
        if code not in means:
            skipped["too_few_sales"] += 1
            skipped["too_few_sales_homes"] += homes
            continue
        council = charges[authority[code]]
        mean_ratio = add_up(counts[b] * NINTHS[b] / 9 for b in BANDS) / homes
        out.append(Area(
            code=code, name=st.name, council=council.code, council_name=council.name,
            homes=homes, band_counts=counts, band_d=council.band_d_area,
            mean_ratio=mean_ratio, bill=council.band_d_area * mean_ratio,
            sales=len(sales[code]), mean_price=means[code], median_price=medians[code],
        ))
    return out, skipped


# --------------------------------------------------------------------------
# summaries

def weighted_quantile(values: list[tuple[float, float]], q: float) -> float:
    """Quantile of (value, weight) pairs, weighting each area by its homes."""
    ordered = sorted(values)
    total = add_up(w for _, w in ordered)
    target, acc = q * total, 0.0
    for v, w in ordered:
        acc += w
        if acc >= target:
            return v
    return ordered[-1][0]


def national_rate(areas: list[Area]) -> float:
    """All council tax in the analysed areas over all housing value, per £1,000."""
    tax = add_up(a.bill * a.homes for a in areas)
    value = add_up(a.mean_price * a.homes for a in areas)
    return 1000 * tax / value


def by_value_decile(areas: list[Area], groups: int = 10) -> list[dict]:
    """Areas sorted by typical home value, cut into groups holding equal numbers
    of homes, each summarised as total tax over total value.

    Areas with the same median are ordered by code, so which group an area on
    a boundary lands in does not depend on the order the source file lists them.
    """
    ordered = sorted(areas, key=lambda a: (a.median_price, a.code))
    total = add_up(a.homes for a in ordered)
    buckets: list[list[Area]] = [[] for _ in range(groups)]
    acc = 0.0
    for a in ordered:
        buckets[min(groups - 1, int(groups * acc / total))].append(a)
        acc += a.homes
    out = []
    for i, b in enumerate(buckets, 1):
        homes = add_up(a.homes for a in b)
        tax = add_up(a.bill * a.homes for a in b)
        value = add_up(a.mean_price * a.homes for a in b)
        out.append({
            "decile": i, "areas": len(b), "homes": homes,
            "average_bill": tax / homes, "average_value": value / homes,
            "rate": 1000 * tax / value,
        })
    return out


def decompose(areas: list[Area]) -> dict[str, float]:
    """Split the spread in rates into the three things that make a rate.

    log rate = log Band D + log mean band ratio - log home value (+ a constant)

    so the variance of log rate is exactly the sum of its covariances with each
    term. Each covariance over the variance is that term's share of the spread,
    and the three shares add to one. Weighted by homes.
    """
    w = [a.homes for a in areas]
    W = add_up(w)
    cols = {
        "rate": [math.log(a.rate) for a in areas],
        "band_d": [math.log(a.band_d) for a in areas],
        "band_mix": [math.log(a.mean_ratio) for a in areas],
        "value": [-math.log(a.median_price) for a in areas],
    }
    means = {k: add_up(x * wi for x, wi in zip(v, w)) / W for k, v in cols.items()}

    def cov(x: str, y: str) -> float:
        return add_up(wi * (a - means[x]) * (b - means[y]) for a, b, wi in zip(cols[x], cols[y], w)) / W

    var = cov("rate", "rate")
    return {
        "variance_log_rate": var,
        "council_band_d": cov("rate", "band_d") / var,
        "band_mix": cov("rate", "band_mix") / var,
        "home_value": cov("rate", "value") / var,
    }


def proportional(areas: list[Area]) -> dict:
    """What a revenue-neutral flat charge on value would do. Arithmetic only.

    Same total raised from the same areas, but each home charged the national
    rate on its value. Reports how many homes would pay less and the typical
    change at each end, not whether anyone should want it.
    """
    rate = national_rate(areas) / 1000
    lower = higher = 0.0
    changes = []
    for a in areas:
        new_bill = rate * a.mean_price
        changes.append((a.mean_price, new_bill - a.bill, a.homes))
        if new_bill < a.bill:
            lower += a.homes
        else:
            higher += a.homes
    homes = lower + higher
    by_decile = []
    ordered = sorted(changes, key=lambda c: c[0])
    acc, groups = 0.0, [[] for _ in range(10)]
    for price, change, h in ordered:
        groups[min(9, int(10 * acc / homes))].append((change, h))
        acc += h
    for i, g in enumerate(groups, 1):
        hh = add_up(h for _, h in g)
        by_decile.append({"decile": i, "average_change": add_up(c * h for c, h in g) / hh})
    return {"rate_per_1000": rate * 1000, "share_paying_less": lower / homes, "by_decile": by_decile}


def councils(areas: list[Area]) -> list[dict]:
    """Each council's own rate, from its areas, sorted from highest to lowest."""
    agg: dict[str, dict] = {}
    for a in areas:
        c = agg.setdefault(a.council, {"code": a.council, "name": a.council_name, "band_d": a.band_d,
                                        "homes": 0.0, "tax": 0.0, "value": 0.0})
        c["homes"] += a.homes
        c["tax"] += a.bill * a.homes
        c["value"] += a.mean_price * a.homes
    out = []
    for c in agg.values():
        out.append({**c, "average_bill": c["tax"] / c["homes"], "average_value": c["value"] / c["homes"],
                    "rate": 1000 * c["tax"] / c["value"]})
    return sorted(out, key=lambda c: -c["rate"])
