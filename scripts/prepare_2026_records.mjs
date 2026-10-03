// Build data/records-2026.json: public court records of 2026 registered candidates, from
// 台灣前進「民間版選舉公報」(CC BY 4.0). Only criminal cases are kept — guilty verdicts and pending
// indictments. Family records, administrative fines and civil election-invalidity suits are left out.
//
//   node scripts/prepare_2026_records.mjs
//
// Every person must match exactly one entry in data/registered-2026.json, or the script fails.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://council2026.taiwangogo.tw/";
const OUTPUT = resolve(ROOT, "data/records-2026.json");

const get = async (url, as) => {
  const res = await fetch(url, { headers: { "user-agent": "vote-site data import (github.com/outsider987/vote)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return as === "json" ? res.json() : res.text();
};

// Keep in sync with recordKey() in apps/web/src/model/records.ts.
const nameKey = (name) => name.replace(/[\sA-Za-z．·・.]/g, "");
const countyName = (name) => name.replace(/^台/, "臺");
const districtNo = (name) => Number(name.match(/第(\d+)選/)?.[1] ?? 0);
const LEVEL = { 議員: "council", 縣市長: "mayor" };
const TYPE = { 有罪: "guilty", 起訴中: "indicted" };

const page = await get(SITE);
const asOf = page.match(/"dataDate":\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
if (!asOf) throw new Error("dataDate not found on the source page");
const people = await get(new URL("export/people.json", SITE), "json");
const registered = JSON.parse(readFileSync(resolve(ROOT, "data/registered-2026.json"), "utf8"));

const isUrl = (url) => /^https?:\/\//.test(url ?? "");
const out = [];
const problems = [];
for (const person of people) {
  const level = LEVEL[person.level];
  if (!level) { problems.push(`${person.id}: unknown level ${person.level}`); continue; }
  const records = person.records
    .filter((r) => TYPE[r.recordType])
    .map((r) => ({
      type: TYPE[r.recordType],
      offense: r.offense,
      sentence: r.sentence,
      status: r.status,
      caseNo: r.caseNo || "",
      judgmentUrl: isUrl(r.judgmentUrl) ? r.judgmentUrl : "",
      sources: r.sources.filter((s) => isUrl(s.url)).map(({ media, date, url }) => ({ media, date, url })),
    }));
  if (!records.length) continue;

  const county = countyName(person.city);
  const pool = registered[level].filter((c) => c.county === county
    && (level === "mayor" || districtNo(c.district) === districtNo(person.district)));
  const key = nameKey(person.name);
  const matches = pool.filter((c) => nameKey(c.name) === key);
  if (matches.length !== 1) { problems.push(`${person.id}: ${matches.length} registered matches`); continue; }
  const [match] = matches;
  out.push({ level, county, district: level === "council" ? districtNo(match.district) : 0, name: match.name, records });
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

out.sort((a, b) => a.county.localeCompare(b.county, "zh-Hant-TW") || a.district - b.district || a.name.localeCompare(b.name, "zh-Hant-TW"));
writeFileSync(OUTPUT, `${JSON.stringify({
  asOf,
  source: { name: "台灣前進製作民間版選舉公報", url: SITE, license: "CC BY 4.0" },
  people: out,
}, null, 1)}\n`);
const count = (type) => out.reduce((n, p) => n + p.records.filter((r) => r.type === type).length, 0);
console.log(`records-2026: ${out.length} people, ${count("guilty")} guilty, ${count("indicted")} indicted (as of ${asOf})`);
