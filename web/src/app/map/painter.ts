// Draws England as one dot per small area on a canvas, and moves around it.
//
// Every area sits where its residents live and is coloured by its rate. The
// dots are sorted into colour steps once, then drawn a step at a time from
// the neutral middle outwards, so the strongest colours sit on top instead of
// being buried in the crowd of ordinary areas. A faint glow sits under only
// the strongly coloured ones, which is what makes the ends shine.

import type { Points } from "../../lib/points";
import { MIDDLE, STEPS, ramp, rgb, stepOf, towardsFlat } from "../../lib/shade";

export interface Callout {
  index: number;
  label: string;
  value: string;
  colour: string;
  /** 1 puts the label to the right of the dot, -1 to the left, 0 towards the emptier side. */
  h: 1 | -1 | 0;
  /** -1 puts the label above the dot, 1 below, 0 towards the emptier side. */
  v: 1 | -1 | 0;
}

interface Options {
  /** Space kept clear at the bottom, for the postcode box that sits over the map. */
  bottom?: number;
  /** Space kept clear at the left, for the zoom buttons. */
  left?: number;
}

const DRAW_ORDER = Array.from({ length: STEPS }, (_, s) => s).sort(
  (a, b) => Math.abs(a - MIDDLE) - Math.abs(b - MIDDLE),
);
const CELL = 4000;
const TAU = Math.PI * 2;
export const MIN_ZOOM = 0.8;
export const MAX_ZOOM = 40;

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export class Painter {
  readonly canvas: HTMLCanvasElement;
  view: { cx: number; cy: number; k: number };
  /** How far along the revalue slider, 0 for today's bands, 1 for a flat charge. */
  mix = 0;
  selected = -1;
  hover = -1;
  callouts: Callout[] = [];

  private readonly ctx: CanvasRenderingContext2D;
  private readonly pts: Points;
  private readonly rates: Float64Array;
  private readonly national: number;
  private readonly bottom: number;
  private readonly left: number;
  private readonly grid = new Map<number, number[]>();
  private W = 0;
  private H = 0;
  private dpr = 1;
  private base = 1;
  private lut: string[] = [];
  private colours = { panel: "#fff", ink: "#000", ink2: "#333", rest: "#999" };
  private dark = false;
  private sorted = new Uint32Array(0);
  private starts = new Uint32Array(STEPS + 1);
  private unvalued: number[] = [];
  private frame = 0;
  private pending = 0;
  private layer: HTMLCanvasElement | null = null;
  private under: HTMLCanvasElement | null = null;
  private layerKey = "";
  private readonly stamps = new Map<string, HTMLCanvasElement>();
  private glowing = 0;
  /** Bumped whenever the colours or their order change, so the stored layer is redrawn. */
  private version = 0;

  constructor(canvas: HTMLCanvasElement, pts: Points, rates: Float64Array, national: number, opts: Options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.pts = pts;
    this.rates = rates;
    this.national = national;
    this.bottom = opts.bottom ?? 0;
    this.left = opts.left ?? 10;
    this.view = this.home();
    for (let i = 0; i < pts.x.length; i++) {
      const key = Math.floor(pts.x[i]! / CELL) * 100_000 + Math.floor(pts.y[i]! / CELL);
      let cell = this.grid.get(key);
      if (!cell) this.grid.set(key, (cell = []));
      cell.push(i);
      if (Number.isNaN(rates[i]!)) this.unvalued.push(i);
    }
    this.palette();
    this.sort();
  }

  home() {
    const p = this.pts;
    return { cx: (p.minX + p.maxX) / 2, cy: (p.minY + p.maxY) / 2, k: 1 };
  }

  /** Read the theme's colours. Called again whenever the theme changes. */
  palette(): void {
    const root = document.documentElement;
    this.dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    this.lut = ramp(rgb(css("--lo")), rgb(css("--mid")), rgb(css("--hi")));
    this.colours = { panel: css("--panel"), ink: css("--ink"), ink2: css("--ink-2"), rest: css("--rest") };
    this.version++;
  }

  colourOf(rate: number): string {
    return this.lut[stepOf(rate, this.national)]!;
  }

  /** Counting sort of the valued areas into colour steps. Cheap enough to redo as the slider moves. */
  sort(): void {
    const n = this.rates.length;
    const step = new Uint8Array(n);
    const counts = new Uint32Array(STEPS + 1);
    for (let i = 0; i < n; i++) {
      const r = this.rates[i]!;
      if (Number.isNaN(r)) continue;
      step[i] = stepOf(this.mix ? towardsFlat(r, this.national, this.mix) : r, this.national);
      counts[step[i]! + 1]!++;
    }
    for (let s = 0; s < STEPS; s++) counts[s + 1]! += counts[s]!;
    const sorted = new Uint32Array(counts[STEPS]!);
    const at = counts.slice();
    for (let i = 0; i < n; i++) if (!Number.isNaN(this.rates[i]!)) sorted[at[step[i]!]!++] = i;
    this.sorted = sorted;
    this.starts = counts;
    this.version++;
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    const p = this.pts;
    const pad = 12;
    this.base = Math.min((this.W - pad * 2) / (p.maxX - p.minX), (this.H - pad * 2 - this.bottom) / (p.maxY - p.minY));
    this.schedule();
  }

  /**
   * Draw on the next frame, once, however many times this is called before
   * then. A full draw of 33,755 dots is the most expensive thing on the page,
   * and several things ask for one while the page is settling.
   */
  schedule(): void {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      this.draw();
    });
  }

  toScreen(x: number, y: number): [number, number] {
    const k = this.base * this.view.k;
    return [this.W / 2 + (x - this.view.cx) * k, this.H / 2 - this.bottom / 2 - (y - this.view.cy) * k];
  }

  toWorld(sx: number, sy: number): [number, number] {
    const k = this.base * this.view.k;
    return [this.view.cx + (sx - this.W / 2) / k, this.view.cy - (sy - this.H / 2 + this.bottom / 2) / k];
  }

  /** The area nearest a point on screen, within `px` pixels, or -1. */
  nearest(sx: number, sy: number, px: number): number {
    const [x, y] = this.toWorld(sx, sy);
    const rad = px / (this.base * this.view.k);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const span = Math.ceil(rad / CELL);
    let best = -1;
    let bd = rad * rad;
    for (let gx = cx - span; gx <= cx + span; gx++) {
      for (let gy = cy - span; gy <= cy + span; gy++) {
        const cell = this.grid.get(gx * 100_000 + gy);
        if (!cell) continue;
        for (const i of cell) {
          const dx = this.pts.x[i]! - x;
          const dy = this.pts.y[i]! - y;
          const d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      }
    }
    return best;
  }

  pan(dx: number, dy: number): void {
    const k = this.base * this.view.k;
    this.view.cx -= dx / k;
    this.view.cy += dy / k;
    this.draw(true);
  }

  /** Zoom by a factor, keeping the point under (sx, sy) where it is. */
  zoomAt(f: number, sx = this.W / 2, sy = this.H / 2 - this.bottom / 2, fast = false): void {
    const before = this.toWorld(sx, sy);
    this.view.k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.view.k * f));
    const after = this.toWorld(sx, sy);
    this.view.cx += before[0] - after[0];
    this.view.cy += before[1] - after[1];
    this.draw(fast);
  }

  /** The zoom that fits a set of areas on screen. */
  fit(indices: number[]): { cx: number; cy: number; k: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const i of indices) {
      minX = Math.min(minX, this.pts.x[i]!);
      maxX = Math.max(maxX, this.pts.x[i]!);
      minY = Math.min(minY, this.pts.y[i]!);
      maxY = Math.max(maxY, this.pts.y[i]!);
    }
    const p = this.pts;
    const span = Math.max((maxX - minX) / (p.maxX - p.minX), (maxY - minY) / (p.maxY - p.minY), 1 / 30);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, k: Math.max(1, Math.min(MAX_ZOOM, 0.7 / span)) };
  }

  /**
   * Glide to a view, pulling back a little mid-flight so the reader sees
   * where they are going. Jumps straight there for reduced motion.
   */
  fly(to: { cx: number; cy: number; k: number }): void {
    const from = { ...this.view };
    const start = performance.now();
    const dur = reducedMotion() ? 0 : 1400;
    const l0 = Math.log(from.k);
    const l1 = Math.log(to.k);
    const dip = Math.min(1.2, Math.abs(l1 - l0) * 0.35 + 0.3);
    cancelAnimationFrame(this.frame);
    const step = (now: number) => {
      const p = dur ? Math.min(1, (now - start) / dur) : 1;
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      this.view.cx = from.cx + (to.cx - from.cx) * e;
      this.view.cy = from.cy + (to.cy - from.cy) * e;
      this.view.k = Math.exp(l0 + (l1 - l0) * e - (dur ? dip * Math.sin(Math.PI * e) : 0));
      this.draw(p < 1);
      if (p < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.pending);
    cancelAnimationFrame(this.glowing);
    this.pending = 0;
  }

  /**
   * `fast` skips the glow and the labels, for frames drawn mid-gesture. A full
   * draw keeps its dots in a second canvas, so a redraw that changes only a
   * label or a ring (fonts arriving, the pointer moving) copies them back
   * instead of painting 33,755 dots again.
   */
  draw(fast = false): void {
    const { ctx, dpr, W, H } = this;
    if (!W) return;
    if (fast) {
      this.paint(ctx, true);
    } else {
      const key = [W, H, dpr, this.view.cx, this.view.cy, this.view.k, this.mix, this.version].join();
      if (key !== this.layerKey) {
        const fresh = () => {
          const c = document.createElement("canvas");
          c.width = this.canvas.width;
          c.height = this.canvas.height;
          return c;
        };
        // Two stored layers: the background with the glow on it, and the dots
        // on their own above it, so the glow never washes the dots out.
        this.under = fresh();
        this.layer = fresh();
        this.paint(this.layer.getContext("2d")!, false);
        const under = this.under.getContext("2d")!;
        under.fillStyle = this.colours.panel;
        under.fillRect(0, 0, this.under.width, this.under.height);
        this.layerKey = key;
        // The glow goes on over the next few frames, a slice at a time, so the
        // dots appear at once and nothing holds up the page for long.
        cancelAnimationFrame(this.glowing);
        let from = 0;
        const more = () => {
          if (this.layerKey !== key) return;
          from = this.glow(under, from, performance.now() + 24);
          this.draw();
          if (from < DRAW_ORDER.length) this.glowing = requestAnimationFrame(more);
        };
        this.glowing = requestAnimationFrame(more);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(this.under!, 0, 0);
      ctx.drawImage(this.layer!, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const c of this.callouts) this.annotate(c);
    }
    const ring = this.selected >= 0 ? this.selected : this.hover;
    if (ring >= 0) {
      const [sx, sy] = this.toScreen(this.pts.x[ring]!, this.pts.y[ring]!);
      ctx.strokeStyle = this.colours.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 15, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** A filled circle in one colour step, `size` device pixels across, kept for reuse. */
  private stamp(step: number, size: number): HTMLCanvasElement {
    const key = `${step}|${size}|${this.version}`;
    let c = this.stamps.get(key);
    if (!c) {
      if (this.stamps.size > 400) this.stamps.clear();
      c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d")!;
      g.fillStyle = this.lut[step]!;
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2 - 1, 0, TAU);
      g.fill();
      this.stamps.set(key, c);
    }
    return c;
  }

  /** Where the dots go and how big they are, for the current view. */
  private geometry() {
    const k = this.base * this.view.k;
    // Dots grow with the map and with zoom, but more slowly than the map, so
    // cities stay separable when zoomed in.
    const grow = Math.max(1, Math.sqrt(this.base / 0.0006));
    return {
      k,
      ox: this.W / 2 - this.view.cx * k,
      oy: this.H / 2 - this.bottom / 2 + this.view.cy * k,
      r: Math.max(0.7, Math.min(6, 0.78 * grow * this.view.k ** 0.6)),
    };
  }

  /** Every dot, onto whichever canvas is given, over the background or over nothing. */
  private paint(ctx: CanvasRenderingContext2D, background: boolean): void {
    const { dpr, W, H } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (background) {
      ctx.fillStyle = this.colours.panel;
      ctx.fillRect(0, 0, W, H);
    } else ctx.clearRect(0, 0, W, H);
    const { k, ox, oy, r } = this.geometry();
    const X = this.pts.x;
    const Y = this.pts.y;

    const dots = (from: ArrayLike<number>, a: number, b: number, rad: number) => {
      if (rad < 1.6) {
        for (let j = a; j < b; j++) {
          const i = from[j]!;
          const sx = ox + X[i]! * k;
          const sy = oy - Y[i]! * k;
          if (sx < -4 || sy < -4 || sx > W + 4 || sy > H + 4) continue;
          ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
        }
        return;
      }
      ctx.beginPath();
      for (let j = a; j < b; j++) {
        const i = from[j]!;
        const sx = ox + X[i]! * k;
        const sy = oy - Y[i]! * k;
        if (sx < -rad || sy < -rad || sx > W + rad || sy > H + rad) continue;
        ctx.moveTo(sx + rad, sy);
        ctx.arc(sx, sy, rad, 0, TAU);
      }
      ctx.fill();
    };

    // Areas with too few sales to price: small, grey and underneath.
    ctx.fillStyle = this.colours.rest;
    ctx.globalAlpha = this.mix ? 0.3 : 0.9;
    dots(this.unvalued, 0, this.unvalued.length, r * 0.7);

    ctx.globalAlpha = this.dark ? 1 : 0.95;
    for (const s of DRAW_ORDER) {
      const a = this.starts[s]!;
      const b = this.starts[s + 1]!;
      if (a === b) continue;
      ctx.fillStyle = this.lut[s]!;
      dots(this.sorted, a, b, r);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * A faint glow around the strongly coloured areas, which is what makes the
   * two ends of England stand out. It shrinks as the reader zooms in, or
   * neighbouring glows merge into blobs. Each colour's glow is drawn once as a
   * small picture and stamped, which is faster than tracing thousands of circles.
   */
  /** Glows the colour steps from position `from` in DRAW_ORDER until `until`, and returns where it stopped. */
  private glow(ctx: CanvasRenderingContext2D, from: number, until: number): number {
    const { dpr, W, H } = this;
    const { k, ox, oy, r } = this.geometry();
    const X = this.pts.x;
    const Y = this.pts.y;
    const halo = r * (1 + 2.4 / Math.sqrt(this.view.k));
    const size = Math.ceil(halo * 2 * dpr) + 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = this.dark ? 0.05 : 0.045;
    ctx.globalCompositeOperation = this.dark ? "lighter" : "multiply";
    let n = from;
    for (; n < DRAW_ORDER.length; n++) {
      if (performance.now() > until) break;
      const s = DRAW_ORDER[n]!;
      if (Math.abs(s / MIDDLE - 1) < 0.4) continue;
      const a = this.starts[s]!;
      const b = this.starts[s + 1]!;
      if (a === b) continue;
      const stamp = this.stamp(s, size);
      for (let j = a; j < b; j++) {
        const i = this.sorted[j]!;
        const sx = ox + X[i]! * k;
        const sy = oy - Y[i]! * k;
        if (sx < -halo || sy < -halo || sx > W + halo || sy > H + halo) continue;
        ctx.drawImage(stamp, sx - halo, sy - halo, halo * 2, halo * 2);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    return n;
  }

  /**
   * A label with a leader line, as a printed map would have. Measured and
   * kept inside the canvas, clear of the zoom buttons and the postcode box.
   */
  private annotate(c: Callout): void {
    const { ctx, W, H } = this;
    const [sx, sy] = this.toScreen(this.pts.x[c.index]!, this.pts.y[c.index]!);
    if (sx < 0 || sy < 0 || sx > W || sy > H - this.bottom) return;
    const small = '400 11px "IBM Plex Mono", ui-monospace, monospace';
    const large = '700 23px "IBM Plex Sans Condensed", "IBM Plex Sans", sans-serif';
    ctx.font = small;
    const w1 = ctx.measureText(c.label).width;
    ctx.font = large;
    const wide = Math.max(w1, ctx.measureText(c.value).width);
    const h = c.h || (sx < W / 2 ? 1 : -1);
    const v = c.v || (sy > (H - this.bottom) / 2 ? -1 : 1);
    const clear = this.left + 8;
    let tx = h > 0 ? sx + 22 : sx - 26;
    tx = h > 0 ? Math.max(clear, Math.min(W - 10 - wide, tx)) : Math.min(W - 10, Math.max(clear + wide, tx));
    const ty = v < 0 ? Math.max(40, sy - 42) : Math.min(H - this.bottom - 16, sy + 58);

    ctx.strokeStyle = this.colours.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(h > 0 ? tx + 4 : tx - 4, ty + (v < 0 ? 8 : -26));
    ctx.stroke();
    ctx.fillStyle = this.colours.ink;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.8, 0, TAU);
    ctx.fill();

    ctx.textAlign = h > 0 ? "left" : "right";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.colours.panel;
    ctx.font = small;
    ctx.fillStyle = this.colours.ink2;
    ctx.strokeText(c.label, tx, ty - 17);
    ctx.fillText(c.label, tx, ty - 17);
    ctx.font = large;
    ctx.fillStyle = c.colour;
    ctx.strokeText(c.value, tx, ty + 3);
    ctx.fillText(c.value, tx, ty + 3);
  }
}
