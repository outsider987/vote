#!/usr/bin/env node
// Build the site and deploy it as the `vote` Worker (https://vote.<subdomain>.workers.dev), account from
// deploy/.env. With PAGES_PROJECT set, the same build also goes to that Pages project as a mirror.
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareEnv } from "./cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = cloudflareEnv(root);
if (!env.VITE_LIVE_URL) throw new Error("Set VITE_LIVE_URL in deploy/.env (see deploy/.env.example).");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env, stdio: "inherit" });
const wrangler = join(root, "node_modules/.bin/wrangler");
run("npm", ["run", "build"]);
run(wrangler, ["deploy", "--config", join(root, "deploy/site/wrangler.jsonc")]);
if (env.PAGES_PROJECT) {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim();
  run(wrangler, ["pages", "deploy", join(root, "apps/web/dist"), "--project-name", env.PAGES_PROJECT, "--branch", "main", "--commit-hash", commit]);
}
