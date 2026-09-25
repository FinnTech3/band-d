import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type Area, type AreasFile, type Council, England, type Valued, binOf, isValued } from "../lib/england";
import { gbp } from "../lib/format";
import { lookup, normalise, pretty } from "../lib/postcode";
import { comparison, standing } from "../lib/story";
import type { CouncilSummary, Summary } from "../lib/summary";
import { type Place, readPlace, writePlace } from "../lib/url";
import { BandsChart } from "./BandsChart";
import { Checks } from "./Checks";
import { DecilesChart } from "./DecilesChart";
import { Distribution } from "./Distribution";
import { ShareCard } from "./ShareCard";
import { useCountUp } from "./hooks";

interface Data {
  england: England;
  summary: Summary;
}

type Shown =
  | { kind: "area"; area: Valued; how: "postcode" | "example" | "link" }
  | { kind: "council"; council: Council; stats: CouncilSummary; reason: string | null; from?: string };

const REPO = "https://github.com/FinnTech3/band-d";

const ELSEWHERE: Record<string, string> = {
  Wales: "Wales revalued its homes in 2003 and has nine bands, so its bills cannot be set against England's.",
  Scotland: "Scotland sets its own band ratios, so its bills cannot be set against England's.",
  "Northern Ireland": "Northern Ireland has domestic rates, charged on each home's value, rather than council tax.",
};

async function load(): Promise<Data> {
  const base = import.meta.env.BASE_URL;
  const [areas, summary] = await Promise.all([
    fetch(`${base}data/areas.json`).then((r) => r.json() as Promise<AreasFile>),
    fetch(`${base}data/summary.json`).then((r) => r.json() as Promise<Summary>),
  ]);
  return { england: new England(areas), summary };
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
  return { kind: "area", area: data.england.highest, how: "example" };
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
        : shown.how === "example" && shown.area.code === data?.england.highest.code
          ? null
          : { kind: "area", code: shown.area.code };
    history.replaceState(null, "", `${location.pathname}${writePlace(place)}`);
  }, [shown, data]);

  function show(next: Shown | null) {
    if (!next) return;
    setShown(next);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    answer.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
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
          ? "The postcode lookup did not answer. Choose your council below instead."
          : "No current postcode matches that. Check it, or choose your council below.",
      problem: true,
    });
  }

  const councils = useMemo(
    () => (data ? [...data.england.councils].sort((a, b) => a.name.localeCompare(b.name, "en-GB")) : []),
    [data],
  );

  return (
    <>
      <div className="wrap">
        <header>
          <div className="mark">
            <span className="ladder" aria-hidden="true">
              {[6, 7, 8, 9, 11, 13, 15, 16].map((h, i) => (
                <i key={i} className={i === 3 ? "d" : undefined} style={{ height: h }} />
              ))}
            </span>
            <b>Band D</b>
            <small>council tax against what homes are worth</small>
          </div>
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
          <div className="hero">
            <h1>How much of your home does council tax take?</h1>
            <p className="lede">
              Bills in England are still set on what homes were worth on 1 April 1991. This compares what every part of
              England pays now with what its homes sold for in 2025.
            </p>
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
              />
              <button className="btn" type="submit" disabled={busy || !data}>
                {busy ? "Finding" : "Find my area"}
              </button>
            </form>
            <p id="pc-hint" className={hint?.problem ? "hint problem" : "hint"} role="status">
              {hint?.text ?? "Sent only to postcodes.io, an open lookup, to find your area. Never kept."}
            </p>
            {data && (
              <div className="choices">
                <span>Or try</span>
                {(
                  [
                    [data.england.highest, "Highest"],
                    [data.england.middle, "Middle"],
                    [data.england.lowest, "Lowest"],
                  ] as const
                ).map(([area, label]) => (
                  <button
                    key={area.code}
                    type="button"
                    className="chip"
                    aria-pressed={shown?.kind === "area" && shown.area.code === area.code}
                    aria-label={`${label} rate in England: ${area.name}`}
                    onClick={() => show({ kind: "area", area, how: "example" })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={answer} className={data && shown ? "answer" : "answer skeleton"} aria-live="polite">
            {failed ? (
              <p>The data did not load. Refresh the page to try again.</p>
            ) : data && shown ? (
              <Answer data={data} shown={shown} />
            ) : (
              <p>Loading every part of England</p>
            )}
          </div>

          {data && (
            <div className="council-pick">
              <label htmlFor="council">No postcode, or not sure? Choose a council:</label>
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

          {data && shown && <Sections data={data} shown={shown} />}
        </main>

        <footer>
          <p>
            Sources: VOA, Council Tax: stock of properties, 31 March 2025; MHCLG, Council Tax levels set by local
            authorities 2026-27 and Council Taxbase 2025; HM Land Registry Price Paid Data, 2025; ONS National
            Statistics Postcode Lookup, May 2026; ONS House price statistics for small areas, dataset 46.
          </p>
          <p>
            A typical home is the median 2025 sale in the area, standard sales only. Areas with fewer than five sales
            are left out of the comparisons. Bills are the average for the area's mix of bands, with parish charges
            averaged across each council, before discounts, exemptions and council tax support.
          </p>
          <p>
            Built by Finn Lakin. The method, the code and every check are at{" "}
            <a href={REPO}>github.com/FinnTech3/band-d</a>. No cookies, no tracking.
          </p>
        </footer>
      </div>
    </>
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
          {shown.how === "example" && <span className="tag">Example</span>}
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

  const homesByBand = useMemo(() => {
    if (isArea) return shown.area.homesByBand;
    const sum = new Array<number>(8).fill(0);
    for (const a of e.areas) if (a.council.code === council.code) a.homesByBand.forEach((h, i) => (sum[i]! += h));
    return sum;
  }, [e, isArea, shown, council.code]);

  const card = useMemo(() => {
    const bins = e.bins(0.25, 60, 40);
    return {
      rate,
      name: place,
      council: isArea ? council.name : "the council as a whole",
      standing: isArea ? standing(shown.area, e) : "Across all its homes, on 2025 sales and 2026-27 bills.",
      bins,
      youBin: binOf(rate, 0.25, 60, 40),
    };
  }, [e, rate, place, isArea, council.name, shown]);

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
            {`Every bill is a fixed fraction of the council's Band D. The top band pays three times the bottom one, however much the home is worth. Blue marks the bands that hold a quarter or more of the homes in ${place}.`}
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
            <DecilesChart deciles={data.summary.deciles} you={isArea ? e.valueDecile(shown.area.code) : undefined} />
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
