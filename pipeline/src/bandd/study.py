"""Run everything once and return every number the write-up, figures and app use.

report.py prints from this, scripts/make_figures.py draws from it and build.py
writes the app's data from it, so a number cannot mean one thing in the README
and another in a chart.
"""

from __future__ import annotations

import functools

from . import analysis, sources, verify

CURRENT = "ye_2025_12"
CHECK_PERIODS = ["ye_2020_12", "ye_2021_12", "ye_2022_03", "ye_2023_03"]


@functools.lru_cache(maxsize=None)
def run() -> dict:
    stock, councils_stock = sources.load_stock()
    authority = sources.load_area_authority()
    charges = sources.load_charges()
    tax_base = sources.load_tax_base()

    ons = sources.load_ons_medians()
    price_checks = {}
    for p in CHECK_PERIODS:
        published = {a: m[p] for a, m in ons.items() if p in m}
        price_checks[p] = verify.compare_prices(sources.load_sales(p), published)

    checks = [
        verify.check_band_ratios(tax_base),
        verify.check_council_charges(charges),
        verify.check_homes_by_band(councils_stock, tax_base),
        verify.check_prices(price_checks),
    ]

    areas, skipped = analysis.build_areas(stock, authority, charges, sources.load_sales(CURRENT))
    rates = [(a.rate, a.homes) for a in areas]
    by_rate = sorted(areas, key=lambda a: a.rate)
    deciles = analysis.by_value_decile(areas)
    robustness = {}
    for label, n in (("suppressed_as_1", 1.0), ("suppressed_as_4", 4.0)):
        alt, _ = analysis.build_areas(stock, authority, charges, sources.load_sales(CURRENT), suppressed_as=n)
        d = analysis.by_value_decile(alt)
        robustness[label] = {"cheapest": d[0]["rate"], "dearest": d[-1]["rate"]}
    mean_rates = [(a.rate_mean, a.homes) for a in areas]
    robustness["mean_price"] = {
        "p10": analysis.weighted_quantile(mean_rates, 0.1),
        "p50": analysis.weighted_quantile(mean_rates, 0.5),
        "p90": analysis.weighted_quantile(mean_rates, 0.9),
    }

    return {
        "checks": checks,
        "price_checks": price_checks,
        "areas": areas,
        "skipped": skipped,
        "homes_covered": sum(a.homes for a in areas),
        "national_rate": analysis.national_rate(areas),
        "quantiles": {q: analysis.weighted_quantile(rates, q) for q in (0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99)},
        "lowest": by_rate[:5],
        "highest": by_rate[-5:][::-1],
        "deciles": deciles,
        "decomposition": analysis.decompose(areas),
        "proportional": analysis.proportional(areas),
        "councils": analysis.councils(areas),
        "robustness": robustness,
        "charges": charges,
    }


def all_checks_pass() -> bool:
    return all(c.passed for c in run()["checks"])
