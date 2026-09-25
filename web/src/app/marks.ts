// A column with rounded top corners and a square foot, as a path.
export function column(x: number, w: number, base: number, top: number, r = 3): string {
  const h = base - top;
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${base}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + w - rr}Q${x + w},${top} ${x + w},${top + rr}V${base}Z`;
}

// A bar growing rightwards with rounded ends on the data side.
export function bar(x: number, len: number, y: number, h: number, r = 3): string {
  if (len <= 0) return "";
  const rr = Math.min(r, len, h / 2);
  return `M${x},${y}H${x + len - rr}Q${x + len},${y} ${x + len},${y + rr}V${y + h - rr}Q${x + len},${y + h} ${x + len - rr},${y + h}H${x}Z`;
}
