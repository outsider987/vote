import { mkdtemp, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { COUNTIES, type LiveResults } from "@vote/shared";
import { describe, expect, it, vi } from "vitest";
import { loadConfig, stageOf, type PollerConfig } from "../src/config.js";
import { replayFile, readJson } from "../src/data.js";
import { PoliteFetcher } from "../src/fetcher.js";
import { decodeName, importCandidates, parseCouncilPayload, parseMayorPayload, rocDate } from "../src/import-candidates.js";
import { startMock } from "../src/mock-cec.js";
import { parseCandidateVotes, parseTurnoutPage } from "../src/parser.js";
import { districtIds, pollCycle, townIds } from "../src/poll.js";
import { pageUrl } from "../src/url.js";

const prefixes = { TC: "TC", T1: "T1", T2: "T2", T3: "T3", SC: "SC", ST: "ST" };
const config = (root: string, countBaseUrl = "http://127.0.0.1:0/"): PollerConfig => ({
  year: 2022, election: "2022-local", countBaseUrl, outDir: join(root, "out"), cacheDir: join(root, ".cache"),
  contact: "test@example.org", prefixes, districts: "2022", towns: "2022", intervalMs: 1,
  townEvery: 5, concurrency: 4, timeoutMs: 5000, retries: 0, minRequestIntervalMs: 1, circuitBreakMs: 100,
});

describe("CEC parsing and identifiers", () => {
  const fixture = (name: string) => readFile(new URL(`./fixtures/2022/${name}.html`, import.meta.url), "utf8");

  it("parses the raw 2022 Pingtung county page", async () => {
    const html = await fixture("TC-10013000000000000");
    const parsed = parseCandidateVotes(html, 2022);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({
      stations: { reported: 711, total: 711 }, updatedAt: "2022-11-26T23:53:49+08:00", seats: 1,
      candidates: [
        { no: 1, name: "詹智鈞", party: "時代力量", votes: 19156, pct: 4.32, mark: null },
        { no: 2, name: "蘇清泉", party: "中國國民黨", votes: 206460, pct: 46.59, mark: null },
        { no: 3, name: "周春米", party: "民主進步黨", votes: 217537, pct: 49.09, mark: "elected" },
      ],
    });
    const bad = parseCandidateVotes(html.replace("206,460", "206,x60"), 2022);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("NUMBER");
  });

  it("parses the raw 2022 Pingtung town page", async () => {
    const parsed = parseCandidateVotes(await fixture("TC-10013000100000000"), 2022);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.stations).toEqual({ reported: 137, total: 137 });
    expect(parsed.value.seats).toBe(1);
    expect(parsed.value.candidates.map(x => [x.no, x.votes, x.pct, x.mark])).toEqual([
      [1, 5829, 6.14, null], [2, 43536, 45.84, null], [3, 45619, 48.03, "elected"],
    ]);
    expect(parsed.value.updatedAt).toBe("2022-11-26T23:53:49+08:00");
  });

  it("parses both raw Taipei T1 pages without reading footer legend rows as candidates", async () => {
    for (const [name, stations, first, last] of [
      ["T1-63000010000000000", 351, 23427, 18256],
      ["T1-63000011100000000", 182, 12884, 13448],
    ] as const) {
      const parsed = parseCandidateVotes(await fixture(name), 2022);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.value.stations).toEqual({ reported: stations, total: stations });
      expect(parsed.value.seats).toBe(12);
      expect(parsed.value.womenSeats).toBe(3);
      expect(parsed.value.candidates).toHaveLength(25);
      expect(parsed.value.candidates[0]).toEqual({ no: 1, name: "林延鳳", party: "民主進步黨", votes: first, pct: name.includes("111") ? 8.85 : 8.51, mark: "elected" });
      expect(parsed.value.candidates[24]).toEqual({ no: 25, name: "陳政忠", party: "無", votes: last, pct: name.includes("111") ? 9.23 : 6.63, mark: "elected" });
      expect(parsed.value.candidates.some(x => x.mark === "displaced" || x.womenQuota)).toBe(false);
      expect(parsed.value.updatedAt).toBe("2022-11-26T23:53:49+08:00");
    }
  });

  it("parses the raw Miaoli T1 page and its women's-seat header", async () => {
    const parsed = parseCandidateVotes(await fixture("T1-10005010000000000"), 2022);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.stations).toEqual({ reported: 113, total: 113 });
    expect(parsed.value.seats).toBe(9);
    expect(parsed.value.womenSeats).toBe(2);
    expect(parsed.value.candidates).toHaveLength(16);
    expect(parsed.value.candidates[0]).toEqual({ no: 1, name: "禹耀東", party: "無", votes: 5140, pct: 7.63, mark: "elected" });
    expect(parsed.value.candidates[15]).toEqual({ no: 16, name: "楊明燁", party: "無", votes: 5826, pct: 8.65, mark: "elected" });
  });

  it("maps ● and - only from candidate cells, and reports unknown marks", async () => {
    const html = await fixture("T1-63000010000000000");
    for (const symbol of ["-", "－", "‐", "\u200B－\u200D", "\uFEFF‐\u200C"]) {
      const changed = html.replace('<td class="electmark">◎</td>', '<td class="electmark">●</td>').replace('<td class="electmark">&nbsp;</td>', `<td class="electmark">${symbol}</td>`);
      const parsed = parseCandidateVotes(changed, 2022);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.value.candidates[0]).toMatchObject({ mark: "elected", womenQuota: true });
      expect(parsed.value.candidates[2]).toMatchObject({ mark: "displaced" });
      expect(parsed.value.candidates).toHaveLength(25);
    }
    const empty = parseCandidateVotes(html.replace('<td class="electmark">&nbsp;</td>', '<td class="electmark">&nbsp;\u200B\uFEFF</td>'), 2022);
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.value.candidates[2].mark).toBeNull();
    for (const symbol of ["★", "!"]) {
      const unknown = parseCandidateVotes(html.replace('<td class="electmark">◎</td>', `<td class="electmark">${symbol}</td>`), 2022);
      expect(unknown.ok).toBe(false);
      if (!unknown.ok) expect(unknown.error.message).toContain(symbol);
    }
  });

  it("parses the raw Taipei SC county and town turnout rows", async () => {
    const parsed = parseTurnoutPage(await fixture("SC-63000000000000000"), 2022);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.rows).toHaveLength(13);
    expect(parsed.value.rows[0]).toEqual({ label: "總計", turnout: { electors: 2026769, cast: 1372179, valid: 1360951, invalid: 11228 } });
    expect(parsed.value.rows[1]).toEqual({ label: "松山區", turnout: { electors: 151159, cast: 104722, valid: 103919, invalid: 803 } });
    expect(parsed.value.rows[12]).toEqual({ label: "北投區", turnout: { electors: 197426, cast: 133194, valid: 132060, invalid: 1134 } });
    expect(parsed.value.updatedAt).toBe("2022-11-26T23:53:49+08:00");
  });

  it("parses the raw Pingtung ST rows and indigenous district labels", async () => {
    const parsed = parseTurnoutPage(await fixture("ST-10013000000000000"), 2022);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.rows).toHaveLength(16);
    expect(parsed.value.rows[0]).toEqual({ label: "第1選舉區", turnout: { electors: 158453, cast: 95701, valid: 93976, invalid: 1725 } });
    expect(parsed.value.rows[7]).toEqual({ label: "第8選舉區(平地原住民)", turnout: { electors: 3777, cast: 2527, valid: 2455, invalid: 72 } });
    expect(parsed.value.rows[8]).toEqual({ label: "第9選舉區(山地原住民)", turnout: { electors: 6319, cast: 5287, valid: 5200, invalid: 87 } });
    expect(parsed.value.rows[15]).toEqual({ label: "第16選舉區(山地原住民)", turnout: { electors: 2796, cast: 2491, valid: 2451, invalid: 40 } });
    expect(parsed.value.updatedAt).toBe("2022-11-26T23:53:49+08:00");
  });

  it("rejects a real referendum fragment as a candidate race", async () => {
    const html = await readFile(new URL("./fixtures/current/F1-00000000000000000.html", import.meta.url), "utf8");
    const result = parseCandidateVotes(html, 2025);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MARKUP");
  });

  it("reads the archived 2022 tree as gzip JSON", async () => {
    const raw = await readFile(new URL("./fixtures/2022/tree-compiled.min.json.gz", import.meta.url));
    const tree = JSON.parse(gunzipSync(raw).toString("utf8"));
    expect(Object.keys(tree).length).toBeGreaterThan(9000);
  });

  it("builds CEC county, town and council URLs", () => {
    const c = config(".", "https://www.cec.gov.tw/zh-TW/");
    expect(pageUrl(c, "TC", "10013")).toBe("https://www.cec.gov.tw/zh-TW/TC/10013000000000000.html");
    expect(pageUrl(c, "TC", "10013", "00", "010")).toBe("https://www.cec.gov.tw/zh-TW/TC/10013000100000000.html");
    expect(pageUrl(c, "T1", "63000", "01")).toBe("https://www.cec.gov.tw/zh-TW/T1/63000010000000000.html");
    expect(() => pageUrl(c, "TC", "1001X")).toThrow();
  });

  it("converts ROC dates and CJK name markers", () => {
    expect(rocDate("0740111")).toBe("1985-01-11");
    expect(() => rocDate("0740230")).toThrow();
    expect(decodeName("甲@FA0C@乙")).toBe(`甲${String.fromCodePoint(0xFA0C).normalize("NFC")}乙`);
  });

  it("detects prior, count and final", () => {
    const tally = (reported: number) => ({ stations: { reported, total: 2 }, updatedAt: null, seats: 1, candidates: [] });
    const data = { mayors: { "10013": tally(0) }, councils: { "10013-T1-01": tally(0) } };
    expect(stageOf(data, ["10013-T1-01"], ["10013"])).toBe("prior");
    data.mayors["10013"] = tally(1);
    expect(stageOf(data, ["10013-T1-01"], ["10013"])).toBe("count");
    data.mayors["10013"] = tally(2); data.councils["10013-T1-01"] = tally(2);
    expect(stageOf(data, ["10013-T1-01"], ["10013"])).toBe("final");
  });

  it("defaults URL spacing to half the polling interval", async () => {
    const c = await loadConfig(new URL("../poller.mock.json", import.meta.url).pathname);
    expect(c.intervalMs).toBe(2000);
    expect(c.minRequestIntervalMs).toBe(1000);
  });
});

describe("polite fetching under failure", () => {
  it("keeps healthy URLs moving while flaky URLs retry, then serves the immediate next cycle from cache", async () => {
    const calls = new Map<string, number>();
    const times = new Map<string, number[]>();
    let inFlight = 0, maxInFlight = 0;
    const server = createServer((request, response) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      response.on("finish", () => { inFlight--; });
      const path = request.url ?? "/";
      const count = (calls.get(path) ?? 0) + 1;
      calls.set(path, count);
      times.set(path, [...times.get(path) ?? [], Date.now()]);
      if (path.startsWith("/flaky-") && count <= (path === "/flaky-0" ? 1 : 2)) {
        response.writeHead(503, path === "/flaky-0" ? { "Retry-After": "60" } : {}).end();
      } else setTimeout(() => response.writeHead(200, { ETag: `"${path}"` }).end(path), 10);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const root = await mkdtemp(join(process.cwd(), "test", "run-"));
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const c = { ...config(root, base), retries: 2, minRequestIntervalMs: 15_000 };
      const fetcher = new PoliteFetcher(c);
      const paths = [...Array.from({ length: 4 }, (_, i) => `/flaky-${i}`), ...Array.from({ length: 36 }, (_, i) => `/healthy-${i}`)];
      const finished: string[] = [];
      const cycle = () => Promise.all(paths.map(async path => {
        expect(await fetcher.text(base + path)).toBe(path);
        finished.push(path);
      }));
      const started = Date.now();
      await cycle();
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(maxInFlight).toBeLessThanOrEqual(4);
      expect(finished.indexOf("/healthy-35")).toBeLessThan(finished.indexOf("/flaky-0"));
      expect(fetcher.stats.requests).toBe(47);
      expect(times.get("/flaky-0")![1]! - times.get("/flaky-0")![0]!).toBeGreaterThanOrEqual(2_900);
      const before = fetcher.stats.requests;
      await cycle();
      expect(fetcher.stats.requests).toBe(before);
      expect([...calls.values()].reduce((sum, count) => sum + count, 0)).toBe(before);
    } finally {
      server.close();
      await once(server, "close");
      await rm(root, { recursive: true, force: true });
    }
  }, 10_000);

  it("ends a cycle quickly and writes previous tallies when the host circuit opens", async () => {
    const server = createServer((_request, response) => { response.writeHead(503).end(); });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const root = await mkdtemp(join(process.cwd(), "test", "run-"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
      const c = { ...config(root, base), retries: 2, minRequestIntervalMs: 15_000, circuitBreakMs: 5_000 };
      const tally = { stations: { reported: 1, total: 2 }, updatedAt: null, seats: 1, candidates: [] };
      const previous: LiveResults = {
        schema: 1, election: c.election, generatedAt: new Date().toISOString(), stage: "count", source: base,
        mayors: { "10013": tally }, mayorTowns: {}, councils: { "10013-T1-01": tally },
      };
      const started = Date.now();
      const { results, errors } = await pollCycle(c, new PoliteFetcher(c), 2, ["10013-T1-01"], [], previous);
      expect(Date.now() - started).toBeLessThan(3_000);
      expect(errors).toBeGreaterThan(0);
      expect(results.mayors["10013"]).toEqual(tally);
      expect(results.councils["10013-T1-01"]).toEqual(tally);
      const written = await readJson<LiveResults>(join(c.outDir, "results.json"));
      expect(written.mayors["10013"]).toEqual(tally);
      expect(written.councils["10013-T1-01"]).toEqual(tally);
    } finally {
      log.mockRestore();
      server.close();
      await once(server, "close");
      await rm(root, { recursive: true, force: true });
    }
  }, 10_000);
});

describe("candidate portal", () => {
  it("imports the raw archived Taipei C1 sample", async () => {
    const raw = JSON.parse(await readFile(new URL("./fixtures/2022/cand-C1-63000.json", import.meta.url), "utf8"));
    const candidates = parseMayorPayload(raw, "C1");
    expect(candidates).toHaveLength(12);
    expect(candidates[0]).toEqual({ no: 1, name: "張家豪", party: "台灣動物保護黨", gender: "M", birth: "1985-01-11", birthplace: "屏東縣" });
    expect(candidates[11]?.name).toBe("陳時中");
  });

  it("maps the observed 2022 T council district structure", () => {
    const payload = { T: [{ areaCode: "07", voterType: "03", numberElected: 1, cands: [{ candNo: 1, name: "甲", party: "無", gender: "女" }] }] };
    expect(parseCouncilPayload(payload, "T", "63000")).toEqual({
      "63000-T2-07": { county: "63000", type: "平地原住民", no: "07", seats: 1, candidates: [{ no: 1, name: "甲", party: "無", gender: "F" }] },
    });
  });

  it("exits cleanly when candidate lists have not been published", async () => {
    const root = await mkdtemp(join(process.cwd(), "test", "run-"));
    const mock = await startMock({ port: 0 });
    try {
      const c = { ...config(root, mock.url), candidateBaseUrl: mock.url };
      expect(await importCandidates(c)).toBe("not-published");
      await expect(readFile(join(c.outDir, "candidates.json"))).rejects.toThrow();
    } finally { await mock.close(); await rm(root, { recursive: true, force: true }); }
  });
});

it.each(["2022", "2025"] as const)("replays all final votes, turnout and quota marks through the %s layout", async layout => {
  const root = await mkdtemp(join(process.cwd(), "test", "run-"));
  const mock = await startMock({ port: 0, durationMs: 1, layout });
  try {
    const c = config(root, mock.url);
    const fetcher = new PoliteFetcher(c);
    await new Promise(resolve => setTimeout(resolve, 10));
    const districts = await districtIds(c), towns = await townIds(c);
    const { results, errors } = await pollCycle(c, fetcher, 1, districts, towns);
    expect(errors).toBe(0);
    expect(results.stage).toBe("final");
    expect(Object.keys(results.mayors)).toHaveLength(22);
    expect(Object.keys(results.councils)).toHaveLength(215);
    expect(Object.keys(results.mayorTowns ?? {})).toHaveLength(368);
    expect(fetcher.stats.requests).toBe(649);
    const mayorData = await readJson<{ counties: { code: string; electors: number; votesCast: number; valid: number; invalid: number; candidates: { no: number; votes: number; pct: number }[] }[] }>(replayFile("mayor-2022.json"));
    const councilData = await readJson<{ counties: { districts: { id: string; seats: number; electors: number; votesCast: number; valid: number; invalid: number; candidates: { no: number; votes: number; pct: number; elected: boolean; womenQuota: boolean }[] }[] }[] }>(replayFile("council-2022.json"));
    const townData = await readJson<Record<string, { code: string; electors: number; votesCast: number; valid: number; votes: Record<string, number> }[]>>(replayFile("mayor-2022-towns.json"));
    for (const county of mayorData.counties) {
      expect(results.mayors[county.code]!.candidates.map(x => [x.no, x.votes, x.pct])).toEqual(county.candidates.map(x => [x.no, x.votes, x.pct]));
      expect(results.mayors[county.code]!.turnout).toEqual({ electors: county.electors, cast: county.votesCast, valid: county.valid, invalid: county.invalid });
    }
    for (const district of councilData.counties.flatMap(x => x.districts)) {
      const tally = results.councils[district.id]!;
      expect(tally.seats).toBe(district.seats);
      expect(tally.candidates.map(x => [x.no, x.votes, x.pct])).toEqual(district.candidates.map(x => [x.no, x.votes, x.pct]));
      expect(tally.turnout).toEqual({ electors: district.electors, cast: district.votesCast, valid: district.valid, invalid: district.invalid });
      expect(tally.candidates.filter(x => x.womenQuota).map(x => x.no)).toEqual(district.candidates.filter(x => x.womenQuota).map(x => x.no));
      const displaced = district.candidates.some(x => x.womenQuota) ? district.candidates.toSorted((a, b) => b.votes - a.votes || a.no - b.no).slice(0, district.seats).filter(x => !x.elected).map(x => x.no).sort((a, b) => a - b) : [];
      expect(tally.candidates.filter(x => x.mark === "displaced").map(x => x.no).sort((a, b) => a - b)).toEqual(displaced);
    }
    for (const town of Object.values(townData).flat()) {
      expect(Object.fromEntries(results.mayorTowns![town.code]!.candidates.map(x => [x.no, x.votes]))).toEqual(Object.fromEntries(Object.entries(town.votes).map(([no, votes]) => [Number(no), votes])));
      expect(results.mayorTowns![town.code]!.turnout).toEqual({ electors: town.electors, cast: town.votesCast, valid: town.valid, invalid: town.votesCast - town.valid });
    }
    const written = await readJson<typeof results>(join(c.outDir, "results.json"));
    expect(written.stage).toBe("final");
    const url = pageUrl(c, "TC", COUNTIES[0]!.code);
    await fetcher.text(url);
    expect(fetcher.stats.notModified).toBe(1);
    const restarted = new PoliteFetcher(c);
    await restarted.text(url);
    expect(restarted.stats.notModified).toBe(1);
  } finally { await mock.close(); await rm(root, { recursive: true, force: true }); }
}, 30_000);

it("advances mock stations, votes and update time before reaching the exact final", async () => {
  const mock = await startMock({ port: 0, durationMs: 1200 });
  try {
    const url = pageUrl(config(".", mock.url), "TC", "10013");
    const get = async () => {
      const parsed = parseCandidateVotes(await (await fetch(url)).text(), 2022);
      if (!parsed.ok) throw new Error(parsed.error.message);
      return parsed.value;
    };
    const start = await get();
    await new Promise(resolve => setTimeout(resolve, 650));
    const middle = await get();
    await new Promise(resolve => setTimeout(resolve, 650));
    const end = await get();
    expect(start.stations.reported).toBeLessThan(middle.stations.reported);
    expect(middle.stations.reported).toBeLessThan(end.stations.reported);
    expect(start.candidates[2]!.votes).toBeLessThan(middle.candidates[2]!.votes);
    expect(middle.candidates[2]!.votes).toBeLessThan(end.candidates[2]!.votes);
    expect(end.candidates[2]!.votes).toBe(217537);
    expect(start.updatedAt).not.toBe(end.updatedAt);
    expect(end.candidates[2]!.mark).toBe("elected");
  } finally { await mock.close(); }
}, 10_000);
