"""Write the data the web tool loads, from the same run the README quotes.

    PYTHONPATH=pipeline/src python3 -m bandd.build

Two files go to data/built/, and are copied into the app at build time:

areas.json
    Every small area in England, 33,755 of them, as the raw inputs rather than
    finished answers: the homes in each band, the council, and the number and
    median price of 2025 sales. The app works out bills, rates and
    ranks from these itself, so a reader's answer is computed in front of them
    by the same arithmetic analysis.py uses, and a test in the app checks that
    it lands on exactly the numbers below.

    It is stored column by column to keep it small. Area codes are stored as the
    gap from the previous code, because the codes run almost in sequence and a
    column of 1s compresses to nearly nothing. The VOA rounds every band to the
    nearest ten, so bands are stored in tens; a band published as "-" (one to
    four homes) is stored as -1, so the app can apply the same 2.5 rule.

summary.json
    The national figures, the ten value groups, each council's rate and the
    four verification results. The app shows these directly. The figures built
    from medians (every area's rate, the quantiles, the extremes) are
    recomputed by the app's tests from areas.json and must match exactly; the
    ones built from mean prices are not, because areas.json leaves the means
    out to stay small.

Refuses to write anything if a verification check fails.
"""

from __future__ import annotations

import json
import os
import sys

from . import sources
from .bands import BANDS
from .sources import DERIVED, ROOT
from .study import CURRENT, run

BUILT = os.path.join(ROOT, "data", "built")


def _num(x: float) -> float | int:
    """A number as JSON would most compactly hold it without losing anything."""
    return int(x) if float(x).is_integer() else x


def areas_payload() -> dict:
    r = run()
    stock, _ = sources.load_stock()
    authority = sources.load_area_authority()
    sales = sources.load_sales(CURRENT)
    council_codes = sorted(c["code"] for c in r["councils"])
    council_index = {c: i for i, c in enumerate(council_codes)}
    medians = {a.code: a.median_price for a in r["areas"]}

    prefixes: list[str] = []
    prefix_index: dict[str, int] = {}
    cols: dict[str, list] = {k: [] for k in ("code_step", "prefix", "suffix", "council", "bands",
                                              "sales", "median")}
    previous = 0
    for code in sorted(c for c in stock if c.startswith("E01")):
        st = stock[code]
        prefix, _, suffix = st.name.rpartition(" ")
        if prefix not in prefix_index:
            prefix_index[prefix] = len(prefixes)
            prefixes.append(prefix)
        number = int(code[1:])
        cols["code_step"].append(number - previous)
        previous = number
        cols["prefix"].append(prefix_index[prefix])
        cols["suffix"].append(suffix)
        cols["council"].append(council_index[authority[code]])
        cols["bands"].append([-1 if b in st.suppressed else int(st.counts[b]) // 10 for b in BANDS])
        cols["sales"].append(len(sales.get(code, [])))
        cols["median"].append(_num(medians[code]) if code in medians else None)

    charges = r["charges"]
    return {
        "period": CURRENT,
        "councils": [[c, charges[c].name, charges[c].band_d_area] for c in council_codes],
        "prefixes": prefixes,
        **cols,
    }


def summary_payload() -> dict:
    r = run()
    checks = []
    for c in r["checks"]:
        checks.append({"name": c.name, "passed": c.passed, "summary": c.summary,
                       "detail": {k: v for k, v in c.detail.items() if k != "by_period"}})
    price = r["price_checks"]

    def area(a) -> dict:
        return {"code": a.code, "name": a.name, "council": a.council_name, "rate": a.rate,
                "bill": a.bill, "median_price": a.median_price, "sales": a.sales}

    return {
        "period": CURRENT,
        "areas": len(r["areas"]),
        "homes": r["homes_covered"],
        "skipped": r["skipped"],
        "national_rate": r["national_rate"],
        "quantiles": {str(k): v for k, v in r["quantiles"].items()},
        "deciles": r["deciles"],
        "highest": [area(a) for a in r["highest"]],
        "lowest": [area(a) for a in r["lowest"]],
        "decomposition": r["decomposition"],
        "proportional": r["proportional"],
        "councils": [{k: c[k] for k in ("code", "name", "band_d", "homes", "average_bill", "average_value", "rate")}
                     for c in r["councils"]],
        "checks": checks,
        "price_checks": price,
    }


def write(path: str, payload: dict) -> int:
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return len(text.encode())


def main() -> int:
    if not all(c.passed for c in run()["checks"]):
        print("A verification check failed; not writing the app's data.", file=sys.stderr)
        return 1
    os.makedirs(BUILT, exist_ok=True)
    for name, payload in (("areas.json", areas_payload()), ("summary.json", summary_payload())):
        size = write(os.path.join(BUILT, name), payload)
        print(f"data/built/{name}: {size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
