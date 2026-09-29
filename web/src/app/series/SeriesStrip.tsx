import type { ReactNode } from "react";
import { ENGLAND_DOTS, PENSION_RIDGE } from "./thumbs";
import { PORTFOLIO, SERIES } from "./series";

// A small picture of each tool, drawn once by hand in its own colours.
const THUMBS: Record<string, ReactNode> = {
  "band-d": (
    <>
      <rect width="125" height="100" fill="#0c1310" />
      {ENGLAND_DOTS.map((d, i) => (
        <path key={i} d={d} stroke={["#58a6ff", "#3a4a43", "#ff5c80"][i]} strokeWidth="1.1" strokeLinecap="round" />
      ))}
    </>
  ),
  "degree-value": (
    <>
      <rect width="125" height="100" fill="#0b1022" />
      <g fill="none" strokeWidth="1.6" strokeLinecap="round">
        <path d="M10 50 C22 50, 18 14, 28 14 L52 14" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 20, 28 20 L57 20" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 26, 28 26 L66 26" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 32, 28 32 L70 32" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 38, 28 38 L75 38" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 44, 28 44 L80 44" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 50, 28 50 L86 50" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 56, 28 56 L92 56" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 62, 28 62 L98 62" stroke={"#c9d1e8"} />
        <path d="M10 50 C22 50, 18 68, 28 68 L116 68" stroke={"#6f78a0"} />
        <path d="M10 50 C22 50, 18 74, 28 74 L116 74" stroke={"#6f78a0"} />
        <path d="M10 50 C22 50, 18 80, 28 80 L116 80" stroke={"#6f78a0"} />
        <path d="M10 50 C22 50, 18 86, 28 86 L116 86" stroke={"#6f78a0"} />
      </g>
    </>
  ),
  "pension-pot": (
    <>
      <rect width="125" height="100" fill="#2a1f4a" />
      <rect y="52" width="125" height="48" fill="#5a3d6c" />
      <path d={`${PENSION_RIDGE}L125 100L0 100Z`} fill="#1a1530" />
      <path d={PENSION_RIDGE} fill="none" stroke="#f2c6d6" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  "trolley-watch": (
    <>
      <rect width="125" height="100" fill="#ecebe6" />
      <g fill="#8a8a84">
        <rect x="8" y="34" width="109" height="3" />
        <rect x="8" y="66" width="109" height="3" />
        <rect x="8" y="96" width="109" height="3" />
      </g>
      <g fill="#3d4246">
        <rect x="14" y="18" width="10" height="16" rx="2" />
        <rect x="28" y="12" width="8" height="22" rx="3" />
        <rect x="40" y="20" width="14" height="14" rx="2" />
        <rect x="60" y="16" width="9" height="18" rx="4" />
        <rect x="74" y="22" width="16" height="12" rx="2" />
        <rect x="95" y="14" width="10" height="20" rx="2" />
        <rect x="16" y="50" width="14" height="16" rx="2" />
        <rect x="36" y="46" width="9" height="20" rx="4" />
        <rect x="50" y="52" width="16" height="14" rx="2" />
        <rect x="72" y="48" width="10" height="18" rx="2" />
        <rect x="88" y="54" width="18" height="12" rx="3" />
      </g>
      <g fill="#b0243f">
        <rect x="20" y="38" width="12" height="6" />
        <rect x="66" y="38" width="12" height="6" />
        <rect x="44" y="70" width="12" height="6" />
        <rect x="92" y="70" width="12" height="6" />
      </g>
    </>
  ),
  "deposit-gap": (
    <>
      <rect width="125" height="100" fill="#e9e2d6" />
      <g fill="#8c3b35">
        <path d="M6 100V78l6-5 6 5v22z" />
        <path d="M20 100V70l6-5 6 5v30z" />
        <path d="M34 100V80l6-5 6 5v20z" />
        <path d="M48 100V56l6-5 6 5v44z" />
        <path d="M62 100V30l6-5 6 5v70z" />
        <path d="M76 100V44l6-5 6 5v56z" />
        <path d="M90 100V66l6-5 6 5v34z" />
        <path d="M104 100V84l6-5 6 5v16z" />
      </g>
    </>
  ),
  "brexit-baseline": (
    <>
      <rect width="125" height="100" fill="#0b0d24" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* the years every baseline is fitted to, where they still agree */}
        <path
          d="M6 62 L18 58 L26 66 L34 61 L42 63 L50 59 L58 62M6 66 L18 63 L26 70 L34 65 L42 67 L50 64 L58 66M6 58 L18 54 L26 62 L34 57 L42 59 L50 55 L58 58"
          stroke="#5a5f99"
          strokeWidth="0.8"
        />
        {/* and where they stop agreeing */}
        <path d="M58 58 L72 44 L84 48 L98 30 L112 22 L119 14" stroke="#ff9ec2" strokeWidth="1.6" />
        <path d="M58 60 L72 52 L84 55 L98 44 L112 39 L119 34" stroke="#c9c2ff" strokeWidth="1.6" />
        <path d="M58 62 L72 58 L84 60 L98 55 L112 52 L119 49" stroke="#7ec8f2" strokeWidth="1.6" />
        <g strokeWidth="0.9">
          <path d="M58 59 L72 48 L84 51 L98 37 L112 31 L119 25" stroke="#a56584" />
          <path d="M58 63 L72 62 L84 64 L98 63 L112 62 L119 61" stroke="#6f6aa8" />
          <path d="M58 64 L72 66 L84 69 L98 72 L112 76 L119 80" stroke="#4f7f9e" />
          <path d="M58 65 L72 70 L84 74 L98 80 L112 85 L119 90" stroke="#6f6aa8" />
        </g>
        <path d="M6 62 H119" stroke="#e9e7ff" strokeWidth="1" />
      </g>
    </>
  ),
};

interface Props {
  here: string;
}

/** The other five, so a reader who liked this one has somewhere to go next. */
export function SeriesStrip({ here }: Props) {
  return (
    <nav className="strip" aria-labelledby="strip-title">
      <h2 id="strip-title">A series of six by Finn Lakin</h2>
      <p className="strip-sub">
        Each one takes a number people argue about and lets you check it against your own life. All six, and more about
        me, at <a href={PORTFOLIO}>finn-lakin-portfolio.netlify.app</a>.
      </p>
      <ul className="works">
        {SERIES.map((w) => {
          const isHere = w.slug === here;
          return (
            <li key={w.slug}>
              <a className={isHere ? "work here" : "work"} href={w.url} aria-current={isHere ? "page" : undefined}>
                <svg viewBox="0 0 125 100" aria-hidden="true">
                  {THUMBS[w.slug]}
                </svg>
                <span>
                  <small>{isHere ? `No. ${w.no} · You are here` : `No. ${w.no} · ${w.topic}`}</small>
                  <strong>{w.title}</strong>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
