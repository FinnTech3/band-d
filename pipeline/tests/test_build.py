"""The app's data must hold enough to rebuild every area's rate exactly."""

from __future__ import annotations

import functools

from bandd import build, study
from bandd.analysis import SUPPRESSED_AS
from bandd.bands import NINTHS

ORDER = "ABCDEFGH"


@functools.lru_cache(maxsize=None)
def payload() -> dict:
    return build.areas_payload()


def rebuilt_rates(p: dict, suppressed_as: float = SUPPRESSED_AS) -> dict[str, float]:
    """The arithmetic the app does, written out a second time from the stored columns."""
    out, number = {}, 0
    for i, step in enumerate(p["code_step"]):
        number += step
        if p["median"][i] is None:
            continue
        counts = [suppressed_as if n == -1 else 10.0 * n for n in p["bands"][i]]
        homes = sum(counts)
        ratio = sum(c * NINTHS[b] / 9 for c, b in zip(counts, ORDER)) / homes
        band_d = p["councils"][p["council"][i]][2]
        out[f"E{number:08d}"] = 1000 * (band_d * ratio) / p["median"][i]
    return out


def test_every_area_in_england_is_stored_once():
    p = payload()
    assert len(p["code_step"]) == 33_755
    assert all(s > 0 for s in p["code_step"])


def test_stored_columns_rebuild_every_rate_exactly():
    areas = {a.code: a.rate for a in study.run()["areas"]}
    rebuilt = rebuilt_rates(payload())
    assert rebuilt.keys() == areas.keys()
    assert all(rebuilt[c] == areas[c] for c in areas)


def test_twin_the_wrong_suppression_rule_does_not_rebuild_them():
    areas = {a.code: a.rate for a in study.run()["areas"]}
    rebuilt = rebuilt_rates(payload(), suppressed_as=0.0)
    assert sum(1 for c in areas if rebuilt[c] != areas[c]) > 10_000
