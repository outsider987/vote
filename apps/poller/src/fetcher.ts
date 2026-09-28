import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { PollerConfig } from "./config.js";

interface Entry {
  etag?: string;
  lastModified?: string;
  body?: string;
  lastRequest?: number;
}

export class HttpError extends Error {
  constructor(public status: number, public url: string, public retryAfterMs = 0) { super(`HTTP ${status}: ${url}`); }
}

class CircuitOpenError extends Error {}

export class PoliteFetcher {
  private active = 0;
  private waiters: (() => void)[] = [];
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<Buffer>>();
  private hosts = new Map<string, { failures: number; openUntil: number }>();
  readonly stats = { requests: 0, notModified: 0 };

  constructor(private config: Pick<PollerConfig, "cacheDir" | "contact" | "concurrency" | "timeoutMs" | "retries" | "minRequestIntervalMs" | "circuitBreakMs">) {}

  private async slot<T>(run: () => Promise<T>): Promise<T> {
    if (this.active >= this.config.concurrency) await new Promise<void>(resolve => this.waiters.push(resolve));
    else this.active++;
    try { return await run(); }
    finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }

  async get(url: string): Promise<Buffer> {
    const existing = this.pending.get(url);
    if (existing) return existing;
    const job = this.request(url);
    this.pending.set(url, job);
    try { return await job; }
    finally { this.pending.delete(url); }
  }

  async text(url: string): Promise<string> {
    const body = await this.get(url);
    return (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString("utf8");
  }

  private async request(url: string): Promise<Buffer> {
    const cachePath = join(this.config.cacheDir, `${createHash("sha256").update(url).digest("hex")}.json`);
    let entry = this.entries.get(url);
    if (!entry) {
      try { entry = JSON.parse(await readFile(cachePath, "utf8")) as Entry; }
      catch { entry = {}; }
      this.entries.set(url, entry);
    }
    if (entry.body && Date.now() - (entry.lastRequest ?? 0) < this.config.minRequestIntervalMs) return Buffer.from(entry.body, "base64");
    const host = new URL(url).host;
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      let body: Buffer;
      try {
        body = await this.slot(async () => {
          const state = this.hosts.get(host);
          if (state && Date.now() < state.openUntil) throw new CircuitOpenError(`Circuit open for ${host} until ${new Date(state.openUntil).toISOString()}`);
          const headers: Record<string, string> = { "User-Agent": `TaiwanVotePoller/1.0 (+${this.config.contact})` };
          if (entry.body && entry.etag) headers["If-None-Match"] = entry.etag;
          if (entry.body && entry.lastModified) headers["If-Modified-Since"] = entry.lastModified;
          entry.lastRequest = Date.now();
          try {
            this.stats.requests++;
            const response = await fetch(url, { headers, signal: AbortSignal.timeout(this.config.timeoutMs) });
            if (response.status === 304 && entry.body) {
              this.stats.notModified++;
              this.hosts.delete(host);
              return Buffer.from(entry.body, "base64");
            }
            if (!response.ok) {
              const after = response.headers.get("retry-after");
              const seconds = after === null ? NaN : Number(after);
              const retryAfter = Number.isFinite(seconds) ? seconds * 1000 : after ? Date.parse(after) - Date.now() : 0;
              throw new HttpError(response.status, url, Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0);
            }
            const data = Buffer.from(await response.arrayBuffer());
            entry.body = data.toString("base64");
            entry.etag = response.headers.get("etag") ?? undefined;
            entry.lastModified = response.headers.get("last-modified") ?? undefined;
            this.hosts.delete(host);
            return data;
          } catch (error) {
            const status = error instanceof HttpError ? error.status : 0;
            if (!status || status === 403 || status === 429 || status >= 500) {
              const next = this.hosts.get(host) ?? { failures: 0, openUntil: 0 };
              next.failures++;
              if (next.failures >= Math.max(3, this.config.concurrency * 2)) next.openUntil = Date.now() + this.config.circuitBreakMs;
              this.hosts.set(host, next);
            }
            throw error;
          }
        });
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 0;
        if (error instanceof CircuitOpenError || status === 404 || (status && status !== 403 && status !== 429 && status < 500)
          || attempt === this.config.retries || Date.now() < (this.hosts.get(host)?.openUntil ?? 0)) throw error;
        const backoff = Math.min(3_000, 500 * 2 ** attempt) + Math.random() * 250;
        const retryAfter = error instanceof HttpError ? Math.min(3_000, error.retryAfterMs) : 0;
        await new Promise(resolve => setTimeout(resolve, Math.max(backoff, retryAfter)));
        continue;
      }
      await this.save(cachePath, entry);
      return body;
    }
    throw new Error(`Request failed: ${url}`);
  }

  private async save(path: string, entry: Entry): Promise<void> {
    await mkdir(this.config.cacheDir, { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(entry));
    await rename(temp, path);
  }
}
