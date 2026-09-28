#!/usr/bin/env node
// Election night: publish the poller's output to Cloudflare.
//
// Watches apps/poller/out/. Whenever results.json or candidates.json changes, this deploys them as the
// static assets of the vote-live Worker (deploy/live/wrangler.jsonc). A deploy takes a few seconds, and
// the site fetches both files from that Worker (VITE_LIVE_URL). Before election night, publishing
// candidates.json alone lets the 2026 countdown page show the rosters.
//
//   node scripts/publish-live.mjs [--out apps/poller/out] [--once]
//
// Needs Cloudflare credentials: `npx wrangler login` on this machine, or CLOUDFLARE_API_TOKEN and
// CLOUDFLARE_ACCOUNT_ID in the environment.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flags = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, i, all) => {
  if (arg.startsWith("--")) acc.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const outDir = resolve(root, String(flags.out ?? "apps/poller/out"));
const liveDir = join(root, "deploy/live");
const stage = join(liveDir, "public");
const wrangler = join(root, "node_modules/.bin/wrangler");
const CHECK_MS = 3_000;          // how often to look for a new results.json
const RETRY_MS = 15_000;         // wait after a failed deploy
const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

let published = "";
let lastStat = "";

// Never publish a half-written or foreign file: both files share schema 1 with mayors and councils.
function check(name, body) {
  const doc = JSON.parse(body.toString());
  if (doc.schema !== 1 || !doc.mayors || !doc.councils) throw new Error(`${name} does not match the shared contract`);
  return doc;
}

async function publishIfChanged() {
  // before election night there is only candidates.json, so the 2026 countdown page can show the rosters
  const files = ["results.json", "candidates.json"].filter((f) => existsSync(join(outDir, f)));
  if (!files.length) return false;
  const stamp = files.map((f) => { const st = statSync(join(outDir, f)); return `${f}:${st.mtimeMs}:${st.size}`; }).join("|");
  if (stamp === lastStat) return false;
  const bodies = files.map((f) => readFileSync(join(outDir, f)));
  const docs = files.map((f, i) => check(f, bodies[i]));
  const snap = files[0] === "results.json" ? docs[0] : null;
  const hash = createHash("sha256").update(Buffer.concat(bodies)).digest("hex");
  if (hash === published) { lastStat = stamp; return false; }

  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  files.forEach((f, i) => writeFileSync(join(stage, f), bodies[i]));
  copyFileSync(join(liveDir, "_headers"), join(stage, "_headers"));
  const started = Date.now();
  await run(wrangler, ["deploy", "--config", join(liveDir, "wrangler.jsonc")], { cwd: root, timeout: 120_000 });
  published = hash;
  lastStat = stamp;
  const what = snap ? `${snap.election}, ${snap.stage}, generated ${snap.generatedAt}` : "candidates only";
  log(`published ${files.join(" + ")} (${what}) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return true;
}

async function loop() {
  let wait = CHECK_MS;
  try {
    await publishIfChanged();
    if (flags.once) return;
  } catch (err) {
    log(`publish failed, retrying: ${(err instanceof Error ? err.message : String(err)).split("\n")[0]}`);
    if (flags.once) { process.exitCode = 1; return; }
    wait = RETRY_MS;
  }
  setTimeout(loop, wait);
}

log(`watching ${outDir} (results.json, candidates.json); publishing to the vote-live Worker`);
loop();
