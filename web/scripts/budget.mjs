// Fail the build if the JavaScript a phone downloads before the first answer
// grows past 120 KB gzipped. The area data is fetched separately, after the
// page has painted, and is not counted here.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const LIMIT = 120 * 1024;
const dir = "dist/assets";
let total = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const size = gzipSync(readFileSync(`${dir}/${f}`), { level: 9 }).length;
  total += size;
  console.log(`${f}: ${(size / 1024).toFixed(1)} KB gzipped`);
}
console.log(`JavaScript total: ${(total / 1024).toFixed(1)} KB of ${LIMIT / 1024} KB`);
if (total > LIMIT) process.exit(1);
