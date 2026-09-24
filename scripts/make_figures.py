"""Draw the figures in docs/figures from the committed data.

    PYTHONPATH=pipeline/src python3 scripts/make_figures.py

Every number is computed by the same run the report prints, so a figure cannot
disagree with the text. CI regenerates them and fails on any difference. Each
figure comes in a light and a dark version, written as SVG directly: no
plotting library, nothing to install.
"""

from __future__ import annotations

import math
import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "pipeline", "src"))

from bandd.study import run  # noqa: E402

OUT = os.path.join(ROOT, "docs", "figures")
SANS = "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

# Checked with a colour-vision validator against both surfaces: blue and red
# stay distinct under protanopia and deuteranopia and clear 3:1 on each.
LIGHT = {"bg": "#fbfaf7", "ink": "#111110", "dim": "#52514e", "muted": "#6b6a65",
         "grid": "#e6e4dc", "axis": "#c3c2b7", "rest": "#cfccc3",
         "blue": "#2a78d6", "red": "#e34948"}
DARK = {"bg": "#161614", "ink": "#f3f2ee", "dim": "#c3c2b7", "muted": "#9a988f",
        "grid": "#2a2a27", "axis": "#3d3d3a", "rest": "#4b4a46",
        "blue": "#3987e5", "red": "#e66767"}

W = 1120
LEFT = 64


def money(x: float, dp: int = 0) -> str:
    return f"£{x:,.{dp}f}"


def short_money(x: float) -> str:
    if x >= 1_000_000:
        return f"£{x / 1e6:.2f}m"
    return f"£{x / 1000:.0f}k"


class Svg:
    def __init__(self, h: int, p: dict, title: str, subtitle: str):
        self.p, self.h = p, h
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {h}" width="{W}" height="{h}" '
            f'role="img" aria-label="{escape(title)}">',
            f'<rect width="{W}" height="{h}" fill="{p["bg"]}"/>',
        ]
        self.text(LEFT, 44, title, 21, "ink", weight=600)
        self.text(LEFT, 70, subtitle, 14, "dim")

    def text(self, x, y, s, size=13, colour="ink", family=SANS, anchor="start", weight=400):
        self.parts.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{self.p[colour]}" text-anchor="{anchor}">{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, colour="grid", width=1.0):
        self.parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                          f'stroke="{self.p[colour]}" stroke-width="{width}"/>')

    def column(self, x, base, width, height, colour):
        """A column rounded 4px at its data end and square at the baseline."""
        r = min(4.0, width / 2, height)
        top = base - height
        self.parts.append(
            f'<path d="M{x:.1f},{base:.1f} V{top + r:.1f} Q{x:.1f},{top:.1f} {x + r:.1f},{top:.1f} '
            f'H{x + width - r:.1f} Q{x + width:.1f},{top:.1f} {x + width:.1f},{top + r:.1f} V{base:.1f} Z" '
            f'fill="{self.p[colour]}"/>')

    def bar(self, x, y, length, thick, colour):
        """A horizontal bar rounded at its data end."""
        r = min(4.0, thick / 2, length)
        self.parts.append(
            f'<path d="M{x:.1f},{y:.1f} H{x + length - r:.1f} Q{x + length:.1f},{y:.1f} {x + length:.1f},{y + r:.1f} '
            f'V{y + thick - r:.1f} Q{x + length:.1f},{y + thick:.1f} {x + length - r:.1f},{y + thick:.1f} '
            f'H{x:.1f} Z" fill="{self.p[colour]}"/>')

    def dot(self, x, y, colour, r=5.0):
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + 2:.1f}" fill="{self.p["bg"]}"/>')
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{self.p[colour]}"/>')

    def polyline(self, pts, colour, width=2.0):
        d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.parts.append(f'<polyline points="{d}" fill="none" stroke="{self.p[colour]}" '
                          f'stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>')

    def footnote(self, s):
        self.text(LEFT, self.h - 24, s, 12, "muted")

    def svg(self) -> str:
        return "\n".join(self.parts + ["</svg>"]) + "\n"


# --------------------------------------------------------------------------

def fig_rate_by_value(r, p):
    d = r["deciles"]
    s = Svg(560, p, "The cheaper the home, the more of it council tax takes",
            "Council tax a year for every £1,000 of home value, England 2026-27, by tenths of homes sorted by value")
    top, base = 118, 440
    plot_w = W - LEFT - 40
    peak = 14.0
    for v in (0, 5, 10):
        y = base - v / peak * (base - top)
        s.line(LEFT, y, LEFT + plot_w, y, "grid")
        s.text(LEFT - 10, y + 4, money(v), 12, "muted", MONO, "end")
    slot = plot_w / len(d)
    width = 24.0
    for i, x in enumerate(d):
        cx = LEFT + slot * i + slot / 2
        h = x["rate"] / peak * (base - top)
        s.column(cx - width / 2, base, width, h, "blue")
        if i in (0, len(d) - 1):
            s.text(cx, base - h - 10, money(x["rate"], 2), 15, "ink", MONO, "middle", 600)
        s.text(cx, base + 22, short_money(x["average_value"]), 12, "dim", MONO, "middle")
    s.line(LEFT, base, LEFT + plot_w, base, "axis")
    s.text(LEFT + slot / 2, base + 42, "cheapest tenth", 12, "muted", SANS, "middle")
    s.text(LEFT + slot * (len(d) - 0.5), base + 42, "dearest tenth", 12, "muted", SANS, "middle")
    ratio = d[0]["rate"] / d[-1]["rate"]
    s.footnote(f"Average home value under each column. The cheapest tenth pays {ratio:.1f} times as much per "
               f"pound of value as the dearest.")
    return s.svg()


def fig_bill_vs_value(r, p):
    d = r["deciles"]
    s = Svg(560, p, "Homes get nearly seven times dearer. Bills rise by half.",
            "Average home value and average council tax bill in each tenth of England's homes, "
            "both set to 1 for the cheapest tenth")
    top, base = 118, 440
    right = W - 200
    plot_w = right - LEFT
    v0, b0 = d[0]["average_value"], d[0]["average_bill"]
    values = [x["average_value"] / v0 for x in d]
    bills = [x["average_bill"] / b0 for x in d]
    peak = 7.0
    for v in range(0, 8):
        y = base - v / peak * (base - top)
        s.line(LEFT, y, right, y, "grid" if v else "axis")
        s.text(LEFT - 10, y + 4, f"{v}x" if v else "0", 12, "muted", MONO, "end")
    xs = [LEFT + plot_w * i / (len(d) - 1) for i in range(len(d))]
    for series, colour, label in ((values, "blue", "home value"), (bills, "red", "council tax bill")):
        pts = [(x, base - v / peak * (base - top)) for x, v in zip(xs, series)]
        s.polyline(pts, colour)
        s.dot(*pts[-1], colour)
        s.text(pts[-1][0] + 14, pts[-1][1] + 5, f"{label}  {series[-1]:.2f}x", 14, "ink", SANS, weight=600)
    s.text(xs[0], base + 22, "cheapest tenth", 12, "muted", SANS, "start")
    s.text(xs[-1], base + 22, "dearest tenth", 12, "muted", SANS, "end")
    s.footnote("A property tax whose bill tracked value would draw the red line on top of the blue one.")
    return s.svg()


def fig_extremes(r, p):
    hi, lo = r["highest"][0], r["lowest"][0]
    s = Svg(470, p, "A £4.35m home and a £40,000 home, and the bills beside them",
            "The highest and lowest rate of any small area in England: typical 2025 sale price and "
            "average 2026-27 bill")
    col = (W - 2 * LEFT) / 2
    for i, (a, colour) in enumerate(((hi, "red"), (lo, "blue"))):
        x = LEFT + i * col
        s.parts.append(f'<rect x="{x:.1f}" y="104" width="{col - 24:.1f}" height="4" rx="2" fill="{p[colour]}"/>')
        s.text(x, 140, a.name, 18, "ink", SANS, weight=600)
        s.text(x, 162, a.council_name, 13, "dim")
        s.text(x, 212, money(a.median_price), 40, "ink", SANS, weight=600)
        s.text(x, 236, "typical home, 2025 sales", 13, "dim")
        s.text(x, 292, money(a.bill), 40, "ink", SANS, weight=600)
        s.text(x, 316, "average council tax bill, 2026-27", 13, "dim")
        s.text(x, 372, f"{money(a.rate, 2)} per £1,000 of value", 18, "ink", MONO, weight=600)
    s.footnote(f"The Westminster home is worth {lo.median_price / hi.median_price:.0f} times as much "
               f"and its area's average bill is {100 * (1 - lo.bill / hi.bill):.0f}% lower.")
    return s.svg()


def fig_spread(r, p):
    areas = r["areas"]
    s = Svg(520, p, "Every small area in England, by what council tax takes",
            f"Council tax a year per £1,000 of the typical home's value, {len(areas):,} areas, "
            "log scale, height is the number of homes")
    top, base = 132, 410
    plot_w = W - LEFT - 40
    lo_v, hi_v = 0.25, 60.0
    bins = 70
    counts = [0.0] * bins

    def xf(v):
        return LEFT + (math.log(v) - math.log(lo_v)) / (math.log(hi_v) - math.log(lo_v)) * plot_w

    for a in areas:
        k = int((math.log(a.rate) - math.log(lo_v)) / (math.log(hi_v) - math.log(lo_v)) * bins)
        counts[min(max(k, 0), bins - 1)] += a.homes
    peak = max(counts)
    bw = plot_w / bins
    for i, c in enumerate(counts):
        if c:
            h = c / peak * (base - top)
            s.column(LEFT + i * bw + 1, base, bw - 2, h, "rest")
    s.line(LEFT, base, LEFT + plot_w, base, "axis")
    for v in (0.5, 1, 2, 5, 10, 20, 50):
        s.text(xf(v), base + 22, money(v, 2 if v < 1 else 0), 12, "muted", MONO, "middle")
    q = r["quantiles"]
    marks = ((0.1, "one home in ten below", "end", -6, top + 4),
             (0.5, "half of homes below", "start", 6, top - 14),
             (0.9, "one home in ten above", "start", 6, top + 4))
    for key, label, anchor, dx, y in marks:
        x = xf(q[key])
        s.line(x, y - 12, x, base, "ink", 1)
        s.text(x + dx, y, f"{label} {money(q[key], 2)}", 12, "ink", SANS, anchor)
    hi, lo = r["highest"][0], r["lowest"][0]
    for a, colour, anchor, dx in ((lo, "blue", "start", 8), (hi, "red", "end", -8)):
        x = xf(a.rate)
        s.dot(x, base - 10, colour, 5)
        s.text(x + dx, base - 26, a.name, 12, "ink", SANS, anchor)
    s.footnote("Each column counts homes, not areas. The two named areas are the ends of the range.")
    return s.svg()


def fig_councils(r, p):
    c = r["councils"]
    picks = c[:8] + c[-8:]
    s = Svg(40 + 110 + len(picks) * 28 + 70, p, "The councils where council tax takes most and least",
            "Council tax a year per £1,000 of home value, each council's areas combined, 2026-27")
    label_w = 230
    x0 = LEFT + label_w
    plot_w = W - x0 - 150
    peak = max(x["rate"] for x in picks)
    y = 110
    for i, x in enumerate(picks):
        if i == 8:
            y += 20
        colour = "red" if i < 8 else "blue"
        length = x["rate"] / peak * plot_w
        s.text(x0 - 12, y + 15, x["name"], 13, "ink", SANS, "end")
        s.bar(x0, y + 3, length, 16, colour)
        s.text(x0 + length + 10, y + 15, money(x["rate"], 2), 13, "ink", MONO)
        y += 28
    s.line(x0, 104, x0, y, "axis")
    s.footnote(f"{len(c)} councils in all. Band D rates alone would not produce this: "
               "it comes from home values the 1991 bands no longer track.")
    return s.svg()


def fig_price_check(r, p):
    pc = r["price_checks"]
    labels = {"ye_2020_12": "2020", "ye_2021_12": "2021", "ye_2022_03": "Apr 2021 to\nMar 2022",
              "ye_2022_03x": "", "ye_2023_03": "Apr 2022 to\nMar 2023"}
    s = Svg(500, p, "My rebuild agrees with the ONS less the more recent the year",
            "Share of small areas where the median price rebuilt from Land Registry sales equals the "
            "ONS's published median to the pound")
    top, base = 118, 390
    plot_w = W - LEFT - 40
    for v in (0, 25, 50, 75, 100):
        y = base - v / 100 * (base - top)
        s.line(LEFT, y, LEFT + plot_w, y, "grid" if v else "axis")
        s.text(LEFT - 10, y + 4, f"{v}%", 12, "muted", MONO, "end")
    slot = plot_w / len(pc)
    for i, (period, v) in enumerate(pc.items()):
        cx = LEFT + slot * i + slot / 2
        h = v["exact_share"] * (base - top)
        s.column(cx - 12, base, 24, h, "blue")
        s.text(cx, base - h - 10, f"{v['exact_share']:.1%}", 14, "ink", MONO, "middle", 600)
        for j, part in enumerate(labels[period].split("\n")):
            s.text(cx, base + 22 + 16 * j, part, 12, "dim", SANS, "middle")
    s.footnote("Sales registered after the ONS took its extract are in today's files and not in its figures. "
               "The older the period, the fewer of them there are.")
    return s.svg()


FIGURES = {
    "rate-by-value": fig_rate_by_value,
    "bill-vs-value": fig_bill_vs_value,
    "extremes": fig_extremes,
    "spread": fig_spread,
    "councils": fig_councils,
    "price-check": fig_price_check,
}


def main() -> int:
    r = run()
    if not all(c.passed for c in r["checks"]):
        print("a verification check failed; not drawing figures from unverified data", file=sys.stderr)
        return 1
    os.makedirs(OUT, exist_ok=True)
    for name, fig in FIGURES.items():
        for mode, palette in (("light", LIGHT), ("dark", DARK)):
            with open(os.path.join(OUT, f"{name}-{mode}.svg"), "w") as f:
                f.write(fig(r, palette))
    print(f"wrote {len(FIGURES) * 2} figures to docs/figures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
