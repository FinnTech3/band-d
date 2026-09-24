#!/usr/bin/env python3
"""Turn HM Land Registry sales into the small-area files the analysis reads.

The Price Paid files run to hundreds of megabytes a year and the postcode
lookup to nearly a gigabyte, too large to commit and too slow to fetch on every
test run. This script reads them once and writes, for each period, the one thing
the analysis needs: every sale's price and the small area it happened in.

    data/derived/sales_<period>.csv.gz     lsoa21cd,price  (one row per sale)
    data/derived/lsoa21_lad25.csv          which local authority each area is in
    data/derived/MANIFEST.json             source files, their SHA-256, counts

The rules follow the ONS small-area house price statistics, so that the output
can be checked against the ONS's own published medians:

  - category A sales only (a standard sale at full market value); category B
    covers repossessions, buy-to-let purchases and transfers to companies,
    and including it moves the medians away from the published ones
  - records flagged D (deleted) are dropped
  - each sale is placed in an area by its postcode, through the ONS National
    Statistics Postcode Lookup

Usage:
    python3 scripts/build_prices.py --raw data/raw

where data/raw holds pp-2020.csv ... pp-2025.csv and the NSPL zip. The download
addresses are in docs/SOURCES.md. Sales whose postcode is not in the lookup are
counted and reported rather than guessed.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import sys
import zipfile

# The periods the analysis uses. The first four exist to check the method
# against the ONS; the last is the one the findings are built on.
PERIODS = {
    "ye_2020_12": ("2020-01", "2020-12"),
    "ye_2021_12": ("2021-01", "2021-12"),
    "ye_2022_03": ("2021-04", "2022-03"),
    "ye_2023_03": ("2022-04", "2023-03"),
    "ye_2025_12": ("2025-01", "2025-12"),
}

NSPL_MEMBER = "Data/NSPL_MAY_2026_UK.csv"


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def load_postcode_lookup(nspl_zip: str) -> tuple[dict[str, str], dict[str, str]]:
    """Postcode to 2021 LSOA, and LSOA to local authority, England and Wales.

    LSOAs nest inside local authorities, so every postcode in an area names the
    same authority. A disagreement would mean the lookup is not what it claims
    to be, so it stops rather than picking one.
    """
    lookup: dict[str, str] = {}
    authority: dict[str, str] = {}
    with zipfile.ZipFile(nspl_zip) as z, z.open(NSPL_MEMBER) as f:
        reader = csv.reader(io.TextIOWrapper(f, encoding="utf-8"))
        header = next(reader)
        i_pc, i_lsoa, i_lad = header.index("pcds"), header.index("lsoa21cd"), header.index("lad25cd")
        for row in reader:
            code = row[i_lsoa]
            if code.startswith(("E01", "W01")):
                lookup[row[i_pc]] = code
                seen = authority.setdefault(code, row[i_lad])
                if seen != row[i_lad]:
                    raise ValueError(f"{code} sits in both {seen} and {row[i_lad]}")
    return lookup, authority


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--raw", default="data/raw")
    parser.add_argument("--out", default="data/derived")
    args = parser.parse_args()

    nspl = os.path.join(args.raw, "nspl_may_2026.zip")
    years = sorted({int(lo[:4]) for lo, _ in PERIODS.values()} |
                   {int(hi[:4]) for _, hi in PERIODS.values()})
    files = {y: os.path.join(args.raw, f"pp-{y}.csv") for y in years}
    for path in [nspl, *files.values()]:
        if not os.path.exists(path):
            print(f"missing {path}; see docs/SOURCES.md for the download", file=sys.stderr)
            return 1

    lookup, authority = load_postcode_lookup(nspl)
    sales: dict[str, list[tuple[str, int]]] = {p: [] for p in PERIODS}
    counts = {p: {"category_a": 0, "unmatched_postcode": 0} for p in PERIODS}

    for year, path in files.items():
        with open(path, encoding="latin-1", newline="") as f:
            for row in csv.reader(f):
                # price, date, postcode, ..., category (col 14), record status (col 15)
                if row[14] != "A" or row[15] == "D":
                    continue
                month = row[2][:7]
                for period, (lo, hi) in PERIODS.items():
                    if lo <= month <= hi:
                        counts[period]["category_a"] += 1
                        area = lookup.get(row[3])
                        if area is None:
                            counts[period]["unmatched_postcode"] += 1
                        else:
                            sales[period].append((area, int(row[1])))

    os.makedirs(args.out, exist_ok=True)
    manifest = {
        "rules": "category A only, deleted records dropped, placed by NSPL May 2026 postcode",
        "sources": {os.path.basename(p): sha256(p) for p in [nspl, *files.values()]},
        "periods": {},
    }
    for period, rows in sales.items():
        rows.sort()
        out = os.path.join(args.out, f"sales_{period}.csv.gz")
        # mtime=0 so the same input always produces byte-identical output
        with open(out, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
            gz.write(b"lsoa21cd,price\n")
            gz.write("".join(f"{a},{p}\n" for a, p in rows).encode())
        manifest["periods"][period] = {
            "months": list(PERIODS[period]),
            "sales_written": len(rows),
            **counts[period],
        }
        print(f"{period}: {len(rows):,} sales, "
              f"{counts[period]['unmatched_postcode']:,} without a matching postcode")

    with open(os.path.join(args.out, "lsoa21_lad25.csv"), "w", newline="") as f:
        f.write("lsoa21cd,lad25cd\n")
        f.writelines(f"{a},{authority[a]}\n" for a in sorted(authority))

    with open(os.path.join(args.out, "MANIFEST.json"), "w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
