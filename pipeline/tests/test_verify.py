"""The verification gate, and a twin for every check proving it can fail."""

from __future__ import annotations

import dataclasses
import functools

import pytest

from bandd import sources, verify
from bandd.bands import NINTHS

PERIODS = ["ye_2020_12", "ye_2021_12", "ye_2022_03", "ye_2023_03"]


@functools.lru_cache(maxsize=None)
def tax_base():
    return sources.load_tax_base()


@functools.lru_cache(maxsize=None)
def stock():
    return sources.load_stock()


@functools.lru_cache(maxsize=None)
def price_comparison():
    ons = sources.load_ons_medians()
    out = {}
    for p in PERIODS:
        sales = sources.load_sales(p)
        published = {a: m[p] for a, m in ons.items() if p in m}
        out[p] = verify.compare_prices(sales, published)
    return out


# 1. band ratios -----------------------------------------------------------

def test_band_ratios_rebuild_every_council():
    r = verify.check_band_ratios(tax_base())
    assert r.passed, r.summary
    assert r.detail["cells"] == 296 * 9


@pytest.mark.parametrize("band,wrong", [("H", 16), ("A", 5), ("E", 12)])
def test_band_ratios_twin_catches_a_wrong_ratio(band, wrong):
    ninths = dict(NINTHS, **{band: wrong})
    assert not verify.check_band_ratios(tax_base(), ninths=ninths).passed


def test_band_ratios_twin_catches_linear_bands():
    # the intuitive but wrong assumption that bands step up evenly
    linear = {b: 9 + (i - 3) for i, b in enumerate("ABCDEFGH")}
    assert not verify.check_band_ratios(tax_base(), ninths=linear).passed


# 2. council charges -------------------------------------------------------

def test_council_charges_add_up():
    r = verify.check_council_charges(sources.load_charges())
    assert r.passed, r.summary
    assert r.detail["councils"] == 296


def test_council_charges_twin_catches_a_missing_precept():
    charges = sources.load_charges()
    broken = dict(charges)
    code = next(iter(broken))
    broken[code] = dataclasses.replace(broken[code], band_d_majors=0.0)
    assert not verify.check_council_charges(broken).passed


# 3. homes by band ---------------------------------------------------------

def test_valuation_list_agrees_with_tax_base():
    areas, councils = stock()
    r = verify.check_homes_by_band(councils, tax_base())
    assert r.passed, r.summary
    assert r.detail["councils"] == 296


def test_homes_by_band_twin_catches_a_misaligned_column():
    # shift every VOA count one band up, as a misread header would
    areas, councils = stock()
    shifted = {}
    for code, s in councils.items():
        bands = list(s.counts)
        moved = {bands[i]: s.counts[bands[i - 1]] if i else 0.0 for i in range(len(bands))}
        shifted[code] = dataclasses.replace(s, counts=moved)
    r = verify.check_homes_by_band(shifted, tax_base())
    assert r.detail["median_band_share_gap"] > 5


# 4. house prices ----------------------------------------------------------

def test_price_rebuild_matches_ons_and_decays_with_recency():
    r = verify.check_prices(price_comparison())
    assert r.passed, r.summary


def test_price_twin_catches_the_mean_used_as_a_median():
    comparison = {}
    ons = sources.load_ons_medians()
    for p in PERIODS:
        sales = sources.load_sales(p)
        # pad each area with its own mean so the median becomes a mean-like value
        skewed = {a: v + [int(sum(v) / len(v))] * len(v) * 2 for a, v in sales.items()}
        published = {a: m[p] for a, m in ons.items() if p in m}
        comparison[p] = verify.compare_prices(skewed, published)
    assert not verify.check_prices(comparison).passed


def test_price_twin_catches_a_broken_recency_pattern():
    by = dict(price_comparison())
    reordered = {p: by[q] for p, q in zip(PERIODS, reversed(PERIODS))}
    assert not verify.check_prices(reordered).passed
