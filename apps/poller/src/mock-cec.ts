import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { COUNTIES } from "@vote/shared";
import { flags, loadConfig, type PollerConfig } from "./config.js";
import { readJson, replayFile } from "./data.js";

interface Stats { electors: number; votesCast: number; valid: number; invalid?: number; turnout?: number }
interface FinalCandidate { no: number; name: string; party: string; votes: number; pct: number; elected: boolean; womenQuota?: boolean; gender?: string }
interface MayorCounty extends Stats { code: string; name: string; candidates: FinalCandidate[] }
interface CouncilDistrict extends Stats { id: string; seats: number; candidates: FinalCandidate[] }
interface CouncilCounty { code: string; districts: CouncilDistrict[] }
interface MayorTown extends Stats { code: string; name: string; votes: Record<string, number> }
type Layout = "2022" | "2025";
type MockPrefixes = PollerConfig["prefixes"];

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);
const number = (n: number) => n.toLocaleString("en-US");
const defaults: MockPrefixes = { TC: "TC", T1: "T1", T2: "T2", T3: "T3", SC: "SC", ST: "ST" };

function section(layout: Layout, name: "header" | "content" | "footer", inner: string): string {
  return `<div ${layout === "2022" ? `class="table-${name}"` : `id="vote-table-${name}"`}>${inner}</div>`;
}

function header(layout: Layout, title: string, seats?: number, womenSeats?: number, reported?: number, total?: number): string {
  const subtitle = seats === undefined ? "" : `<div class="subtitle"><div class="bullet "><img src="../_assets/img/nav.gif" />應選人數: ${seats}</div>${womenSeats === undefined ? "" : `<div class="bullet "><img src="../_assets/img/nav.gif" />婦女應當選名額: ${womenSeats}</div>`}<div class="bullet emph-right"><img src="../_assets/img/nav.gif" />投開票所數 已送/應送: ${number(reported!)}/${number(total!)}</div></div>`;
  return section(layout, "header", `<table class="title"><tr><td><img src="../_assets/img/search.png" alt="search" title="search" /></td><td><b>${escape(title)}</b></td></tr></table>${subtitle}`);
}

function footer(layout: Layout, time: string, council: boolean, legend: boolean): string {
  const marks = council ? [["◎", "當選"], ["●", "婦女優先當選"], ["-", "排擠"], ["？", "同票待抽籤"], ["＜", "未達最低當選票數"]] : [["◎", "當選"], ["？", "同票待抽籤"], ["＜", "未達最低當選票數"]];
  const rows = legend ? `<table class="legend">${marks.map(([symbol, label], i) => `<tr><td>${i === 0 ? "<b>註記說明:</b>&nbsp;" : ""}</td><td class="electmark">${symbol}</td><td>${label}</td></tr>`).join("")}</table>` : "";
  return section(layout, "footer", `<div class="table-footer-left">${rows}</div><div class="table-footer-right"><img src="../_assets/img/clock2.png" alt="clock">&nbsp;資料更新時間:&nbsp;${time.replace(" ", "&nbsp;")}</div>`);
}

function candidatePage(layout: Layout, title: string, seats: number, womenSeats: number | undefined, reported: number, total: number, candidates: FinalCandidate[], council: boolean, time: string): string {
  const final = reported === total;
  const votes = candidates.map(candidate => Math.round(candidate.votes * reported / total));
  const sum = votes.reduce((a, b) => a + b, 0);
  const top = new Set(candidates.toSorted((a, b) => b.votes - a.votes || a.no - b.no).slice(0, seats).map(candidate => candidate.no));
  const quota = council && candidates.some(candidate => candidate.womenQuota && candidate.elected);
  const rows = candidates.map((candidate, i) => {
    const mark = !final ? "&nbsp;" : candidate.elected ? (candidate.womenQuota ? "●" : "◎") : quota && top.has(candidate.no) ? "-" : "&nbsp;";
    const pct = final ? candidate.pct : sum ? Math.round(votes[i]! / sum * 10000) / 100 : 0;
    const party = candidate.party === "無黨籍及未經政黨推薦" ? "無" : candidate.party;
    return `<tr><td class="electmark">${mark}</td><td>${candidate.no}</td><td>${escape(candidate.name)}</td><td>${candidate.gender === "F" ? "女" : "男"}</td><td class="numeric">${number(votes[i]!)}</td><td class="numeric">${pct.toFixed(2)}%</td><td>${escape(party)}</td></tr>`;
  }).join("\n");
  const labels = ["註記", "號次", "姓名", "性別", "得票數", "得票率%", "推薦之政黨"];
  const table = `<table class="tablesaw" data-tablesaw-mode="columntoggle" data-tablesaw-sortable><thead><tr>${labels.map(label => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
  return `${header(layout, title, seats, womenSeats, reported, total)}\n${section(layout, "content", table)}\n${footer(layout, time, council, true)}`;
}

function turnoutPage(layout: Layout, title: string, label: "行政區" | "選舉區", rows: { name: string; stats: Stats }[], progress: number, time: string): string {
  const labels = [label, "選舉人數", "投票數", "有效票數", "無效票數", "投票率%"];
  const body = rows.map(row => {
    const electors = Math.round(row.stats.electors * progress);
    const valid = Math.round(row.stats.valid * progress);
    const invalid = Math.round((row.stats.invalid ?? row.stats.votesCast - row.stats.valid) * progress);
    const cast = valid + invalid;
    const pct = progress === 1 && row.stats.turnout !== undefined ? row.stats.turnout : electors ? Math.round(cast / electors * 10000) / 100 : 0;
    return `<tr><td>${escape(row.name)}</td><td class="numeric">${number(electors)}</td><td class="numeric">${number(cast)}</td><td class="numeric">${number(valid)}</td><td class="numeric">${number(invalid)}</td><td class="numeric">${pct.toFixed(2)}%</td></tr>`;
  }).join("\n");
  const table = `<table class="tablesaw" data-tablesaw-mode="columntoggle"><thead><tr>${labels.map(text => `<th scope="col">${text}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  return `${header(layout, title)}\n${section(layout, "content", table)}\n${footer(layout, time, false, false)}`;
}

export async function startMock(options: { port?: number; host?: string; durationMs?: number; prefixes?: MockPrefixes; layout?: Layout } = {}): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const mayorData = await readJson<{ counties: MayorCounty[] }>(replayFile("mayor-2022.json"));
  const councilData = await readJson<{ counties: CouncilCounty[] }>(replayFile("council-2022.json"));
  const townsData = await readJson<Record<string, MayorTown[]>>(replayFile("mayor-2022-towns.json"));
  const mayors = new Map(mayorData.counties.map(x => [x.code, x]));
  const councils = new Map(councilData.counties.flatMap(x => x.districts).map(x => [x.id, x]));
  const towns = new Map(Object.values(townsData).flat().map(x => [x.code, x]));
  const countyNames = new Map(COUNTIES.map(x => [x.code, x.name]));
  const prefixes = options.prefixes ?? defaults;
  const layout = options.layout ?? "2022";
  const duration = options.durationMs ?? 600_000;
  if (!Number.isFinite(duration) || duration < 1 || (layout !== "2022" && layout !== "2025")) throw new Error("Invalid mock duration or layout");
  const started = Date.now();
  const server = createServer((request, response) => {
    const match = new URL(request.url ?? "/", "http://localhost").pathname.match(/^\/([^/]+)\/(\d{5})(\d{2})(\d{3})(\d{3})(\d{4})\.html$/);
    if (!match) { response.writeHead(404).end(); return; }
    const [, prefix, county, districtNo, townNo, village, station] = match;
    if (village !== "000" || station !== "0000") { response.writeHead(404).end(); return; }
    const kind = (Object.keys(prefixes) as (keyof MockPrefixes)[]).find(key => prefixes[key] === prefix);
    const mayor = mayors.get(county!);
    const countyName = countyNames.get(county!);
    const elapsed = Math.min(Date.now() - started, duration);
    const progress = elapsed / duration;
    const taiwan = new Date(started + Math.floor(elapsed / 1000) * 1000 + 8 * 60 * 60 * 1000).toISOString();
    const time = `${taiwan.slice(5, 7)}/${taiwan.slice(8, 10)} ${taiwan.slice(11, 19)}`;
    let body: string | undefined;
    if (kind === "SC" && districtNo === "00" && townNo === "000" && mayor) {
      const rows = [{ name: "總計", stats: mayor }, ...(townsData[county!] ?? []).map(town => ({ name: town.name, stats: town }))];
      body = turnoutPage(layout, `${countyName} ${countyName?.endsWith("市") ? "市長" : "縣長"}選舉 選舉概況`, "行政區", rows, progress, time);
    } else if (kind === "ST" && districtNo === "00" && townNo === "000") {
      const districts = councilData.counties.find(x => x.code === county)?.districts;
      if (districts) {
        const rows = districts.map(district => {
          const [, type, no] = district.id.split("-");
          return { name: `第${Number(no)}選舉區${type === "T2" ? "(平地原住民)" : type === "T3" ? "(山地原住民)" : ""}`, stats: district };
        });
        body = turnoutPage(layout, `${countyName} 議員選舉 選舉概況`, "選舉區", rows, progress, time);
      }
    } else if (kind === "TC" && districtNo === "00" && mayor) {
      const town = townNo === "000" ? undefined : towns.get(`${county}${townNo}`);
      if (townNo === "000" || town) {
        const candidates = town ? mayor.candidates.map(c => ({ ...c, votes: town.votes[String(c.no)] ?? 0, pct: town.valid ? Math.round(10000 * (town.votes[String(c.no)] ?? 0) / town.valid) / 100 : 0 })) : mayor.candidates;
        const electors = town?.electors ?? mayor.electors;
        const serial = `${county}${districtNo}${townNo}${village}${station}`;
        const known = { "10013000000000000": 711, "10013000100000000": 137 } as Record<string, number>;
        const total = known[serial] ?? Math.max(1, Math.round(electors / 1000));
        const reported = progress === 1 ? total : Math.floor(progress * total);
        const title = `${countyName} ${countyName?.endsWith("市") ? "市長" : "縣長"}選舉 ${town ? `候選人在 ${town.name}得票數` : "候選人得票數"}`;
        body = candidatePage(layout, title, 1, undefined, reported, total, candidates, false, time);
      }
    } else if ((kind === "T1" || kind === "T2" || kind === "T3") && townNo === "000") {
      const district = councils.get(`${county}-${kind}-${districtNo}`);
      if (district) {
        const serial = `${county}${districtNo}${townNo}${village}${station}`;
        const known = { "63000010000000000": 351, "10005010000000000": 113 } as Record<string, number>;
        const total = known[serial] ?? Math.max(1, Math.round(district.electors / 1000));
        const reported = progress === 1 ? total : Math.floor(progress * total);
        const womenSeats = kind === "T1" && district.seats >= 4 ? Math.floor(district.seats / 4) : undefined;
        body = candidatePage(layout, `${countyName} 議員選舉 第${Number(districtNo)}選舉區 候選人得票數`, district.seats, womenSeats, reported, total, district.candidates, true, time);
      }
    }
    if (!body) { response.writeHead(404).end(); return; }
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    const modified = new Date(started + Math.floor(elapsed / 1000) * 1000).toUTCString();
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("ETag", etag);
    response.setHeader("Last-Modified", modified);
    response.setHeader("Cache-Control", "no-cache");
    if (request.headers["if-none-match"] === etag || (!request.headers["if-none-match"] && request.headers["if-modified-since"] && Date.parse(request.headers["if-modified-since"]) >= Date.parse(modified))) response.writeHead(304).end();
    else response.writeHead(200).end(body);
  });
  server.listen(options.port ?? 8787, options.host ?? "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not read mock server address");
  return { server, url: `http://${options.host ?? "127.0.0.1"}:${address.port}/`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = flags();
  const config = options.config ? await loadConfig(String(options.config)) : undefined;
  const layout = options.layout ?? "2022";
  if (layout !== "2022" && layout !== "2025") throw new Error("--layout must be 2022 or 2025");
  const mock = await startMock({ port: options.port ? Number(options.port) : undefined, durationMs: options["duration-ms"] ? Number(options["duration-ms"]) : undefined, prefixes: config?.prefixes, layout });
  console.log(`mock-cec listening at ${mock.url} (layout=${layout}, durationMs=${options["duration-ms"] ?? 600000})`);
}
