// Copy the pipeline's output into the app, so the app never holds a number
// the pipeline did not write. Run before dev, test and build.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/data", { recursive: true });
for (const name of ["areas.json", "summary.json"]) {
  copyFileSync(`../data/built/${name}`, `public/data/${name}`);
}
