import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type Area, type AreasFile, type Council, England, type Valued, isValued, looksLikeAreasFile } from "../lib/england";
import { gbp } from "../lib/format";
import { type Points, type PointsFile, decodePoints, looksLikePointsFile } from "../lib/points";
import { lookup, normalise, pretty } from "../lib/postcode";
import { lean } from "../lib/shade";
import { comparison, standing } from "../lib/story";
import { type CouncilSummary, type Summary, looksLikeSummary } from "../lib/summary";
import { type Place, readPlace, writePlace } from "../lib/url";
import { BandsChart } from "./BandsChart";
import { Checks } from "./Checks";
import { DecilesChart } from "./DecilesChart";
import { Distribution } from "./Distribution";
import { EnglandMap, type Focus } from "./EnglandMap";
import { Revalue } from "./Revalue";
import { ShareCard } from "./ShareCard";
import { useCountUp } from "./hooks";
import { Monogram } from "./series/Monogram";
import { Note } from "./series/Note";
import { SeriesStrip } from "./series/SeriesStrip";
import { PORTFOLIO } from "./series/series";

interface Data {
  england: England;
  points: Points;
  summary: Summary;
}

type Shown =
  | { kind: "area"; area: Valued; how: "postcode" | "example" | "start" | "link" | "map" }
  | { kind: "council"; council: Council; stats: CouncilSummary; reason: string | null; from?: string };

const REPO = "https://github.com/FinnTech3/band-d";

const ELSEWHERE: Record<string, string> = {
  Wales: "Wales revalued its homes in 2003 and has nine bands, so its bills cannot be set against England's.",
  Scotland: "Scotland sets its own band ratios, so its bills cannot be set against England's.",
  "Northern Ireland": "Northern Ireland has domestic rates, charged on each home's value, rather than council tax.",
};

async function load(): Promise<Data> {
  const base = import.meta.env.BASE_URL;
  const [areas, points, summary] = await Promise.all([
    fetch(`${base}data/areas.json`).then((r) => r.json() as Promise<AreasFile>),
    fetch(`${base}data/points.json`).then((r) => r.json() as Promise<PointsFile>),
    fetch(`${base}data/summary.json`).then((r) => r.json() as Promise<Summary>),
  ]);
  if (!looksLikeAreasFile(areas) || !looksLikePointsFile(points) || !looksLikeSummary(summary)) {
    throw new Error("unexpected data shape");
  }
  return { england: new England(areas), points: decodePoints(points), summary };
}

function councilView(data: Data, council: Council, reason: string | null, from?: Area): Shown | null {
  const stats = data.summary.councils.find((c) => c.code === council.code);
  return stats ? { kind: "council", council, stats, reason, from: from?.code } : null;
}

function fromPlace(data: Data, place: Place | null): Shown {
  if (place?.kind === "area") {
    const a = data.england.find(place.code);
    if (a && isValued(a)) return { kind: "area", area: a, how: "link" };
    if (a) {
      const v = councilView(data, a.council, tooFewSales(a), a);
      if (v) return v;
    }
  }
  if (place?.kind === "council") {
    const c = data.england.council(place.code);
    const v = c && councilView(data, c, null);
    if (v) return v;
  }
  return { kind: "area", area: data.england.highest, how: "start" };
}

function tooFewSales(a: Area): string {
  const n = a.sales === 0 ? "No homes" : a.sales === 1 ? "Only one home" : `Only ${a.sales} homes`;
  return `${n} sold in ${a.name} in 2025, too few to give a typical price, so this is ${a.council.name} as a whole.`;
}

function useTheme() {
  const [theme, setTheme] = useState<string | undefined>(() => document.documentElement.dataset.theme);
  const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme ? theme === "dark" : systemDark;
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private windows may refuse; the choice then lasts for this visit only.
    }
    setTheme(next);
  }
  return { dark, toggle };
}

export function App() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [postcode, setPostcode] = useState("");
  const [hint, setHint] = useState<{ text: string; problem: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const answer = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  // Everything below the first screen is rendered a moment after it, so the
  // map and the answer are not kept waiting for charts nobody can see yet.
  const [below, setBelow] = useState(false);
  useEffect(() => {
    if (!data || below) return;
    const t = setTimeout(() => setBelow(true), 50);
    return () => clearTimeout(t);
  }, [data, below]);

  useEffect(() => {
    load()
      .then((d) => {
        setData(d);
        setShown(fromPlace(d, readPlace(location.search)));
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!shown) return;
    const place: Place | null =
      shown.kind === "council"
        ? shown.from
          ? { kind: "area", code: shown.from }
          : { kind: "council", code: shown.council.code }
        : shown.how === "start"
          ? null
          : { kind: "area", code: shown.area.code };
    history.replaceState(null, "", `${location.pathname}${writePlace(place)}`);
  }, [shown]);

  /** Show an answer. The card is brought into view unless the reader chose it on the map, which is already in view. */
  function show(next: Shown | null, scroll = true) {
    if (!next) return;
    setShown(next);
    if (!scroll) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    answer.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  function pickOnMap(i: number) {
    if (!data) return;
    const a = data.england.at(i);
    setHint(null);
    if (isValued(a)) show({ kind: "area", area: a, how: "map" }, false);
    else show(councilView(data, a.council, tooFewSales(a), a), false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const pc = normalise(postcode);
    if (!pc) {
      setHint({ text: "That does not look like a full postcode. It should look like SW1A 1AA.", problem: true });
      return;
    }
    setBusy(true);
    setHint({ text: `Finding ${pretty(pc)}`, problem: false });
    const r = await lookup(pc);
    setBusy(false);
    if (r.kind === "found") {
      const a = data.england.find(r.lsoa);
      if (a && isValued(a)) {
        setHint({ text: `${pretty(pc)} is in ${a.name}, ${a.council.name}.`, problem: false });
        show({ kind: "area", area: a, how: "postcode" });
        return;
      }
      const c = a?.council ?? (r.district ? data.england.council(r.district) : undefined);
      if (c) {
        setHint({ text: `${pretty(pc)} is in ${c.name}.`, problem: false });
        show(councilView(data, c, a ? tooFewSales(a) : null, a));
        return;
      }
    }
    if (r.kind === "elsewhere") {
      setHint({
        text: `${pretty(pc)} is in ${r.country}. ${ELSEWHERE[r.country] ?? ""} This covers England only.`,
        problem: true,
      });
      return;
    }
    setHint({
      text:
        r.kind === "offline"
          ? "The postcode lookup did not answer. Tap your area on the map, or choose your council below."
          : "No current postcode matches that. Check it, or choose your council below.",
      problem: true,
    });
  }

  const councils = useMemo(
    () => (data ? [...data.england.councils].sort((a, b) => a.name.localeCompare(b.name, "en-GB")) : []),
    [data],
  );

  const focus: Focus = useMemo(() => {
    if (!data || !shown || (shown.kind === "area" && shown.how === "start")) return null;
    if (shown.kind === "area") return { kind: "area", index: data.england.indexOf(shown.area.code) };
    if (shown.from) return { kind: "area", index: data.england.indexOf(shown.from) };
    return { kind: "council", code: shown.council.code };
  }, [data, shown]);

  const form = (
    <form className="lookup" onSubmit={submit}>
      <label htmlFor="pc" className="visually-hidden">
        Your postcode
      </label>
      <input
        id="pc"
        value={postcode}
        onChange={(e) => setPostcode(e.target.value)}
        autoComplete="postal-code"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="Your postcode"
        aria-describedby="pc-hint"
        aria-invalid={hint?.problem ? "true" : "false"}
      />
      <button className="btn" type="submit" disabled={busy || !data}>
        {busy ? "Finding" : "Find me"}
      </button>
    </form>
  );

  return (
    <>
      <div className="wrap">
        <header className="bar">
          <Monogram />
          <p className="series">
            A series of six by <b>Finn Lakin</b>
            <br />
            No. 1 · Council tax
          </p>
          <button
            className="toggle"
            type="button"
            onClick={theme.toggle}
            aria-label={`Switch to ${theme.dark ? "light" : "dark"} theme`}
          >
            {theme.dark ? "Light" : "Dark"}
          </button>
        </header>

        <main>
          <div className="stage">
            <div className="head">
              <h1>
                <span className="nowrap">England, priced in</span> <em>1991.</em>
              </h1>
              <p className="dek">
                Each dot is one of England's 33,755 small areas. Blue pays less council tax for what its homes are worth
                than England as a whole; red pays more.
              </p>
            </div>

            <Note>
              Council tax is still worked out from what your home would have sold for in April 1991. I wanted to see
              what that looks like thirty-five years on, so I drew it.
            </Note>

            {data ? (
              <EnglandMap
                england={data.england}
                points={data.points}
                national={data.summary.national_rate}
                focus={focus}
                dark={theme.dark}
                onPick={pickOnMap}
              >
                {form}
              </EnglandMap>
            ) : (
              <figure className="map waiting">
                <p>
                  {failed ? "The data did not load. Refresh the page to try again." : "Drawing every part of England"}
                </p>
                <div className="find">{form}</div>
              </figure>
            )}

            <div className="under">
              <div className="choices">
                <span>Or fly to</span>
                {(["highest", "middle", "lowest"] as const).map((label) => {
                  const area = data
                    ? { highest: data.england.highest, middle: data.england.middle, lowest: data.england.lowest }[label]
                    : null;
                  return (
                    <button
                      key={label}
                      type="button"
                      className="chip"
                      disabled={!area}
                      aria-pressed={
                        !!area && shown?.kind === "area" && shown.how === "example" && shown.area.code === area.code
                      }
                      aria-label={area ? `The ${label} rate in England: ${area.name}` : label}
                      onClick={() => area && show({ kind: "area", area, how: "example" })}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p id="pc-hint" className={hint?.problem ? "hint problem" : "hint"} role="status">
                {hint?.text ??
                  "Your postcode goes only to postcodes.io, an open lookup, to find your area. Never kept."}
              </p>
            </div>

            <div className="side">
              <div ref={answer} className={data && shown ? "answer" : "answer skeleton"} aria-live="polite">
                {failed ? (
                  <p>The data did not load. Refresh the page to try again.</p>
                ) : data && shown ? (
                  <Answer data={data} shown={shown} />
                ) : (
                  <p>Loading every part of England</p>
                )}
              </div>
              {data && shown && (
                <Legend
                  rate={shown.kind === "area" ? shown.area.rate : shown.stats.rate}
                  national={data.summary.national_rate}
                  lowest={data.england.lowest.rate}
                  highest={data.england.highest.rate}
                />
              )}
              {data && (
                <div className="council-pick">
                  <label htmlFor="council">No postcode? Choose a council:</label>
                  <select
                    id="council"
                    value={shown?.kind === "council" ? shown.council.code : ""}
                    onChange={(e) => {
                      const c = data.england.council(e.target.value);
                      if (c) show(councilView(data, c, null));
                    }}
                  >
                    <option value="">Choose</option>
                    {councils.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {below && data && shown && <Sections data={data} shown={shown} />}

          {below && data && (
            <Revalue
              england={data.england}
              points={data.points}
              national={data.summary.national_rate}
              payingLess={data.summary.proportional.share_paying_less}
              dark={theme.dark}
            />
          )}

          {below && data && shown && (
            <aside className="signoff">
              <p>
                Now you know your own rate, not just your band letter. Mine surprised me too, which is the whole reason
                this exists.
              </p>
            </aside>
          )}

          <SeriesStrip here="band-d" />
        </main>

        <footer>
          <p>
            Sources: VOA, Council Tax: stock of properties, 31 March 2025; MHCLG, Council Tax levels set by local
            authorities 2026-27 and Council Taxbase 2025; HM Land Registry Price Paid Data, 2025; ONS National
            Statistics Postcode Lookup, May 2026; ONS House price statistics for small areas, dataset 46; ONS small area
            population-weighted centroids, 2021.
          </p>
          <p>
            A typical home is the median 2025 sale in the area, standard sales only. Areas with fewer than five sales
            are left out of the comparisons and drawn in grey on the map. Each dot sits where the ONS puts the middle of
            its area's population, so dots follow where people live rather than the shape of the area. Bills are the
            average for the area's mix of bands, with parish charges averaged across each council, before discounts,
            exemptions and council tax support.
          </p>
          <p>
            Made by Finn Lakin. The method, the code and every check are at{" "}
            <a href={REPO}>github.com/FinnTech3/band-d</a>, and the rest of my work is at{" "}
            <a href={PORTFOLIO}>finn-lakin-portfolio.netlify.app</a>. No cookies, no tracking.
          </p>
        </footer>
      </div>
    </>
  );
}

/** Where a rate sits between the two ends of England, on the map's own scale. */
function Legend({
  rate,
  national,
  lowest,
  highest,
}: {
  rate: number;
  national: number;
  lowest: number;
  highest: number;
}) {
  const at = ((lean(rate, national) + 1) / 2) * 100;
  return (
    <div className="legend" aria-hidden="true">
      <div className="say">
        <span>pays less than England</span>
        <span>pays more</span>
      </div>
      <div className="ramp">
        <i style={{ left: `${at}%` }} />
      </div>
      <div className="ticks">
        <span>{gbp(lowest, 2)}</span>
        <span>{gbp(national, 2)} England</span>
        <span>{gbp(highest, 2)}</span>
      </div>
      <div className="grey">
        <b /> too few sales in 2025 to price
      </div>
    </div>
  );
}

function Answer({ data, shown }: { data: Data; shown: Shown }) {
  const rate = shown.kind === "area" ? shown.area.rate : shown.stats.rate;
  const counted = useCountUp(rate);
  const e = data.england;

  if (shown.kind === "council") {
    const { council, stats, reason } = shown;
    const inside = e.inCouncil(council.code);
    const lo = inside[0];
    const hi = inside[inside.length - 1];
    return (
      <>
        <div className="answer-main">
          <div className="where">
            <b>{council.name}</b>
            <span>the council as a whole</span>
          </div>
          {reason && <p className="note">{reason}</p>}
          <div className="big">
            <span className="num">{gbp(counted ?? rate, 2)}</span>
            <span className="unit">of council tax a year for every £1,000 its homes are worth</span>
          </div>
          {lo && hi && (
            <p className="context">
              {`Its areas run from ${gbp(lo.rate, 2)} in ${lo.name} to ${gbp(hi.rate, 2)} in ${hi.name}.`}
            </p>
          )}
        </div>
        <dl className="facts">
          <div>
            <dt>Average home sold for, 2025</dt>
            <dd>{gbp(stats.average_value)}</dd>
          </div>
          <div>
            <dt>Average bill, 2026-27</dt>
            <dd>{gbp(stats.average_bill)}</dd>
          </div>
          <div>
            <dt>Band D in {council.name}</dt>
            <dd>{gbp(council.bandD, 2)}</dd>
          </div>
        </dl>
      </>
    );
  }

  const a = shown.area;
  return (
    <>
      <div className="answer-main">
        <div className="where">
          <b>{a.name}</b>
          <span>{a.council.name}</span>
          {(shown.how === "example" || shown.how === "start") && <span className="tag">Example</span>}
        </div>
        <div className="big">
          <span className="num">{gbp(counted ?? a.rate, 2)}</span>
          <span className="unit">of council tax a year for every £1,000 a home here is worth</span>
        </div>
        <p className="context">{standing(a, e)}</p>
      </div>
      <div className="answer-side">
        <dl className="facts">
          <div>
            <dt>Typical home sold for, 2025</dt>
            <dd>{gbp(a.median)}</dd>
          </div>
          <div>
            <dt>Average bill here, 2026-27</dt>
            <dd>{gbp(a.bill)}</dd>
          </div>
          <div>
            <dt>Band D in {a.council.name}</dt>
            <dd>{gbp(a.council.bandD, 2)}</dd>
          </div>
        </dl>
        <p className="note">{`From ${a.sales} sales in 2025 and the ${Math.round(a.homes).toLocaleString("en-GB")} homes on the valuation list.`}</p>
      </div>
    </>
  );
}

function Sections({ data, shown }: { data: Data; shown: Shown }) {
  const e = data.england;
  const isArea = shown.kind === "area";
  const rate = isArea ? shown.area.rate : shown.stats.rate;
  const council = isArea ? shown.area.council : shown.council;
  const place = isArea ? shown.area.name : shown.council.name;
  const label = isArea ? (shown.how === "postcode" ? "You" : shown.area.name) : shown.council.name;

  const homesByBand = useMemo(
    () => (isArea ? shown.area.homesByBand : e.homesByBandIn(council.code)),
    [e, isArea, shown, council.code],
  );

  const card = useMemo(
    () => ({
      rate,
      name: place,
      council: isArea ? council.name : "the council as a whole",
      standing: isArea ? standing(shown.area, e) : "Across all its homes, on 2025 sales and 2026-27 bills.",
      national: data.summary.national_rate,
      points: data.points,
      rates: e.rates,
      index: isArea ? e.indexOf(shown.area.code) : shown.from ? e.indexOf(shown.from) : -1,
    }),
    [e, rate, place, isArea, council.name, shown, data],
  );

  return (
    <>
      <section>
        <h2>You, among every part of England</h2>
        <p className="sub">
          Each column is the homes whose area pays that much per £1,000 of value. The scale grows by multiples, because
          the two ends are over a hundred times apart.
        </p>
        <div className="fig">
          <Distribution england={e} rate={rate} label={label} />
        </div>
        {isArea && <p className="compare">{comparison(shown.area, e)}</p>}
      </section>

      <section className="two">
        <div>
          <h2>Why: eight bands, frozen in 1991</h2>
          <p className="sub">
            {`Every bill is a fixed fraction of the council's Band D. The top band pays three times the bottom one, however much the home is worth. Green marks the bands that hold a quarter or more of the homes in ${place}.`}
          </p>
          <div className="fig">
            <BandsChart bandD={council.bandD} homesByBand={homesByBand} council={council.name} place={place} />
          </div>
        </div>
        <div>
          <h2>The cheaper the home, the more it takes</h2>
          <p className="sub">
            England's homes in ten equal groups by value. Council tax a year per £1,000 of value, 2026-27.
          </p>
          <div className="fig">
            <DecilesChart
              deciles={data.summary.deciles}
              you={isArea ? e.valueDecile(shown.area.code) : undefined}
              youLabel={label === "You" ? "You" : "Here"}
            />
          </div>
        </div>
      </section>

      <section>
        <h2>How I know these numbers are right</h2>
        <p className="sub">Before comparing anything, four checks against figures the government published.</p>
        <Checks summary={data.summary} />
      </section>

      <section>
        <h2>Save your result</h2>
        <ShareCard content={card} file={`band-d-${isArea ? shown.area.code : shown.council.code}.png`} />
      </section>
    </>
  );
}
