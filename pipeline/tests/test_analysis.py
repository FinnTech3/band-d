"""The analysis arithmetic, on small hand-built cases and on the real run."""

from __future__ import annotations

import math

import pytest

from bandd import analysis, bands, study
from bandd.sources import AreaStock, CouncilCharge


def charge(code: str, band_d: float) -> CouncilCharge:
    return CouncilCharge(code, code, 0.0, 0.0, band_d, 0.0, band_d)


def stock(code: str, **counts: float) -> AreaStock:
    c = {b: float(counts.get(b, 0)) for b in bands.BANDS}
    return AreaStock(code, code, c, (), sum(c.values()))


def test_bill_follows_the_statutory_ninths():
    assert bands.bill("A", 1800) == pytest.approx(1200)
    assert bands.bill("H", 1800) == pytest.approx(3600)
    assert bands.band_d_equivalents({"A": 9, "H": 9}) == pytest.approx(6 + 18)


def test_area_bill_is_the_band_weighted_average():
    areas, skipped = analysis.build_areas(
        {"E01000001": stock("E01000001", A=50, H=50)},
        {"E01000001": "X"}, {"X": charge("X", 900.0)},
        {"E01000001": [100_000] * 5},
    )
    a = areas[0]
    assert a.mean_ratio == pytest.approx((6 + 18) / 9 / 2)
    assert a.bill == pytest.approx(900 * 4 / 3)
    assert a.rate == pytest.approx(1000 * 1200 / 100_000)
    assert skipped["too_few_sales"] == 0


def test_areas_with_fewer_than_five_sales_are_left_out_and_counted():
    areas, skipped = analysis.build_areas(
        {"E01000001": stock("E01000001", D=100)}, {"E01000001": "X"}, {"X": charge("X", 1000.0)},
        {"E01000001": [200_000] * 4},
    )
    assert areas == [] and skipped["too_few_sales"] == 1 and skipped["too_few_sales_homes"] == 100


def test_decomposition_shares_add_to_one():
    d = study.run()["decomposition"]
    assert d["council_band_d"] + d["band_mix"] + d["home_value"] == pytest.approx(1.0, abs=1e-9)


def test_flat_charge_raises_the_same_total():
    r = study.run()
    rate = r["proportional"]["rate_per_1000"] / 1000
    now = sum(a.bill * a.homes for a in r["areas"])
    flat = sum(rate * a.mean_price * a.homes for a in r["areas"])
    assert math.isclose(now, flat, rel_tol=1e-12)


def test_deciles_hold_equal_shares_of_homes():
    d = study.run()["deciles"]
    homes = [x["homes"] for x in d]
    assert max(homes) / min(homes) < 1.01


def test_the_finding_is_not_an_artefact_of_suppressed_bands():
    rb = study.run()["robustness"]
    assert abs(rb["suppressed_as_1"]["cheapest"] - rb["suppressed_as_4"]["cheapest"]) < 0.2
    assert abs(rb["suppressed_as_1"]["dearest"] - rb["suppressed_as_4"]["dearest"]) < 0.2


def test_findings_are_only_produced_on_verified_sources():
    assert study.all_checks_pass()
