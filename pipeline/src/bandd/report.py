"""Print every number the README quotes, in the order it quotes them.

    PYTHONPATH=pipeline/src python3 -m bandd.report

Refuses to print findings if any verification check has failed, because a
number computed on sources that do not reconcile is not a finding.
"""

from __future__ import annotations

import sys

from .study import run


def money(x: float) -> str:
    return f"-£{-x:,.0f}" if x < 0 else f"£{x:,.0f}"


def main() -> int:
    r = run()
    print("Verification")
    for c in r["checks"]:
        print(f"  [{'pass' if c.passed else 'FAIL'}] {c.name}: {c.summary}")
    if not all(c.passed for c in r["checks"]):
        print("\nA check failed; nothing below would mean anything.", file=sys.stderr)
        return 1

    print("\nPrice rebuild against the ONS, share of areas matching to the pound")
    for p, v in r["price_checks"].items():
        print(f"  {p}: {v['exact_share']:.1%} of {v['areas']:,} areas, median gap £{v['median_abs_gap']:.0f}")

    s = r["skipped"]
    print(f"\nCoverage: {len(r['areas']):,} small areas, {r['homes_covered']:,.0f} homes; "
          f"{s['too_few_sales']} areas ({s['too_few_sales_homes']:,.0f} homes) had fewer than five sales in 2025")

    print(f"\nEngland as a whole: £{r['national_rate']:.2f} of council tax a year per £1,000 of home value")
    q = r["quantiles"]
    print("Across small areas, weighted by homes: "
          + ", ".join(f"p{int(k*100)} £{v:.2f}" for k, v in q.items()))

    print("\nBy home value, tenths of England's homes")
    for d in r["deciles"]:
        print(f"  {d['decile']:>2}  bill {money(d['average_bill']):>7}  value {money(d['average_value']):>10}  "
              f"£{d['rate']:.2f} per £1,000")
    d1, d10 = r["deciles"][0], r["deciles"][-1]
    print(f"  cheapest tenth pays {d1['rate'] / d10['rate']:.1f} times the dearest per pound of value; "
          f"homes {d10['average_value'] / d1['average_value']:.1f} times dearer, bills "
          f"{d10['average_bill'] / d1['average_bill']:.2f} times bigger")

    print("\nThe extremes")
    for label, group in (("highest", r["highest"]), ("lowest", r["lowest"])):
        for a in group:
            print(f"  {label:<7} {a.name:<32} £{a.rate:.2f}  bill {money(a.bill)}  typical home {money(a.median_price)}  "
                  f"({a.sales} sales)")
    hi, lo = r["highest"][0], r["lowest"][0]
    print(f"  {lo.name}'s typical home is worth {lo.median_price / hi.median_price:.0f} times {hi.name}'s and pays "
          f"{lo.bill / hi.bill:.2f} times the bill")

    dec = r["decomposition"]
    print("\nWhere the spread in rates comes from (shares of the variance of log rate)")
    print(f"  home values the bands do not track {dec['home_value']:.0%}, band mix {dec['band_mix']:.0%}, "
          f"council Band D rates {dec['council_band_d']:.0%}")

    c = r["councils"]
    print("\nCouncils, highest and lowest rate")
    for x in c[:5] + c[-5:]:
        print(f"  {x['name']:<26} £{x['rate']:.2f}  Band D {money(x['band_d'])}  "
              f"average bill {money(x['average_bill'])}  average value {money(x['average_value'])}")

    p = r["proportional"]
    print(f"\nA flat charge of £{p['rate_per_1000']:.2f} per £1,000 raising the same total: "
          f"{p['share_paying_less']:.0%} of homes would pay less")
    print("  average change by tenth of value: "
          + ", ".join(f"{money(d['average_change'])}" for d in p["by_decile"]))

    rb = r["robustness"]
    print("\nRobustness")
    print(f"  suppressed bands as 1 home: cheapest £{rb['suppressed_as_1']['cheapest']:.2f}, "
          f"dearest £{rb['suppressed_as_1']['dearest']:.2f}")
    print(f"  suppressed bands as 4 homes: cheapest £{rb['suppressed_as_4']['cheapest']:.2f}, "
          f"dearest £{rb['suppressed_as_4']['dearest']:.2f}")
    m = rb["mean_price"]
    print(f"  on mean rather than median prices: p10 £{m['p10']:.2f}, p50 £{m['p50']:.2f}, p90 £{m['p90']:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
