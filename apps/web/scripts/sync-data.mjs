// Copies the files the site fetches at runtime from the repo's data/ folder into public/data/.
// data/ stays the single source of truth; public/data/ is generated (and git-ignored).
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../data");
const out = resolve(here, "../public/data");

const FILES = [
  "mayor-2022.json",
  "council-2022.json",
  "mayor-2022-towns.json",
  "taiwan-atlas-counties-10t.json",
  "taiwan-atlas-towns-10t.json",
  "party-emblems/kmt.svg",
  "party-emblems/dpp.svg",
  "party-emblems/tpp.svg",
];

let copied = 0;
for (const f of FILES) {
  const from = join(src, f), to = join(out, f);
  const a = statSync(from);
  let fresh = false;
  try {
    const b = statSync(to);
    fresh = b.size === a.size && b.mtimeMs >= a.mtimeMs;
  } catch { /* not copied yet */ }
  if (fresh) continue;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
}
console.log(`sync-data: ${copied} of ${FILES.length} files updated in public/data/`);
