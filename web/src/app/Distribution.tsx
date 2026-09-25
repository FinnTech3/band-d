import { useMemo } from "react";
import { type England, binOf } from "../lib/england";
import { gbp } from "../lib/format";
import { useWidth } from "./hooks";
import { column } from "./marks";

const LO = 0.25;
const HI = 60;
const TICKS = [0.5, 1, 2, 5, 10, 20, 50];

interface Props {
  england: England;
  rate: number;
  label: string;
}

/** Every home in England, by what its area pays per £1,000, with the reader lit. */
export function Distribution({ england, rate, label }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const n = W < 520 ? 40 : 60;
  const bins = useMemo(() => england.bins(LO, HI, n), [england, n]);
  const median = england.middle.rate;

  const H = W < 520 ? 250 : 290;
  const T = 60;
  const B = H - 30;
  const L = 2;
  const R = 2;
  const peak = Math.max(...bins);
  const x = (v: number) => L + ((Math.log(v) - Math.log(LO)) / (Math.log(HI) - Math.log(LO))) * (W - L - R);
  const slot = (W - L - R) / n;
  const gap = slot > 8 ? 2 : 1;
  const you = binOf(rate, LO, HI, n);
  const xy = x(Math.min(HI, Math.max(LO, rate)));
  const xm = x(median);

  const youText = `${label}: ${gbp(rate, 2)}`;
  const youEnd = xy > W * 0.6;
  const medText =
    W < 520 ? `Half of homes: under ${gbp(median, 2)}` : `Half of England's homes pay under ${gbp(median, 2)}`;
  const medEnd = xm > W * 0.6;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="dist-desc">
        <desc id="dist-desc">
          {`Homes in England by what their area pays in council tax a year per £1,000 of home value, on a log scale from ${gbp(LO, 2)} to ${gbp(HI)}. Half of homes are in areas paying under ${gbp(median, 2)}. ${label} pays ${gbp(rate, 2)}.`}
        </desc>
        {bins.map((c, i) =>
          c ? (
            <path
              key={i}
              className={i === you ? "c-you" : "c-rest"}
              d={column(L + i * slot + gap / 2, slot - gap, B, B - (c / peak) * (B - T), 3)}
            />
          ) : null,
        )}
        <line className="c-base" x1={L} x2={W - R} y1={B + 0.5} y2={B + 0.5} />
        {TICKS.map((v) => (
          <text key={v} className="c-tick" x={x(v)} y={B + 20} textAnchor="middle">
            {v < 1 ? "£0.50" : `£${v}`}
          </text>
        ))}
        <line className="c-you-line" x1={xy} x2={xy} y1={18} y2={B} strokeWidth={2} />
        <line className="c-guide" x1={xm} x2={xm} y1={40} y2={B} strokeDasharray="3 3" />
        <text className="c-label c-halo" x={xm + (medEnd ? -6 : 6)} y={48} textAnchor={medEnd ? "end" : "start"}>
          {medText}
        </text>
        <circle className="c-you" cx={xy} cy={18} r={5} />
        <text className="c-strong c-halo" x={xy + (youEnd ? -10 : 10)} y={23} textAnchor={youEnd ? "end" : "start"}>
          {youText}
        </text>
      </svg>
    </div>
  );
}
