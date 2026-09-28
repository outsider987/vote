import { COUNTIES } from "@vote/shared";
import { districtIds } from "./poll.js";
import { flags, loadConfig, type Prefix } from "./config.js";
import { PoliteFetcher } from "./fetcher.js";
import { parseCandidateVotes, parseTurnoutPage } from "./parser.js";
import { pageUrl } from "./url.js";

export async function probe(configPath: string): Promise<boolean> {
  const config = await loadConfig(configPath);
  const fetcher = new PoliteFetcher(config);
  let good = true;
  if (config.treeUrl) {
    try {
      const tree = JSON.parse(await fetcher.text(config.treeUrl));
      if (!tree || typeof tree !== "object" || !Object.keys(tree).length) throw new Error("Empty tree JSON");
      console.log(`tree OK (${Object.keys(tree).length} entries)`);
    } catch (error) { good = false; console.error(`tree FAIL: ${error instanceof Error ? error.message : String(error)}`); }
  }
  let districts: string[] = [];
  try { districts = await districtIds(config); }
  catch (error) { good = false; console.error(`district list FAIL: ${error instanceof Error ? error.message : String(error)}`); }
  const county = COUNTIES.find(x => x.code === "10013")!.code;
  for (const prefix of ["TC", "T1", "T2", "T3", "SC", "ST"] as Prefix[]) {
    const match = districts.find(id => id.includes(`-${prefix}-`));
    if (prefix.startsWith("T") && prefix !== "TC" && !match) { good = false; console.error(`${prefix} FAIL: no district sample`); continue; }
    const [sampleCounty, , no] = match?.split("-") ?? [];
    const url = pageUrl(config, prefix, prefix.startsWith("T") && prefix !== "TC" ? sampleCounty! : county, no ?? "00");
    try {
      const html = await fetcher.text(url);
      if (prefix === "SC" || prefix === "ST") {
        const result = parseTurnoutPage(html, config.year);
        if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
        console.log(`${prefix} OK ${result.value.rows.length} turnout rows ${url}`);
      } else {
        const result = parseCandidateVotes(html, config.year);
        if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
        console.log(`${prefix} OK ${result.value.candidates.length} candidates, ${result.value.stations.reported}/${result.value.stations.total} stations ${url}`);
      }
    } catch (error) { good = false; console.error(`${prefix} FAIL ${url}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return good;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = flags();
  if (!await probe(String(options.config ?? "poller.config.json"))) process.exitCode = 1;
}
