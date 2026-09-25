// The result as a 1080 by 1350 picture, the shape that fills a phone screen in
// a feed. Drawn on a canvas in the browser; nothing is uploaded anywhere.

export interface CardContent {
  rate: number;
  name: string;
  council: string;
  standing: string;
  bins: number[];
  youBin: number;
}

export const CARD_W = 1080;
export const CARD_H = 1350;

const INK = "#14171a";
const TEXT = "#eef1f0";
const SOFT = "#bcc3c2";
const MUTED = "#939b9a";
const REST = "#434a49";
const YOU = "#3987e5";

const FONTS = [
  '700 300px "IBM Plex Sans Condensed"',
  '700 44px "IBM Plex Sans Condensed"',
  '600 52px "IBM Plex Sans"',
  '400 40px "IBM Plex Sans"',
  '400 32px "IBM Plex Mono"',
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

export function drawCard(canvas: HTMLCanvasElement, c: CardContent): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const P = 84;
  const inner = CARD_W - 2 * P;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // the mark: eight bands, D picked out
  [6, 7, 8, 9, 11, 13, 15, 18].forEach((h, i) => {
    ctx.fillStyle = i === 3 ? TEXT : REST;
    ctx.fillRect(P + i * 14, P + 40 - h * 2.2, 10, h * 2.2);
  });
  ctx.fillStyle = TEXT;
  ctx.font = '700 44px "IBM Plex Sans Condensed", sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Band D", P + 128, P + 40);

  ctx.fillStyle = SOFT;
  ctx.font = '400 40px "IBM Plex Sans", sans-serif';
  let y = P + 150;
  for (const line of wrap(ctx, "Council tax a year per £1,000 a home here is worth", inner)) {
    ctx.fillText(line, P, y);
    y += 52;
  }

  ctx.fillStyle = TEXT;
  ctx.font = '700 300px "IBM Plex Sans Condensed", sans-serif';
  ctx.fillText(`£${c.rate.toFixed(2)}`, P - 8, y + 250);
  y += 350;

  ctx.font = '600 52px "IBM Plex Sans", sans-serif';
  ctx.fillText(c.name, P, y);
  y += 52;
  ctx.fillStyle = MUTED;
  ctx.font = '400 36px "IBM Plex Sans", sans-serif';
  ctx.fillText(c.council, P, y);
  y += 84;

  ctx.fillStyle = TEXT;
  ctx.font = '400 40px "IBM Plex Sans", sans-serif';
  for (const line of wrap(ctx, c.standing, inner).slice(0, 3)) {
    ctx.fillText(line, P, y);
    y += 52;
  }

  // every home in England, the reader's column lit
  const base = CARD_H - P - 90;
  const height = Math.max(120, base - y - 60);
  const peak = Math.max(...c.bins);
  const slot = inner / c.bins.length;
  c.bins.forEach((v, i) => {
    if (!v) return;
    const h = (v / peak) * height;
    ctx.fillStyle = i === c.youBin ? YOU : REST;
    ctx.beginPath();
    ctx.roundRect(P + i * slot + 2, base - h, slot - 4, h, [4, 4, 0, 0]);
    ctx.fill();
  });

  // the reader's place, marked even where their column is too short to see
  const x = P + (c.youBin + 0.5) * slot;
  ctx.strokeStyle = YOU;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, base - height - 10);
  ctx.lineTo(x, base);
  ctx.stroke();
  ctx.fillStyle = YOU;
  ctx.beginPath();
  ctx.arc(x, base - height - 10, 10, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = MUTED;
  ctx.font = '400 32px "IBM Plex Mono", monospace';
  ctx.fillText("finntech3.github.io/band-d", P, CARD_H - P);
  ctx.textAlign = "right";
  ctx.font = '400 28px "IBM Plex Sans", sans-serif';
  ctx.fillText("2025 sales, 2026-27 bills", CARD_W - P, CARD_H - P);
  ctx.textAlign = "left";
}
