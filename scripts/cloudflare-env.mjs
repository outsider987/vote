// Credentials for this project's own Cloudflare account, from deploy/.env or the environment.
// Deploys refuse to run without them, so wrangler can never fall back to this machine's default
// `wrangler login`, which may belong to a different account.
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
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are not set. Fill in deploy/.env (see deploy/.env.example).");
  }
  return env;
}
