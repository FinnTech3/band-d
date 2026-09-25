# Design decisions

The questions I would expect to be asked about this, and the answers.

## Why pounds per £1,000 of value, not a percentage?

Because the numbers are small and people read percentages of a house as
mortgage rates. "£12.91 a year for every £1,000 your home is worth" is the same
fact as 1.29%, and it is the one a reader can check against their own bill:
divide the bill by the value in thousands.

## Why small areas rather than councils?

Councils hide most of the spread. Westminster as a whole pays £0.87 per £1,000;
its 114 valued areas run from £0.38 to £3.08, because Westminster holds both
Mayfair and estates of flats. The 2021 lower layer super output areas (LSOAs)
hold about 700 homes each, small enough to be a neighbourhood and large enough
that the VOA publishes their band counts and most have enough sales to value.

## Why the median sale for an area, and means for everything bigger?

An area has a few dozen sales a year and one can be enormous. Westminster
019E's 2025 mean was £6.0m because of a single £34m sale; its median was
£2.55m. So anything said about one area uses the median.

For England, its tenths and its councils the right summary is a ratio of
totals: all the council tax over all the value. A total needs a mean, and at
that scale no single sale moves it. Using medians there would mean averaging
rates, which weights a small area of cheap flats the same as a large area of
houses.

## Why category A sales only?

Category B covers repossessions, buy-to-let purchases through companies and
transfers that are not at market value. The ONS excludes it from its small-area
medians, and following the ONS rule is what lets the price rebuild be checked
against the ONS at all.

## Why is the price check a pattern rather than a match?

Because an exact match was the wrong expectation. The ONS built its medians
from the Land Registry as it stood in 2023. Sales keep arriving for months
after they complete, and today's files hold sales the ONS never saw. If the
method were wrong, the rebuild would miss equally in every year. If only the
snapshot differs, it will match the oldest year best and miss more each year
after, with the typical miss still £0 until the latest year. That is what it
does: 87.4%, 71.3%, 65.5%, 33.6% exact.

I rewrote the check after seeing this, which is a thing to be suspicious of,
so the check comes with two twins. Medians pulled towards the mean, which is
the most likely real mistake, fail it. So does the same set of results with
the years in reverse order, which proves the pattern is what is being tested
and not just the level.

## Why count a suppressed band as 2.5 homes?

The VOA publishes "-" where a band has one to four homes, to protect privacy.
2.5 is the middle. The report reruns the headline with 1 and with 4: the
cheapest tenth moves between £12.87 and £12.94 and the dearest stays at £2.93.

## Why leave out areas with fewer than five sales?

It is the ONS's own rule for small-area medians, and a median of two sales says
more about which two houses sold than about the area. 902 areas and 612,295
homes are left out, 2.4% of the homes. The app does not hide them: a postcode
in one of them gets its council's figure and a sentence saying why.

## Why 2025 sales against 2026-27 bills?

2025 is the latest complete calendar year of sales. The 2026-27 bills are the
ones people are paying now. Pairing them overstates every rate slightly if
prices have risen since, but by the same proportion everywhere to a first
approximation, and the point is the comparison between areas.

## Why the log-variance split, and why can a share be negative?

An area's rate is Band D times its average band ratio divided by its value, so
its log is a sum of three logs. The variance of a sum splits exactly into each
term's covariance with the total, and the shares add to one. A negative share
means that term works against the spread: dearer areas do sit in higher bands,
which pulls their rates back up. It is a description of where the spread sits,
not a claim about causes.

## Why show a flat charge at all?

To put the gap in pounds. Saying the cheapest tenth pays 4.4 times the rate of
the dearest is abstract; saying a revenue-neutral charge on value would cut its
average bill by £959 is not. I have kept it as arithmetic. It ignores people
whose home is worth far more than their income, the transition, and what
happens to prices, all of which a real reform would have to face.

## Why does the app get raw inputs rather than finished rates?

So the arithmetic a reader sees is done in front of them, and so the app can be
tested against the pipeline. The app decodes each area's bands, council and
median price and computes the bill and rate itself, in the same order of
operations as the Python. Its tests require the quantiles and the five highest
and lowest areas to equal the pipeline's to the last bit, not to within a
tolerance.

## Why postcodes.io?

It is open, needs no key, allows requests from a browser, and is built on the
ONS postcode directory, the same source this project uses to place sales. The
postcode is the only thing the page sends anywhere. The page address keeps the
area code, never the postcode, so a shared link does not share an address.

## Why no charting library?

The charts are a histogram, a set of bars and ten columns. Drawing them as SVG
directly keeps the page under 60 KB of JavaScript, lets each one resize to the
screen so its text stays readable on a phone, and puts the colours in CSS so a
change of theme needs no redraw.
