"""Small-area house prices from individual sales.

The ONS rule is followed exactly: an area's median is only reported when it had
at least five sales in the period, because a median of two or three sales says
more about which houses happened to sell than about the area.
"""

from __future__ import annotations

import statistics

MIN_SALES = 5


def median_by_area(sales: dict[str, list[int]], min_sales: int = MIN_SALES) -> dict[str, float]:
    return {area: float(statistics.median(p)) for area, p in sales.items() if len(p) >= min_sales}


def mean_by_area(sales: dict[str, list[int]], min_sales: int = MIN_SALES) -> dict[str, float]:
    return {area: sum(p) / len(p) for area, p in sales.items() if len(p) >= min_sales}
