#!/usr/bin/env python3
"""Download where people live in each small area, for the map.

The ONS publishes a population-weighted centroid for every 2021 LSOA in
England and Wales: the point the area's residents are gathered around, in
British National Grid metres. The map draws one dot per area at that point,
which puts dots where the homes are rather than in the middle of a field.

    python3 scripts/fetch_centroids.py

writes data/sources/lsoa21_pwc.csv (lsoa21cd,easting,northing), rounded to
the nearest 10 cm as the service returns them to more places than that. The
service hands back at most 2,000 rows at a time, so it is read in pages.
"""

from __future__ import annotations

import json
import os
import time
import urllib.request

SERVICE = ("https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
           "LSOA_PopCentroids_EW_2021_V4/FeatureServer/0/query")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "sources", "lsoa21_pwc.csv")


def page(offset: int) -> dict:
    url = (f"{SERVICE}?where=1%3D1&outFields=LSOA21CD&returnGeometry=true"
           f"&resultOffset={offset}&resultRecordCount=2000&orderByFields=FID&f=json")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return json.load(r)
        except (OSError, ValueError):
            time.sleep(2 ** (attempt + 1))
    raise SystemExit(f"the service did not answer at row {offset}")


def main() -> None:
    rows: dict[str, tuple[float, float]] = {}
    offset = 0
    while True:
        d = page(offset)
        feats = d.get("features", [])
        for f in feats:
            rows[f["attributes"]["LSOA21CD"]] = (round(f["geometry"]["x"], 1), round(f["geometry"]["y"], 1))
        if not d.get("exceededTransferLimit") and len(feats) < 2000:
            break
        offset += len(feats)
    with open(OUT, "w", newline="") as f:
        f.write("lsoa21cd,easting,northing\n")
        for code in sorted(rows):
            x, y = rows[code]
            f.write(f"{code},{x},{y}\n")
    print(f"{len(rows):,} areas, {sum(1 for c in rows if c.startswith('E01')):,} in England")


if __name__ == "__main__":
    main()
