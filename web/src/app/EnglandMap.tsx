import { type ReactNode, useEffect, useRef, useState } from "react";
import type { England } from "../lib/england";
import { gbp } from "../lib/format";
import type { Points } from "../lib/points";
import { type Callout, Painter } from "./map/painter";

export type Focus = { kind: "area"; index: number } | { kind: "council"; code: string } | null;

interface Props {
  england: England;
  points: Points;
  national: number;
  focus: Focus;
  dark: boolean;
  onPick: (index: number) => void;
  /** The postcode box, laid over the foot of the map. */
  children: ReactNode;
}

const ZOOM_STEP = 1.6;
const SELECTED_ZOOM = 6;

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * England as 33,755 dots, one per small area. The reader can drag, pinch,
 * scroll or use the arrow keys to move around, and tap any dot to see what
 * that area pays.
 */
export function EnglandMap({ england, points, national, focus, dark, onPick, children }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const painter = useRef<Painter | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const first = useRef(true);
  const pick = useRef(onPick);
  pick.current = onPick;

  function callouts(p: Painter): Callout[] {
    if (!focus) {
      const lo = england.lowest;
      const hi = england.highest;
      return [
        {
          index: england.indexOf(lo.code),
          label: lo.name,
          value: gbp(lo.rate, 2),
          colour: p.colourOf(lo.rate),
          h: -1,
          v: 1,
        },
        {
          index: england.indexOf(hi.code),
          label: hi.name,
          value: gbp(hi.rate, 2),
          colour: p.colourOf(hi.rate),
          h: 1,
          v: -1,
        },
      ];
    }
    if (focus.kind === "area") {
      const a = england.at(focus.index);
      return [
        {
          index: focus.index,
          label: a.name,
          value: a.rate === null ? "too few sales" : gbp(a.rate, 2),
          // Set in ink: the area's own colour is often pale and would vanish into the dots around it.
          colour: getComputedStyle(document.documentElement).getPropertyValue("--ink"),
          h: 0,
          v: 0,
        },
      ];
    }
    return [];
  }

  useEffect(() => {
    const c = canvas.current!;
    const p = new Painter(c, points, england.rates, national, { bottom: 70, left: 58 });
    painter.current = p;
    p.callouts = callouts(p);
    p.resize();
    const ro = new ResizeObserver(() => p.resize());
    ro.observe(c);
    // The labels are drawn in Plex; draw again once it has arrived.
    document.fonts?.ready.then(() => p.schedule());
    return () => {
      ro.disconnect();
      p.stop();
    };
    // Made once; theme and focus changes reach it through the effects below.
  }, [england, points, national]);

  useEffect(() => {
    const p = painter.current;
    if (!p) return;
    const redo = () => {
      p.palette();
      p.callouts = callouts(p);
      p.schedule();
    };
    redo();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", redo);
    return () => mq.removeEventListener("change", redo);
  }, [dark]);

  useEffect(() => {
    const p = painter.current;
    if (!p) return;
    p.callouts = callouts(p);
    p.selected = focus?.kind === "area" ? focus.index : -1;
    if (first.current) {
      first.current = false;
      // A shared link opens straight onto its area, without a flight.
      if (focus?.kind === "area") p.view = { cx: points.x[focus.index]!, cy: points.y[focus.index]!, k: SELECTED_ZOOM };
      p.schedule();
      return;
    }
    if (!focus) p.fly(p.home());
    else if (focus.kind === "area") p.fly({ cx: points.x[focus.index]!, cy: points.y[focus.index]!, k: SELECTED_ZOOM });
    else p.fly(p.fit(england.indicesIn(focus.code)));
  }, [focus]);

  // Drag to move, pinch or scroll to zoom, tap to choose.
  useEffect(() => {
    const c = canvas.current!;
    const down = new Map<number, [number, number]>();
    let moved = false;
    let last: [number, number] = [0, 0];
    let pinch: { d: number; k: number } | null = null;
    const at = (e: PointerEvent): [number, number] => [e.offsetX, e.offsetY];

    const onDown = (e: PointerEvent) => {
      const p = painter.current;
      if (!p) return;
      p.stop();
      c.setPointerCapture(e.pointerId);
      down.set(e.pointerId, at(e));
      moved = false;
      last = at(e);
      if (down.size === 2) {
        const [a, b] = [...down.values()] as [[number, number], [number, number]];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: p.view.k };
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = painter.current;
      if (!p) return;
      if (down.has(e.pointerId)) {
        down.set(e.pointerId, at(e));
        if (down.size === 2 && pinch) {
          const [a, b] = [...down.values()] as [[number, number], [number, number]];
          const k = (pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1])) / pinch.d;
          p.zoomAt(k / p.view.k, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, true);
          moved = true;
          return;
        }
        const [x, y] = at(e);
        if (Math.abs(x - last[0]) + Math.abs(y - last[1]) > 2) moved = true;
        p.pan(x - last[0], y - last[1]);
        last = [x, y];
        return;
      }
      if (e.pointerType !== "mouse") return;
      const i = p.nearest(e.offsetX, e.offsetY, 12);
      if (i !== p.hover) {
        p.hover = i;
        p.schedule();
      }
      if (i < 0) setTip(null);
      else {
        const a = england.at(i);
        setTip({
          x: e.offsetX,
          y: e.offsetY,
          text: `${a.name} · ${a.rate === null ? "too few sales" : gbp(a.rate, 2)}`,
        });
      }
    };
    const onUp = (e: PointerEvent) => {
      const p = painter.current;
      if (!p) return;
      down.delete(e.pointerId);
      if (down.size < 2) pinch = null;
      if (!moved && down.size === 0) {
        const i = p.nearest(e.offsetX, e.offsetY, 16);
        if (i >= 0) pick.current(i);
      }
      p.schedule();
    };
    const onLeave = () => {
      setTip(null);
      const p = painter.current;
      if (p && p.hover >= 0) {
        p.hover = -1;
        p.schedule();
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      painter.current?.zoomAt(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
    };
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("pointerleave", onLeave);
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
      c.removeEventListener("pointerleave", onLeave);
      c.removeEventListener("wheel", onWheel);
    };
  }, [england]);

  function onKey(e: React.KeyboardEvent) {
    const p = painter.current;
    if (!p) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [40, 0],
      ArrowRight: [-40, 0],
      ArrowUp: [0, 40],
      ArrowDown: [0, -40],
    };
    const m = moves[e.key];
    if (m) p.pan(m[0], m[1]);
    else if (e.key === "+" || e.key === "=") p.zoomAt(ZOOM_STEP);
    else if (e.key === "-") p.zoomAt(1 / ZOOM_STEP);
    else return;
    e.preventDefault();
    p.schedule();
  }

  const lo = england.lowest;
  const hi = england.highest;
  return (
    <figure className="map">
      <div className="stamp" aria-hidden="true">
        Valued<b>1 Apr 1991</b>
      </div>
      <canvas
        ref={canvas}
        tabIndex={0}
        role="img"
        onKeyDown={onKey}
        aria-label={`Map of England made of ${england.size.toLocaleString("en-GB")} dots, one for each small area, coloured by how much council tax it pays for what its homes are worth. Inner London is blue: it pays the least, as little as ${gbp(lo.rate, 2)} per £1,000 in ${lo.name}. County Durham, Teesside, Liverpool and Hull are red: up to ${gbp(hi.rate, 2)} per £1,000 in ${hi.name}. Arrow keys move the map; plus and minus zoom.`}
      />
      <div className="zoom">
        <button type="button" aria-label="Zoom in" onClick={() => painter.current?.zoomAt(ZOOM_STEP)}>
          <Icon d="M8 3v10M3 8h10" />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => painter.current?.zoomAt(1 / ZOOM_STEP)}>
          <Icon d="M3 8h10" />
        </button>
        <button
          type="button"
          aria-label="Show all of England"
          onClick={() => {
            const p = painter.current;
            if (p) p.fly(p.home());
          }}
        >
          <Icon d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.5v2.4h2.4" />
        </button>
      </div>
      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          {tip.text}
        </div>
      )}
      <div className="find">{children}</div>
    </figure>
  );
}
