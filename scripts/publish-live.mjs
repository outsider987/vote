#!/usr/bin/env node
// Election night: publish the poller's output to GitHub Pages.
//
// Every --interval seconds, when apps/poller/out/results.json has changed, this force-pushes it (plus
// candidates.json, if present) as a single commit to the live-data branch, then dispatches the Pages
// workflow on main, which deploys the site with those files at live/. A deploy takes about a minute.
//
//   node scripts/publish-live.mjs [--out apps/poller/out] [--interval 60] [--once]
//
// Needs push access to the repository's origin, and a token that can dispatch workflows:
// GITHUB_TOKEN in the environment, or a logged-in GitHub CLI (`gh auth login`).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flags = Object.fromEntries(process.argv.slice(2).reduce((acc, arg, i, all) => {
  if (arg.startsWith("--")) acc.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const outDir = resolve(root, String(flags.out ?? "apps/poller/out"));
const intervalMs = Math.max(30, Number(flags.interval ?? 60)) * 1000;
const branch = "live-data";
const workflow = "pages.yml";
const pubDir = join(root, ".live-publish");

const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const git = (...args) => run("git", args, pubDir);
const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

const origin = run("git", ["remote", "get-url", "origin"]);
const slug = origin.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
if (!slug) throw new Error(`origin is not a GitHub repository: ${origin}`);

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try { return run("gh", ["auth", "token"]); } catch { throw new Error("Set GITHUB_TOKEN or run `gh auth login` so the Pages workflow can be dispatched."); }
}

// A separate one-commit repository: the branch never accumulates history, however long the night runs.
function prepare() {
  if (existsSync(join(pubDir, ".git"))) return;
  mkdirSync(pubDir, { recursive: true });
  git("init", "-q");
  git("remote", "add", "origin", origin);
  for (const key of ["user.name", "user.email"]) {
    try { git("config", key, run("git", ["config", key])); } catch { /* falls back to the global identity */ }
  }
}

async function dispatch() {
  const res = await fetch(`https://api.github.com/repos/${slug}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (res.status !== 204) throw new Error(`workflow dispatch failed: HTTP ${res.status} ${await res.text()}`);
}

let published = "";

async function publishOnce() {
  const results = join(outDir, "results.json");
  if (!existsSync(results)) { log(`waiting for ${results}`); return; }
  const files = ["results.json", "candidates.json"].filter((f) => existsSync(join(outDir, f)));
  const bodies = files.map((f) => readFileSync(join(outDir, f)));
  const snap = JSON.parse(bodies[0].toString());   // never publish a half-written or foreign file
  if (snap.schema !== 1 || !snap.mayors || !snap.councils) throw new Error("results.json does not match the LiveResults contract");
  const hash = createHash("sha256").update(Buffer.concat(bodies)).digest("hex");
  if (hash === published) return;

  prepare();
  files.forEach((f, i) => writeFileSync(join(pubDir, f), bodies[i]));
  writeFileSync(join(pubDir, "README.md"), "Live results published by scripts/publish-live.mjs on main. This branch is force-pushed; do not commit here.\n");
  git("add", "-A");
  let amend = true;
  try { git("rev-parse", "--verify", "HEAD"); } catch { amend = false; }
  git("commit", "-q", ...(amend ? ["--amend"] : []), "-m", `live results ${snap.generatedAt} (${snap.stage})`);
  git("push", "-q", "--force", "origin", `HEAD:refs/heads/${branch}`);
  await dispatch();
  published = hash;
  log(`published ${files.join(" + ")} (${snap.stage}, generated ${snap.generatedAt}); Pages deploy dispatched`);
}

async function loop() {
  try { await publishOnce(); } catch (err) { log(`publish failed, will retry: ${err instanceof Error ? err.message : err}`); }
  if (!flags.once) setTimeout(loop, intervalMs);
}

log(`publishing ${outDir} to ${slug}@${branch} every ${intervalMs / 1000}s`);
loop();
