"""The council tax bands, and the one piece of arithmetic that joins them.

Every home in England sits in one of eight bands, A to H, set by what it would
have sold for on 1 April 1991. Its bill is a fixed fraction of the Band D bill
for its area. The fractions are in the Local Government Finance Act 1992,
section 5, and have not changed since:

    A  6/9    B  7/9    C  8/9    D  1    E 11/9    F 13/9    G 15/9    H 18/9

The ninths are kept as integer numerators rather than floats so that the
arithmetic the verification relies on is exact. A home in Band A that qualifies
for disabled relief is billed as if it were one band lower, which for Band A is
a band that does not otherwise exist, at 5/9.
"""

from __future__ import annotations

from fractions import Fraction

BANDS = ("A", "B", "C", "D", "E", "F", "G", "H")

NINTHS = {"A": 6, "B": 7, "C": 8, "D": 9, "E": 11, "F": 13, "G": 15, "H": 18}
DISABLED_A_NINTHS = 5

# The 1991 value ranges that define each band, in pounds. H has no ceiling.
VALUE_RANGE_1991 = {
    "A": (0, 40_000),
    "B": (40_001, 52_000),
    "C": (52_001, 68_000),
    "D": (68_001, 88_000),
    "E": (88_001, 120_000),
    "F": (120_001, 160_000),
    "G": (160_001, 320_000),
    "H": (320_001, None),
}


def ratio(band: str) -> Fraction:
    """A band's bill as a fraction of the Band D bill."""
    return Fraction(NINTHS[band], 9)


def band_d_equivalents(counts: dict[str, float], ninths: dict[str, int] = NINTHS) -> float:
    """Convert a count of homes by band into Band D equivalents.

    `ninths` is a parameter only so the tests can hand it a wrong table and
    confirm the verification notices.
    """
    return sum(counts.get(b, 0.0) * ninths[b] / 9 for b in BANDS)


def bill(band: str, band_d: float) -> float:
    return band_d * NINTHS[band] / 9
