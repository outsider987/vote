import type { CountyKind, DistrictType } from "@vote/shared";
import type { Topology } from "topojson-specification";
import type { TownRecord } from "./types";

/** data/mayor-2022.json */
export interface MayorFile {
  election: string;
  counties: {
    code: string;
    name: string;
    type: CountyKind;
    electors: number;
    votesCast: number;
    valid: number;
    turnout: number;
    candidates: { no: number; name: string; party: string; votes: number; elected: boolean; photo?: string; platformUrl?: string; platformImage?: string; birth?: string; birthplace?: string; gender?: "M" | "F" | null; incumbent?: boolean }[];
  }[];
}

/** data/council-2022.json */
export interface CouncilFile {
  election: string;
  counties: {
    code: string;
    name: string;
    kind: string;
    seats: number;
    districts: {
      id: string;
      type: DistrictType;
      no: string;
      name: string;
      seats: number;
      electors: number;
      votesCast: number;
      valid: number;
      towns: { code: string; name: string }[];
      candidates: { no: number; name: string; party: string; votes: number; elected: boolean; womenQuota?: boolean; photo?: string; platformUrl?: string; platformImage?: string; birth?: string; birthplace?: string; gender?: "M" | "F" | null; incumbent?: boolean }[];
    }[];
  }[];
}

/** data/mayor-2022-towns.json */
export type TownsFile = Record<string, TownRecord[]>;

export interface RegisteredFile {
  asOf: string;
  status: "registered-pending-review";
  mayor: RegisteredCandidate[];
  council: RegisteredCandidate[];
}

/** data/records-2026.json (scripts/prepare_2026_records.mjs) */
export interface RecordsFile {
  asOf: string;
  source: { name: string; url: string; license: string };
  people: RecordPerson[];
}

export interface RecordPerson {
  level: "mayor" | "council";
  county: string;
  /** Council district number; 0 for mayors. */
  district: number;
  name: string;
  records: CourtRecord[];
}

export interface CourtRecord {
  type: "guilty" | "indicted";
  offense: string;
  sentence: string;
  status: string;
  caseNo: string;
  judgmentUrl: string;
  sources: { media: string; date: string; url: string }[];
}

export interface RegisteredCandidate {
  county: string;
  district: string;
  name: string;
  party: string;
  registeredAt: string;
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

export const loadMayors = () => getJSON<MayorFile>("data/mayor-2022.json");
export const loadCouncils = () => getJSON<CouncilFile>("data/council-2022.json");
export const loadTowns = () => getJSON<TownsFile>("data/mayor-2022-towns.json");
export const loadCountyTopo = () => getJSON<Topology>("data/taiwan-atlas-counties-10t.json");
export const loadTownTopo = () => getJSON<Topology>("data/taiwan-atlas-towns-10t.json");
export const loadRecords = () => getJSON<RecordsFile>("data/records-2026.json");
export const loadRegistered = () => getJSON<RegisteredFile>("data/registered-2026.json");
