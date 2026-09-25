import type { Summary } from "../lib/summary";

function pct(x: number): string {
  return `${(100 * x).toFixed(1)}%`;
}

/** The four checks against published figures, worded from their own numbers. */
export function Checks({ summary }: { summary: Summary }) {
  const by = Object.fromEntries(summary.checks.map((c) => [c.name, c]));
  const oldest = Object.keys(summary.price_checks).sort()[0]!;
  const price = summary.price_checks[oldest]!;
  const n = (name: string, key: string) => Number(by[name]?.detail[key]);
  const items = [
    {
      check: by["band ratios"],
      title: "The band arithmetic matches every council's own returns",
      text: `${n("band ratios", "cells").toLocaleString("en-GB")} council and band figures rebuilt from the councils' tax base returns; the largest difference is ${n("band ratios", "largest_gap").toFixed(2)} of a Band D home.`,
    },
    {
      check: by["council charges"],
      title: "Every council's Band D bill adds up",
      text: `Its own charge, parishes included, plus the county, police, fire and combined authority charges, to the penny, for all ${n("council charges", "councils")} councils.`,
    },
    {
      check: by["homes by band"],
      title: "Two government systems count the same homes",
      text: `The valuation list and the councils' tax base agree on the number of homes to within 1% for ${pct(n("homes by band", "share_within"))} of councils.`,
    },
    {
      check: by["house prices"],
      title: "House prices rebuilt sale by sale from the Land Registry",
      text: `They match the ONS's own small-area medians to the pound in ${pct(price.exact_share)} of areas for 2020, and less for each later year, as sales registered after the ONS took its copy would predict.`,
    },
  ];
  return (
    <ul className="checks">
      {items.map(({ check, title, text }) => (
        <li key={title}>
          <span className={check?.passed ? "pill" : "pill fail"}>{check?.passed ? "Pass" : "Fail"}</span>
          <div>
            <b>{title}</b>
            <span>{text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
