// The result as a 1080 by 1350 picture, the shape that fills a phone screen in
// a feed, laid out like a valuation slip: the rate, the place, a stamp, and a
// small map of England from the same dots as the page, with the area ringed.
// Drawn on a canvas in the browser; nothing is uploaded anywhere.

import type { Points } from "../lib/points";
import { MIDDLE, STEPS, ramp, rgb, stepOf } from "../lib/shade";

export interface CardContent {
  rate: number;
  name: string;
  council: string;
  standing: string;
  national: number;
  points: Points;
  rates: Float64Array;
  /** The area to ring on the map, or -1. */
  index: number;
}

export const CARD_W = 1080;
export const CARD_H = 1350;

// The page's light theme, fixed, so the picture looks the same whoever saves it.
const PAPER = "#f3eee2";
const INK = "#17231d";
const INK_2 = "#3f4c45";
const MUTED = "#5a665f";
const RULE = "#d6ccb6";
const STAMP = "#a3243c";
const LUT = ramp(rgb("#1b4f9c"), rgb("#c4b89d"), rgb("#b0243f"));

const FONTS = [
  '700 250px "IBM Plex Sans Condensed"',
  '600 56px "IBM Plex Serif"',
  'italic 600 56px "IBM Plex Serif"',
  '400 36px "IBM Plex Sans"',
  '400 26px "IBM Plex Mono"',
];

export async function fontsReady(): Promise<void> {
  try {
    await Promise.all(FONTS.map((f) => document.fonts.load(f)));
  } catch {
    // The card still draws in the fallback fonts.
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** England in dots, fitted into a box, neutral colours first so the ends sit on top. */
function miniMap(ctx: CanvasRenderingContext2D, c: CardContent, x0: number, y0: number, w: number, h: number) {
  const p = c.points;
  const k = Math.min(w / (p.maxX - p.minX), h / (p.maxY - p.minY));
  const ox = x0 + (w - (p.maxX - p.minX) * k) / 2;
  const oy = y0 + h - (h - (p.maxY - p.minY) * k) / 2;
  const sx = (i: number) => ox + (p.x[i]! - p.minX) * k;
  const sy = (i: number) => oy - (p.y[i]! - p.minY) * k;
  const byStep: number[][] = Array.from({ length: STEPS }, () => []);
  for (let i = 0; i < c.rates.length; i++) {
    const r = c.rates[i]!;
    if (!Number.isNaN(r)) byStep[stepOf(r, c.national)]!.push(i);
  }
  const order = byStep.map((_, s) => s).sort((a, b) => Math.abs(a - MIDDLE) - Math.abs(b - MIDDLE));
  for (const s of order) {
    ctx.fillStyle = LUT[s]!;
    for (const i of byStep[s]!) ctx.fillRect(sx(i) - 1.3, sy(i) - 1.3, 2.6, 2.6);
  }
  if (c.index >= 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx(c.index), sy(c.index), 16, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(c.index), sy(c.index), 28, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.14);
  ctx.strokeStyle = STAMP;
  ctx.fillStyle = STAMP;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(-150, -62, 300, 124, 14);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.fillText("V A L U E D", 0, -14);
  ctx.font = '700 46px "IBM Plex Sans Condensed", sans-serif';
  ctx.fillText("1 APR 1991", 0, 36);
  ctx.restore();
}

export function drawCard(canvas: HTMLCanvasElement, c: CardContent): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const P = 84;
  const inner = CARD_W - 2 * P;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // the seal and the series line
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(P + 34, P + 34, 34, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = 'italic 600 28px "IBM Plex Serif", serif';
  ctx.fillText("FL", P + 34, P + 44);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px "IBM Plex Mono", monospace';
  ctx.fillText("FINN LAKIN · NO. 1 OF 6", P + 90, P + 30);
  ctx.fillText("COUNCIL TAX", P + 90, P + 62);
  stamp(ctx, CARD_W - P - 150, P + 60);

  let y = P + 200;
  ctx.fillStyle = INK_2;
  ctx.font = '400 36px "IBM Plex Sans", sans-serif';
  for (const line of wrap(ctx, "Council tax a year for every £1,000 a home here is worth", inner - 120)) {
    ctx.fillText(line, P, y);
    y += 46;
  }

  ctx.fillStyle = LUT[stepOf(c.rate, c.national)]!;
  ctx.font = '700 250px "IBM Plex Sans Condensed", sans-serif';
  ctx.fillText(`£${c.rate.toFixed(2)}`, P - 8, y + 210);
  y += 290;

  ctx.fillStyle = INK;
  ctx.font = '600 56px "IBM Plex Serif", serif';
  ctx.fillText(c.name, P, y);
  y += 50;
  ctx.fillStyle = MUTED;
  ctx.font = '400 34px "IBM Plex Sans", sans-serif';
  ctx.fillText(c.council, P, y);
  y += 44;

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 10]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(P, y);
  ctx.lineTo(CARD_W - P, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 40;

  // the map on the left, the sentence beside it
  const mapW = 360;
  const mapH = CARD_H - P - 70 - y;
  miniMap(ctx, c, P, y, mapW, mapH);
  const tx = P + mapW + 40;
  const tw = CARD_W - P - tx;
  ctx.fillStyle = INK;
  ctx.font = 'italic 400 38px "IBM Plex Serif", serif';
  let ty = y + 50;
  for (const line of wrap(ctx, c.standing, tw).slice(0, 6)) {
    ctx.fillText(line, tx, ty);
    ty += 52;
  }
  ty += 30;
  ctx.font = '400 24px "IBM Plex Mono", monospace';
  for (const [colour, label, dy] of [
    [LUT[0]!, "PAYS LESS THAN ENGLAND", 0],
    [LUT[STEPS - 1]!, "PAYS MORE", 38],
  ] as const) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(tx + 9, ty + dy - 8, 9, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = INK_2;
    ctx.fillText(label, tx + 30, ty + dy);
  }

  ctx.fillStyle = MUTED;
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.fillText("finntech3.github.io/band-d", P, CARD_H - P);
  ctx.textAlign = "right";
  ctx.font = '400 26px "IBM Plex Sans", sans-serif';
  ctx.fillText("2025 sales, 2026-27 bills", CARD_W - P, CARD_H - P);
  ctx.textAlign = "left";
}
