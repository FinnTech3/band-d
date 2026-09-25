import { BANDS, NINTHS } from "../lib/england";
import { gbp } from "../lib/format";
import { useWidth } from "./hooks";
import { bar } from "./marks";

// The top of each band's 1991 value range; H has no ceiling.
const RANGE_1991 = ["to £40k", "to £52k", "to £68k", "to £88k", "to £120k", "to £160k", "to £320k", "over £320k"];

interface Props {
  bandD: number;
  homesByBand: number[];
  council: string;
  place: string;
}

/** The eight bands in the reader's council: what each pays, and how many homes here are in it. */
export function BandsChart({ bandD, homesByBand, council, place }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(460);
  const homes = homesByBand.reduce((a, b) => a + b, 0);
  const narrow = W < 400;
  const L = narrow ? 102 : 112;
  const share = 44;
  const valueRoom = 58;
  const top = 26;
  const row = 36;
  const H = top + 8 * row + 8;
  const span = W - L - share - valueRoom;
  const max = (bandD * 18) / 9;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="bands-desc">
        <desc id="bands-desc">
          {`Council tax by band in ${council}, 2026-27: from ${gbp((bandD * 6) / 9)} in Band A to ${gbp(bandD * 2)} in Band H. ` +
            BANDS.map((b, i) => `Band ${b}: ${Math.round((100 * homesByBand[i]!) / homes)}% of homes in ${place}`).join(
              ", ",
            ) +
            "."}
        </desc>
        <text className="c-note" x={0} y={12}>
          Band, 1991 value
        </text>
        <text className="c-note" x={L} y={12}>
          2026-27 bill
        </text>
        <text className="c-note" x={W} y={12} textAnchor="end">
          Homes here
        </text>
        {BANDS.map((b, i) => {
          const y = top + i * row;
          const bill = (bandD * NINTHS[i]!) / 9;
          const len = (bill / max) * span;
          const s = homes ? homesByBand[i]! / homes : 0;
          const main = s >= 0.25;
          return (
            <g key={b}>
              <text className="c-band" x={0} y={y + 16}>
                {b}
              </text>
              <text className="c-note" x={20} y={y + 15}>
                {RANGE_1991[i]}
              </text>
              <path className={main ? "c-you" : "c-rest"} d={bar(L, len, y + 3, 18, 4)} />
              <text className="c-value" x={L + len + 6} y={y + 16}>
                {gbp(bill)}
              </text>
              <text className={main ? "c-strong" : "c-value"} x={W} y={y + 16} textAnchor="end">
                {s > 0 && s < 0.005 ? "<1%" : `${Math.round(100 * s)}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
