#!/usr/bin/env node
// Election night: publish the poller's output to Cloudflare.
//
// Watches apps/poller/out/results.json. Whenever it changes, this deploys it (plus candidates.json, if
// present) as the static assets of the vote-live Worker (deploy/live/wrangler.jsonc). A deploy takes a
// few seconds, and the site fetches results.json from that Worker (VITE_LIVE_URL).
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

async function publishIfChanged() {
  const results = join(outDir, "results.json");
  if (!existsSync(results)) return false;
  const st = statSync(results);
  const stamp = `${st.mtimeMs}:${st.size}`;
  if (stamp === lastStat) return false;
  const files = ["results.json", "candidates.json"].filter((f) => existsSync(join(outDir, f)));
  const bodies = files.map((f) => readFileSync(join(outDir, f)));
  const snap = JSON.parse(bodies[0].toString());   // never publish a half-written or foreign file
  if (snap.schema !== 1 || !snap.mayors || !snap.councils) throw new Error("results.json does not match the LiveResults contract");
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
  log(`published ${files.join(" + ")} (${snap.election}, ${snap.stage}, generated ${snap.generatedAt}) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
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

log(`watching ${join(outDir, "results.json")}; publishing to the vote-live Worker`);
loop();
