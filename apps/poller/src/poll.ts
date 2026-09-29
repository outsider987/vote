import { join } from "node:path";
import { COUNTIES, districtId, type CandidateList, type LiveResults, type RaceTally } from "@vote/shared";
import { flags, loadConfig, stageOf, type PollerConfig, type Prefix } from "./config.js";
import { readJson, replayFile, writeJsonAtomic } from "./data.js";
import { PoliteFetcher } from "./fetcher.js";
import { parseCandidateVotes, parseTurnoutPage } from "./parser.js";
import { pageUrl } from "./url.js";

interface ReplayCouncil { counties: { districts: { id: string }[] }[] }
type ReplayTowns = Record<string, { code: string; name: string }[]>;

export async function districtIds(config: PollerConfig): Promise<string[]> {
  let ids: string[];
  if (config.districts === "2022") {
    if (config.year !== 2022) throw new Error("2022 district list cannot be used for another election");
    const data = await readJson<ReplayCouncil>(replayFile("council-2022.json"));
    ids = data.counties.flatMap(county => county.districts.map(district => district.id));
  } else if (Array.isArray(config.districts)) ids = config.districts;
  else {
    const list = await readJson<CandidateList>(join(config.outDir, "candidates.json"));
    if (list.schema !== 1 || list.election !== config.election || !list.councils) throw new Error("Candidate list election mismatch");
    ids = Object.keys(list.councils);
  }
  if (!ids.length || ids.some(id => !/^\d{5}-T[123]-\d{2}$/.test(id)) || new Set(ids).size !== ids.length) throw new Error("Invalid or empty council district list");
  return ids;
}

export async function townIds(config: PollerConfig): Promise<string[]> {
  let codes: string[];
  if (Array.isArray(config.towns)) codes = config.towns;
  else {
    const data = await readJson<ReplayTowns>(replayFile("mayor-2022-towns.json"));
    codes = Object.values(data).flatMap(towns => towns.map(town => town.code));
  }
  if (codes.some(code => !/^\d{8}$/.test(code)) || new Set(codes).size !== codes.length) throw new Error("Invalid mayor town codes");
  return codes;
}

export async function pollCycle(config: PollerConfig, fetcher: PoliteFetcher, cycle: number, districts: string[], towns: string[], previous?: LiveResults): Promise<{ results: LiveResults; errors: number }> {
  const keep = (keys: readonly string[], values: Record<string, RaceTally> | undefined): Record<string, RaceTally> =>
    Object.fromEntries(keys.flatMap(key => values?.[key] ? [[key, values[key]]] : []));
  const mayors = keep(COUNTIES.map(county => county.code), previous?.mayors);
  const councils = keep(districts, previous?.councils);
  const mayorTowns = keep(towns, previous?.mayorTowns);
  const townData = await readJson<ReplayTowns>(replayFile("mayor-2022-towns.json"));
  const townNames = new Map<string, Map<string, string[]>>();
  for (const [county, rows] of Object.entries(townData)) {
    const names = new Map<string, string[]>();
    for (const town of rows) names.set(town.name, [...names.get(town.name) ?? [], town.code]);
    townNames.set(county, names);
  }
  const allowedTowns = new Set(towns), allowedDistricts = new Set(districts);
  let errors = 0;
  const tasks: { key: string; target: Record<string, RaceTally>; url: string }[] = [
    ...COUNTIES.map(county => ({ key: county.code, target: mayors, url: pageUrl(config, "TC", county.code) })),
    ...districts.map(id => {
      const [county, prefix, no] = id.split("-") as [string, Prefix, string];
      return { key: id, target: councils, url: pageUrl(config, prefix, county, no) };
    }),
  ];
  if ((cycle - 1) % config.townEvery === 0) {
    tasks.push(...towns.map(code => ({ key: code, target: mayorTowns, url: pageUrl(config, "TC", code.slice(0, 5), "00", code.slice(5)) })));
  }
  await Promise.all(tasks.map(async task => {
    try {
      const parsed = parseCandidateVotes(await fetcher.text(task.url), config.year);
      if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
      task.target[task.key] = task.target[task.key]?.turnout ? { ...parsed.value, turnout: task.target[task.key]!.turnout } : parsed.value;
    } catch (error) {
      errors++;
      console.error(`${task.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  await Promise.all(COUNTIES.flatMap(county => (["SC", "ST"] as const).map(async prefix => {
    const url = pageUrl(config, prefix, county.code);
    try {
      const parsed = parseTurnoutPage(await fetcher.text(url), config.year);
      if (!parsed.ok) throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
      for (const row of parsed.value.rows) {
        if (prefix === "SC") {
          if (row.label === "總計" && mayors[county.code]) { mayors[county.code].turnout = row.turnout; continue; }
          const codes = townNames.get(county.code)?.get(row.label);
          if (codes?.length === 1 && allowedTowns.has(codes[0]!) && mayorTowns[codes[0]!]) {
            mayorTowns[codes[0]!]!.turnout = row.turnout;
            continue;
          }
        } else {
          const match = row.label.match(/^第\s*(\d+)\s*選舉區(?:\s*[(（]\s*(平地原住民|山地原住民)\s*[)）])?$/);
          if (match) {
            const type = match[2] === "平地原住民" ? "T2" : match[2] === "山地原住民" ? "T3" : "T1";
            const id = districtId(county.code, type, match[1]!);
            if (allowedDistricts.has(id) && councils[id]) { councils[id].turnout = row.turnout; continue; }
          }
        }
        errors++;
        console.error(`${url}: unmatched turnout row ${row.label}`);
      }
    } catch (error) {
      errors++;
      console.error(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  })));
  const results: LiveResults = {
    schema: 1,
    election: config.election,
    generatedAt: new Date().toISOString(),
    stage: stageOf({ mayors, councils }, districts, COUNTIES.map(county => county.code)),
    source: config.countBaseUrl,
    mayors,
    mayorTowns,
    councils,
  };
  await writeJsonAtomic(join(config.outDir, "results.json"), results);
  return { results, errors };
}

export async function runPoll(config: PollerConfig, cycles = Infinity): Promise<void> {
  const districts = await districtIds(config);
  const towns = await townIds(config);
  const fetcher = new PoliteFetcher(config);
  let previous: LiveResults | undefined;
  try {
    const saved = await readJson<LiveResults>(join(config.outDir, "results.json"));
    if (saved.schema === 1 && saved.election === config.election && saved.source === config.countBaseUrl) previous = saved;
  }
  catch { /* First run. */ }
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const started = Date.now();
    const before = { ...fetcher.stats };
    const { results, errors } = await pollCycle(config, fetcher, cycle, districts, towns, previous);
    previous = results;
    console.log(`cycle=${cycle} stage=${results.stage} requests=${fetcher.stats.requests - before.requests} 304=${fetcher.stats.notModified - before.notModified} errors=${errors} durationMs=${Date.now() - started}`);
    if (cycle < cycles) await new Promise(resolve => setTimeout(resolve, Math.max(0, started + config.intervalMs - Date.now())));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = flags();
  const config = await loadConfig(String(options.config ?? "poller.config.json"));
  const cycles = options.once ? 1 : options.cycles ? Number(options.cycles) : Infinity;
  if (cycles !== Infinity && (!Number.isInteger(cycles) || cycles < 1)) throw new Error("--cycles must be a positive integer");
  await runPoll(config, cycles);
}
