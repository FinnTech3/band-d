// Where each area sits on the map, decoded from data/built/points.json: the
// ONS population-weighted centroid, in British National Grid metres, in the
// same order as the areas. The file stores hundreds of metres as gaps from
// the previous area; build.py explains why.

export interface PointsFile {
  step: number;
  x: number[];
  y: number[];
}

export interface Points {
  x: Float64Array;
  y: Float64Array;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function decodePoints(file: PointsFile): Points {
  const n = file.x.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  let px = 0;
  let py = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    px += file.x[i]!;
    py += file.y[i]!;
    x[i] = px * file.step;
    y[i] = py * file.step;
    if (x[i]! < minX) minX = x[i]!;
    if (x[i]! > maxX) maxX = x[i]!;
    if (y[i]! < minY) minY = y[i]!;
    if (y[i]! > maxY) maxY = y[i]!;
  }
  return { x, y, minX, maxX, minY, maxY };
}

/** True when a parsed JSON body looks like the points file, before it is decoded. */
export function looksLikePointsFile(x: unknown): x is PointsFile {
  if (typeof x !== "object" || x === null) return false;
  const f = x as Partial<PointsFile>;
  return Array.isArray(f.x) && Array.isArray(f.y) && typeof f.step === "number";
}
