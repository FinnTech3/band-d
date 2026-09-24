#!/usr/bin/env python3
"""Pull the columns the price check needs out of ONS HPSSA dataset 46.

The ONS publishes small-area median prices as a 28 MB legacy .xls workbook. The
check only needs four of its 110 period columns, so this keeps those and writes
a small CSV the tests can read without a spreadsheet library.

    python3 scripts/extract_hpssa.py data/raw/hpssa46/*.xls

Needs xlrd (pip install xlrd), which is the only reason this is a script and
not part of the package.
"""

from __future__ import annotations

import csv
import sys

import xlrd

COLUMNS = {
    "Year ending Dec 2020": "ye_2020_12",
    "Year ending Dec 2021": "ye_2021_12",
    "Year ending Mar 2022": "ye_2022_03",
    "Year ending Mar 2023": "ye_2023_03",
}


def main(path: str, out: str = "data/sources/hpssa46_median_by_lsoa.csv") -> int:
    sheet = xlrd.open_workbook(path, on_demand=True).sheet_by_name("1a")
    header = sheet.row_values(5)
    index = {key: header.index(label) for label, key in COLUMNS.items()}
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lsoa11cd", *index])
        for i in range(6, sheet.nrows):
            row = sheet.row_values(i)
            # ":" marks fewer than five sales; keep it as an empty cell
            values = [row[j] if isinstance(row[j], float) else "" for j in index.values()]
            w.writerow([row[2], *(f"{v:.1f}" if v != "" else "" for v in values)])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
