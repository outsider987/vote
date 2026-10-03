// Cloudflare settings for deploys, from deploy/.env or the environment.
// CLOUDFLARE_ACCOUNT_ID is required and pins every deploy to this project's account. CLOUDFLARE_API_TOKEN is
// optional: without it wrangler uses this machine's `wrangler login`, but only for the pinned account.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function cloudflareEnv(root) {
  const env = { ...process.env };
  const file = join(root, "deploy/.env");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && m[2] && !env[m[1]]) env[m[1]] = m[2];   // real environment variables win
    }
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is not set. Fill in deploy/.env (see deploy/.env.example).");
  }
  return env;
}
