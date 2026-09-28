import { useEffect, useRef, useState } from "react";
import type { England } from "../lib/england";
import { gbp, pctDown } from "../lib/format";
import type { Points } from "../lib/points";
import { towardsFlat } from "../lib/shade";
import { Painter } from "./map/painter";

interface Props {
  england: England;
  points: Points;
  national: number;
  /** Share of homes that would pay less under a flat charge, from the pipeline. */
  payingLess: number;
  dark: boolean;
}

/**
 * The same map, with a slider that moves every bill in a straight line from
 * today's to a flat charge on value. Arithmetic only.
 */
export function Revalue({ england, points, national, payingLess, dark }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const painter = useRef<Painter | null>(null);
  const [t, setT] = useState(0);
  const [near, setNear] = useState(false);

  // Nothing is drawn until the map is about to scroll into view, so the first
  // screen does not wait for a second copy of England.
  useEffect(() => {
    const c = canvas.current;
    if (!c || near) return;
    if (typeof IntersectionObserver !== "function") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "600px",
    });
    io.observe(c);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    const c = canvas.current!;
    const p = new Painter(c, points, england.rates, national);
    painter.current = p;
    p.resize();
    const ro = new ResizeObserver(() => p.resize());
    ro.observe(c);
    return () => {
      ro.disconnect();
      p.stop();
      painter.current = null;
    };
  }, [near, england, points, national]);

  useEffect(() => {
    const p = painter.current;
    if (!p) return;
    p.palette();
    p.schedule();
  }, [dark, near]);

  useEffect(() => {
    const p = painter.current;
    if (!p) return;
    p.mix = t;
    p.sort();
    p.schedule();
  }, [t, near]);

  const lo = england.lowest;
  const hi = england.highest;
  const flat = gbp(national, 2);
  const verdict =
    t === 0
      ? `Today: from ${gbp(lo.rate, 2)} in ${lo.name} to ${gbp(hi.rate, 2)} in ${hi.name}, ${hi.rate / lo.rate > 100 ? "more than a hundred" : Math.round(hi.rate / lo.rate)} times as much.`
      : t === 1
        ? `Every home pays ${flat} for every £1,000 it is worth, and ${pctDown(payingLess, 0)} of homes pay less than they do now.`
        : `${Math.round(t * 100)}% of the way: from ${gbp(towardsFlat(lo.rate, national, t), 2)} to ${gbp(towardsFlat(hi.rate, national, t), 2)}.`;

  return (
    <section className="revalue" aria-labelledby="revalue-title">
      <div className="eyebrow">What if</div>
      <h2 id="revalue-title">Charge every home on what it is worth, and the map goes quiet.</h2>
      <p className="sub">
        {`Slide from the bands set in 1991 to a flat ${flat} for every £1,000 a home is worth, which raises the same total from the same homes. Every bill moves in a straight line from one to the other.`}
      </p>
      <div className="revalue-body">
        <figure className="map quiet">
          <canvas
            ref={canvas}
            role="img"
            aria-label={`The map of England again, recoloured ${Math.round(t * 100)}% of the way from today's bands to a flat charge on value.`}
          />
        </figure>
        <div className="slider">
          <label htmlFor="revalue">From 1991 bands to a flat charge on value</label>
          <input
            id="revalue"
            type="range"
            min={0}
            max={100}
            value={Math.round(t * 100)}
            onChange={(e) => setT(Number(e.target.value) / 100)}
            aria-valuetext={`${Math.round(t * 100)}% of the way`}
          />
          <div className="ends" aria-hidden="true">
            <span>Bands, as set in 1991</span>
            <span>{`A flat ${flat}`}</span>
          </div>
          <p className="verdict" aria-live="polite">
            {verdict}
          </p>
          <p className="caveat">
            Arithmetic, not a proposal. A real reform would have to deal with people whose home is worth far more than
            their income.
          </p>
        </div>
      </div>
    </section>
  );
}
