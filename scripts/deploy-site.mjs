#!/usr/bin/env node
// Build the site and deploy it to the Cloudflare Pages project `kaipiao` (account from deploy/.env).
// GitHub Actions does the same on every push to main once the repository secrets are set.
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareEnv } from "./cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = cloudflareEnv(root);
if (!env.VITE_LIVE_URL) throw new Error("Set VITE_LIVE_URL in deploy/.env (see deploy/.env.example).");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env, stdio: "inherit" });
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim();
run("npm", ["run", "build"]);
run(join(root, "node_modules/.bin/wrangler"), [
  "pages", "deploy", join(root, "apps/web/dist"),
  "--project-name", env.PAGES_PROJECT || "kaipiao", "--branch", "main", "--commit-hash", commit,
]);
