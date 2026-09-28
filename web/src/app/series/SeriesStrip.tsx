import type { ReactNode } from "react";
import { PORTFOLIO, SERIES } from "./series";

// A small picture of each tool, drawn once by hand in its own colours.
const THUMBS: Record<string, ReactNode> = {
  "degree-value": (
    <>
      <rect width="125" height="100" fill="#10193a" />
      <g strokeLinecap="round" fill="none" strokeWidth="3">
        <path d="M10 18 H70" stroke="#c9d3ea" />
        <path d="M10 28 H78" stroke="#c9d3ea" />
        <path d="M10 38 H96" stroke="#9fb0da" />
        <path d="M10 48 H115" stroke="#7d8fc4" />
        <path d="M10 58 H115" stroke="#7d8fc4" />
        <path d="M10 68 H90" stroke="#9fb0da" />
        <path d="M10 78 H115" stroke="#6b7db8" />
        <path d="M10 88 H60" stroke="#c9d3ea" />
      </g>
    </>
  ),
  "pension-pot": (
    <>
      <rect width="125" height="100" fill="#2a1f4a" />
      <rect y="50" width="125" height="50" fill="#5a3d6c" />
      <path d="M0 80 L18 62 L30 70 L48 44 L62 30 L74 46 L88 38 L100 58 L112 50 L125 66 V100 H0Z" fill="#1a1530" />
      <path
        d="M0 80 L18 62 L30 70 L48 44 L62 30 L74 46 L88 38 L100 58 L112 50 L125 66"
        fill="none"
        stroke="#f2c6d6"
        strokeWidth="1.5"
      />
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
      <g fill="none" strokeLinecap="round">
        <path d="M14 70 C50 64, 80 40, 118 22" stroke="#e9e7ff" strokeWidth="1.4" />
        <path d="M14 70 C50 66, 84 52, 118 40" stroke="#9c93f0" strokeWidth="1.1" />
        <path d="M14 70 C50 70, 86 64, 118 60" stroke="#e8739e" strokeWidth="1.1" />
        <path d="M14 70 C50 74, 86 80, 118 84" stroke="#4d4a7a" strokeWidth="0.9" />
        <path d="M14 70 C50 60, 76 30, 118 12" stroke="#4d4a7a" strokeWidth="0.9" />
      </g>
      <g fill="#fff">
        <circle cx="30" cy="20" r="0.8" />
        <circle cx="52" cy="14" r="0.6" />
        <circle cx="96" cy="72" r="0.7" />
        <circle cx="104" cy="10" r="0.9" />
      </g>
    </>
  ),
};

interface Props {
  here: string;
  /** This site's own picture, drawn from its data. */
  ownThumb?: ReactNode;
}

/** The other five, so a reader who liked this one has somewhere to go next. */
export function SeriesStrip({ here, ownThumb }: Props) {
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
                  {isHere && ownThumb ? ownThumb : THUMBS[w.slug]}
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
