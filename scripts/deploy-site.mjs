#!/usr/bin/env node
// Build the site and deploy the `vote` Worker to this project's Cloudflare account (deploy/.env).
// GitHub Actions does the same on every push to main once the repository secrets are set.
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareEnv } from "./cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = cloudflareEnv(root);
if (!env.VITE_LIVE_URL) throw new Error("Set VITE_LIVE_URL in deploy/.env (see deploy/.env.example).");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env, stdio: "inherit" });
run("npm", ["run", "build"]);
run(join(root, "node_modules/.bin/wrangler"), ["deploy", "--config", join(root, "deploy/site/wrangler.jsonc")]);
