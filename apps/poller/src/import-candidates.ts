import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { COUNTIES, districtId, type CandidateList, type CandidateProfile, type CouncilDistrict } from "@vote/shared";
import { flags, loadConfig, type PollerConfig } from "./config.js";
import { writeJsonAtomic } from "./data.js";
import { HttpError, PoliteFetcher } from "./fetcher.js";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => typeof value === "object" && value !== null && !Array.isArray(value);

export function rocDate(value: string): string {
  const match = value.match(/^(\d{2,3})(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Invalid ROC birth date: ${value}`);
  const year = Number(match[1]) + 1911, month = Number(match[2]), day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error(`Invalid ROC birth date: ${value}`);
  return `${year}-${match[2]}-${match[3]}`;
}

export function decodeName(value: string): string {
  return value.replace(/@([\da-fA-F]{4,6})@/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16))).normalize("NFC");
}

function profile(raw: unknown): CandidateProfile {
  if (!object(raw) || !Number.isInteger(Number(raw.candNo)) || Number(raw.candNo) < 1 || typeof raw.name !== "string" || typeof raw.party !== "string") {
    throw new Error(`Unknown candidate JSON structure: ${JSON.stringify(raw).slice(0, 300)}`);
  }
  const result: CandidateProfile = { no: Number(raw.candNo), name: decodeName(raw.name), party: raw.party };
  if (raw.gender === "男") result.gender = "M";
  if (raw.gender === "女") result.gender = "F";
  if (typeof raw.birth === "string" && raw.birth) result.birth = rocDate(raw.birth);
  if (typeof raw.home === "string" && raw.home) result.birthplace = raw.home;
  return result;
}

function list(value: unknown, code: string): unknown[] {
  const rows = object(value) ? value[code] : value;
  if (!Array.isArray(rows)) throw new Error(`Unknown ${code} JSON structure: ${JSON.stringify(value).slice(0, 300)}`);
  return rows;
}

export function parseMayorPayload(value: unknown, code = "C1"): CandidateProfile[] {
  const candidates = list(value, code).map(profile);
  if (!candidates.length) throw new Error(`Empty ${code} candidate list`);
  return candidates;
}

const voterType: Record<string, "T1" | "T2" | "T3"> = { "01": "T1", "03": "T2", "02": "T3" };

export function parseCouncilPayload(value: unknown, code: string, county: string): Record<string, CouncilDistrict> {
  const rows = list(value, code);
  if (!rows.length) throw new Error(`Empty ${code} council list for ${county}`);
  const result: Record<string, CouncilDistrict> = {};
  for (const row of rows) {
    if (!object(row)) throw new Error(`Unknown council JSON structure for ${county}: ${JSON.stringify(row).slice(0, 300)}`);
    const no = String(row.areaCode ?? row.areaNo ?? "").padStart(2, "0");
    const prefix = /^T[123]$/.test(code) ? code as "T1" | "T2" | "T3" : voterType[String(row.voterType ?? "")];
    const candidates = row.cands ?? row.candidates;
    if (!/^\d{2}$/.test(no) || !prefix || !Array.isArray(candidates)) {
      throw new Error(`Unknown council district JSON structure for ${county}/${code}: ${JSON.stringify(row).slice(0, 300)}`);
    }
    const id = districtId(county, prefix, no);
    if (result[id]) throw new Error(`Duplicate council district ${id}`);
    const seats = Number(row.numberElected ?? row.seats);
    const district: CouncilDistrict = {
      county, type: prefix === "T1" ? "區域" : prefix === "T2" ? "平地原住民" : "山地原住民", no,
      candidates: candidates.map(profile),
    };
    if (Number.isInteger(seats) && seats > 0) district.seats = seats;
    result[id] = district;
  }
  return result;
}

function photoPath(img: string): string {
  const relative = img.replace(/^\/?json\//, "").replace(/^\//, "");
  if (!/^portrait\/cand\/[A-Za-z0-9]+\/\d{5}\/[A-Za-z0-9._-]+\.jpe?g$/i.test(relative)) throw new Error(`Unexpected portrait path: ${img}`);
  return relative;
}

export async function importCandidates(config: PollerConfig, photos = false, fetcher = new PoliteFetcher(config)): Promise<"written" | "not-published"> {
  if (!config.candidateBaseUrl) throw new Error("candidateBaseUrl is required");
  const base = config.candidateBaseUrl.replace(/\/?$/, "/");
  const getJson = async (path: string): Promise<unknown> => {
    const url = new URL(path, base).href;
    const body = await fetcher.text(url);
    try { return JSON.parse(body); }
    catch { throw new Error(`Invalid candidate JSON at ${url}`); }
  };
  const result: CandidateList = { schema: 1, election: config.election, generatedAt: new Date().toISOString(), source: base, mayors: {}, councils: {} };
  const photoJobs: { profile: CandidateProfile; img: string }[] = [];
  try {
    for (const county of COUNTIES) {
      let types: string[] = [];
      try {
        const response = await getJson(`type/${county.code}.json`);
        if (object(response) && object(response.types)) types = Object.values(response.types).flatMap(x => Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 404)) throw error;
      }
      const mayorCode = types.find(x => /^C\d+$/.test(x)) ?? "C1";
      const mayorPayload = await getJson(`cand/${mayorCode}/${county.code}.json`);
      result.mayors[county.code] = parseMayorPayload(mayorPayload, mayorCode);
      if (photos) collectPhotos(mayorPayload, mayorCode, result.mayors[county.code], photoJobs);
      const councilCodes = types.filter(x => /^T(?:[123])?$/.test(x));
      if (!councilCodes.length) councilCodes.push("T");
      for (const code of councilCodes) {
        const payload = await getJson(`cand/${code}/${county.code}.json`);
        const districts = parseCouncilPayload(payload, code, county.code);
        for (const [id, district] of Object.entries(districts)) {
          if (result.councils[id]) throw new Error(`Duplicate council district ${id}`);
          result.councils[id] = district;
        }
        if (photos) {
          const rows = list(payload, code);
          for (const row of rows) {
            if (!object(row)) continue;
            const no = String(row.areaCode ?? row.areaNo ?? "").padStart(2, "0");
            const prefix = /^T[123]$/.test(code) ? code as "T1" | "T2" | "T3" : voterType[String(row.voterType ?? "")];
            if (prefix && Array.isArray(row.cands ?? row.candidates)) collectPhotos(row.cands ?? row.candidates, undefined, result.councils[districtId(county.code, prefix, no)]!.candidates, photoJobs);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      console.log(`Candidate lists are not published yet: ${error.url}`);
      return "not-published";
    }
    console.error(`Candidate import failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
  if (photos) await Promise.all(photoJobs.map(async job => {
    try {
      const relative = photoPath(job.img);
      const output = join(config.outDir, "photos", relative.slice("portrait/cand/".length));
      const bytes = await fetcher.get(new URL(relative, base).href);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
      job.profile.photo = `photos/${relative.slice("portrait/cand/".length)}`;
    } catch (error) { console.error(`Portrait ${job.img}: ${error instanceof Error ? error.message : String(error)}`); }
  }));
  await writeJsonAtomic(join(config.outDir, "candidates.json"), result);
  console.log(`Wrote ${join(config.outDir, "candidates.json")}: ${Object.keys(result.mayors).length} mayors, ${Object.keys(result.councils).length} council districts`);
  return "written";
}

function collectPhotos(payload: unknown, code: string | undefined, profiles: CandidateProfile[], jobs: { profile: CandidateProfile; img: string }[]): void {
  const rows = code ? list(payload, code) : payload;
  if (!Array.isArray(rows)) return;
  rows.forEach((row, i) => { if (object(row) && typeof row.img === "string" && row.img) jobs.push({ profile: profiles[i]!, img: row.img }); });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = flags();
  const config = await loadConfig(String(options.config ?? "poller.config.json"));
  if (options.year) {
    config.year = Number(options.year);
    if (!Number.isInteger(config.year) || config.year < 2022) throw new Error("Invalid --year");
    config.election = `${config.year}-local`;
  }
  if (options["base-url"]) {
    config.candidateBaseUrl = String(options["base-url"]);
    if (!/^https?:\/\//.test(config.candidateBaseUrl)) throw new Error("Invalid --base-url");
  }
  await importCandidates(config, Boolean(options.photos));
}
