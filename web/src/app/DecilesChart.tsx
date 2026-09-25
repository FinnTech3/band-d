import type { Decile } from "../lib/summary";
import { gbp } from "../lib/format";
import { useWidth } from "./hooks";
import { column } from "./marks";

interface Props {
  deciles: Decile[];
  you: number | undefined;
}

/** England's homes in ten equal groups by value, and what each pays per £1,000. */
export function DecilesChart({ deciles, you }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(460);
  const H = 300;
  const L = 34;
  const T = 30;
  const B = H - 50;
  const peak = 14;
  const n = deciles.length;
  const slot = (W - L) / n;
  const w = Math.min(28, slot - 6);
  const y = (v: number) => B - (v / peak) * (B - T);
  const first = deciles[0]!;
  const last = deciles[n - 1]!;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="dec-desc">
        <desc id="dec-desc">
          {`Council tax a year per £1,000 of home value, by tenth of England's homes from cheapest to dearest: ` +
            deciles.map((d) => gbp(d.rate, 2)).join(", ") +
            "."}
        </desc>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line className={v ? "c-grid" : "c-base"} x1={L} x2={W} y1={y(v) + 0.5} y2={y(v) + 0.5} />
            <text className="c-tick" x={L - 6} y={y(v) + 4} textAnchor="end">
              £{v}
            </text>
          </g>
        ))}
        {deciles.map((d, i) => {
          const cx = L + slot * i + slot / 2;
          const lit = d.decile === you;
          const labelled = lit || i === 0 || i === n - 1;
          return (
            <g key={d.decile}>
              <path className={lit ? "c-you" : "c-rest"} d={column(cx - w / 2, w, B, y(d.rate), 4)} />
              {labelled && (
                <text className="c-value" x={cx} y={y(d.rate) - 8} textAnchor="middle">
                  {gbp(d.rate, 2)}
                </text>
              )}
              {lit && (
                <text className="c-strong" x={cx} y={B + 18} textAnchor="middle">
                  You
                </text>
              )}
            </g>
          );
        })}
        <text className="c-note" x={L} y={B + 38}>
          cheapest tenth
        </text>
        <text className="c-note" x={W} y={B + 38} textAnchor="end">
          dearest tenth
        </text>
      </svg>
      <p className="note">
        {`Homes in the dearest tenth are worth ${(last.average_value / first.average_value).toFixed(1)} times those in the cheapest; their bills are ${(last.average_bill / first.average_bill).toFixed(2)} times bigger.`}
      </p>
    </div>
  );
}
