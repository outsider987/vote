import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LiveResults } from "@vote/shared";

export type Prefix = "TC" | "T1" | "T2" | "T3" | "SC" | "ST";
export type CouncilPrefix = "T1" | "T2" | "T3";

export interface PollerConfig {
  year: number;
  election: string;
  countBaseUrl: string;
  candidateBaseUrl?: string;
  treeUrl?: string;
  outDir: string;
  cacheDir: string;
  contact: string;
  prefixes: Record<Prefix, string>;
  districts?: string[] | "2022";
  towns?: string[] | "2022";
  intervalMs: number;
  townEvery: number;
  concurrency: number;
  timeoutMs: number;
  retries: number;
  minRequestIntervalMs: number;
  circuitBreakMs: number;
}

const defaults = {
  candidateBaseUrl: "https://info.cec.gov.tw/vote2026/static/json/",
  outDir: fileURLToPath(new URL("../out", import.meta.url)),
  cacheDir: fileURLToPath(new URL("../.cache", import.meta.url)),
  prefixes: { TC: "TC", T1: "T1", T2: "T2", T3: "T3", SC: "SC", ST: "ST" },
  intervalMs: 60_000,
  townEvery: 5,
  concurrency: 4,
  timeoutMs: 15_000,
  retries: 3,
  circuitBreakMs: 60_000,
} satisfies Partial<PollerConfig>;

export function flags(argv = process.argv.slice(2)): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i]?.startsWith("--")) throw new Error(`Unexpected argument: ${argv[i]}`);
    const key = argv[i]!.slice(2);
    result[key] = argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[++i]! : true;
  }
  return result;
}

export async function loadConfig(path = "poller.config.json"): Promise<PollerConfig> {
  const absolute = resolve(path);
  const raw = JSON.parse(await readFile(absolute, "utf8")) as Partial<PollerConfig>;
  const config = { ...defaults, ...raw, prefixes: { ...defaults.prefixes, ...raw.prefixes } } as PollerConfig;
  config.minRequestIntervalMs = raw.minRequestIntervalMs ?? Math.max(1, Math.floor(config.intervalMs / 2));
  if (!raw.countBaseUrl) throw new Error("Config needs countBaseUrl");
  if (!raw.election) config.election = `${config.year}-local`;
  if (!raw.candidateBaseUrl && config.year === 2022) config.candidateBaseUrl = "https://2022.cec.gov.tw/data/json/";
  if (!Number.isInteger(config.year) || config.year < 2022 || !config.contact?.trim()) {
    throw new Error("Config needs a valid year and contact address");
  }
  if (!/^https?:\/\//.test(config.countBaseUrl) || (config.candidateBaseUrl && !/^https?:\/\//.test(config.candidateBaseUrl))) {
    throw new Error("CEC base URLs must use HTTP or HTTPS");
  }
  for (const key of ["intervalMs", "townEvery", "concurrency", "timeoutMs", "minRequestIntervalMs", "circuitBreakMs"] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`Invalid ${key}`);
  }
  if (!Number.isInteger(config.retries) || config.retries < 0) throw new Error("Invalid retries");
  for (const key of ["TC", "T1", "T2", "T3", "SC", "ST"] as const) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(config.prefixes[key])) throw new Error(`Invalid prefix ${key}`);
  }
  for (const key of ["outDir", "cacheDir"] as const) {
    if (!isAbsolute(config[key])) config[key] = resolve(dirname(absolute), config[key]);
  }
  return config;
}

export function stageOf(results: Pick<LiveResults, "mayors" | "councils">, districts: readonly string[], counties: readonly string[]): LiveResults["stage"] {
  const seen = [...Object.values(results.mayors), ...Object.values(results.councils)];
  if (!seen.some(race => race.stations.reported > 0)) return "prior";
  if (counties.every(code => results.mayors[code]?.stations.total > 0 && results.mayors[code]?.stations.reported === results.mayors[code]?.stations.total)
      && districts.every(id => results.councils[id]?.stations.total > 0 && results.councils[id]?.stations.reported === results.councils[id]?.stations.total)) return "final";
  return "count";
}
