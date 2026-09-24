"""Load each source into plain Python structures, and nothing more.

Every loader here reads one committed file under data/, checks that it has the
shape it is expected to have, and returns dictionaries keyed by the official
area codes. Nothing is inferred or filled in at this stage; where a source
suppresses a value, the loader says so in its return value rather than choosing
a number for it.
"""

from __future__ import annotations

import csv
import gzip
import os
from dataclasses import dataclass

from .bands import BANDS
from .sheets import read_ods, read_xlsx

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCES = os.path.join(ROOT, "data", "sources")
DERIVED = os.path.join(ROOT, "data", "derived")

# The four kinds of billing authority in England. Rows in the MHCLG tables
# with any other code are regional or class subtotals.
AUTHORITY_PREFIXES = ("E06", "E07", "E08", "E09")


def _number(text: str) -> float | None:
    """A published value, or None where the source marks it missing."""
    text = text.strip().replace(",", "")
    if text in ("", "..", "[x]", "[z]", ":", "-"):
        return None
    return float(text)


# --------------------------------------------------------------------------
# VOA: homes on the valuation list, by band, for every small area

@dataclass(frozen=True)
class AreaStock:
    code: str
    name: str
    counts: dict[str, float]      # band -> homes, as published
    suppressed: tuple[str, ...]   # bands published as "-" (between one and four homes)
    total: float


def load_stock(path: str | None = None) -> tuple[dict[str, AreaStock], dict[str, AreaStock]]:
    """VOA Council Tax: stock of properties, 31 March 2025 (table CTSOP1.1).

    Returns (small areas, local authorities). The VOA rounds every count to the
    nearest ten and publishes "-" where a band holds between one and four homes.
    Those bands are recorded in `suppressed` with a count of zero here; how to
    treat them is an analysis decision, made and tested in analysis.py.
    """
    path = path or os.path.join(SOURCES, "CTSOP1_1_2025_03_31.csv")
    areas: dict[str, AreaStock] = {}
    authorities: dict[str, AreaStock] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            level = row["geography"]
            if level not in ("LSOA", "LAUA"):
                continue
            counts, suppressed = {}, []
            for b in BANDS:
                raw = row[f"band_{b.lower()}"]
                if raw == "-":
                    suppressed.append(b)
                counts[b] = _number(raw) or 0.0
            stock = AreaStock(row["ecode"], row["area_name"], counts, tuple(suppressed),
                              _number(row["all_properties"]) or 0.0)
            (areas if level == "LSOA" else authorities)[stock.code] = stock
    return areas, authorities


def load_area_authority(path: str | None = None) -> dict[str, str]:
    """2021 LSOA to local authority, derived from the ONS postcode lookup."""
    path = path or os.path.join(DERIVED, "lsoa21_lad25.csv")
    with open(path, newline="") as f:
        return {r["lsoa21cd"]: r["lad25cd"] for r in csv.DictReader(f)}


# --------------------------------------------------------------------------
# MHCLG: what each council charges, 2026-27

@dataclass(frozen=True)
class CouncilCharge:
    code: str
    name: str
    requirement: float          # line 1: council tax requirement incl. parishes, pounds
    tax_base: float             # line 7: Band D equivalents used to set the tax
    band_d_own: float           # line 8: the council's own Band D incl. parishes
    band_d_majors: float        # line 16: county, police, fire, combined authority
    band_d_area: float          # line 17: what a Band D home in the area pays in total


def load_charges(path: str | None = None) -> dict[str, CouncilCharge]:
    """MHCLG Council Tax levels set by local authorities, Table 10, 2026-27."""
    path = path or os.path.join(SOURCES, "Table_10_2026-27.ods")
    rows = read_ods(path)["Data_Billing"]
    header = rows[4]

    def col(prefix: str, current: bool = True) -> int:
        for i, h in enumerate(header):
            h = " ".join(h.split())
            if h.startswith(prefix) and ("(current year)" in h) == current:
                return i
        raise KeyError(prefix)

    i_req = col("1. Council Tax Requirement for billing authority")
    i_base = col("7. Council tax base for council tax setting")
    i_own = col("8. Average (Band D 2 Adult equivalent) council tax (including")
    i_area = next(i for i, h in enumerate(header) if " ".join(h.split()).startswith("17. Average"))
    i_majors = [i for i, h in enumerate(header) if " ".join(h.split()).startswith("16. Average")]
    if len(i_majors) != 4:
        raise ValueError(f"expected four major-preceptor columns, found {len(i_majors)}")

    charges = {}
    for r in rows[5:]:
        if len(r) < 3 or not r[1].startswith(AUTHORITY_PREFIXES):
            continue
        majors = sum(_number(r[i]) or 0.0 for i in i_majors)
        charges[r[1]] = CouncilCharge(
            code=r[1], name=r[2],
            requirement=_number(r[i_req]) or 0.0,
            tax_base=_number(r[i_base]) or 0.0,
            band_d_own=_number(r[i_own]) or 0.0,
            band_d_majors=majors,
            band_d_area=_number(r[i_area]) or 0.0,
        )
    return charges


# --------------------------------------------------------------------------
# MHCLG: the council tax base returns, October 2025

@dataclass(frozen=True)
class TaxBase:
    code: str
    name: str
    valuation_list: dict[str, float]         # table 1.01, homes by band
    dwellings_after_discounts: dict[str, float]  # table 1.26, incl. "A-" (disabled relief)
    band_d_equivalents: dict[str, float]     # table 1.27, as published
    band_d_equivalents_total: float


def load_tax_base(path: str | None = None) -> dict[str, TaxBase]:
    path = path or os.path.join(SOURCES, "2025_Local_Authority_Drop_Down.xlsx")
    rows = read_xlsx(path)["Council Taxbase Data"]
    titles, header = rows[4], rows[5]

    def block(table: str) -> int:
        for i, t in enumerate(titles):
            if t.startswith(table):
                return i
        raise KeyError(table)

    b101, b126, b127 = block("Table 1.01"), block("Table 1.26"), block("Table 1.27")
    # 1.26 and 1.27 open with the disabled-relief column, then A to H, then total
    if not header[b126].startswith("Band A entitled") or header[b126 + 9] != "Total":
        raise ValueError("table 1.26 is not laid out as expected")

    out = {}
    for r in rows[6:]:
        if len(r) < 5 or not r[1].startswith(AUTHORITY_PREFIXES):
            continue
        val = {b: _number(r[b101 + i]) or 0.0 for i, b in enumerate(BANDS)}
        after = {"A-": _number(r[b126]) or 0.0}
        after.update({b: _number(r[b126 + 1 + i]) or 0.0 for i, b in enumerate(BANDS)})
        equiv = {"A-": _number(r[b127]) or 0.0}
        equiv.update({b: _number(r[b127 + 1 + i]) or 0.0 for i, b in enumerate(BANDS)})
        out[r[1]] = TaxBase(r[1], r[3], val, after, equiv, _number(r[b127 + 9]) or 0.0)
    return out


# --------------------------------------------------------------------------
# House prices

def load_sales(period: str, path: str | None = None) -> dict[str, list[int]]:
    """Every category A sale in the period, grouped by 2021 LSOA."""
    path = path or os.path.join(DERIVED, f"sales_{period}.csv.gz")
    grouped: dict[str, list[int]] = {}
    with gzip.open(path, "rt", newline="") as f:
        reader = csv.reader(f)
        next(reader)
        for area, price in reader:
            grouped.setdefault(area, []).append(int(price))
    return grouped


def load_ons_medians(path: str | None = None) -> dict[str, dict[str, float]]:
    """ONS HPSSA dataset 46: published median price by 2011 LSOA, per period."""
    path = path or os.path.join(SOURCES, "hpssa46_median_by_lsoa.csv")
    out: dict[str, dict[str, float]] = {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            code = r.pop("lsoa11cd")
            out[code] = {k: float(v) for k, v in r.items() if v}
    return out
