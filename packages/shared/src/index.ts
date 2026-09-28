/**
 * Data contract shared by the poller (writer) and the web app (reader).
 *
 * Codes follow the CEC / Ministry of the Interior scheme:
 * - CountyCode: 5 digits, CEC prv_code + city_code, e.g. "63000" (臺北市), "10013" (屏東縣).
 * - TownCode:   county code + CEC dept_code, e.g. "63000010" (松山區). Same as taiwan-atlas TOWNCODE.
 * - DistrictId: councilor district, "{county}-{T1|T2|T3}-{no}", e.g. "63000-T1-01".
 *               T1 = 區域, T2 = 平地原住民, T3 = 山地原住民 (CEC count-site prefixes).
 */

export type CountyCode = string;
export type TownCode = string;
export type DistrictId = string;
export type DistrictType = "區域" | "平地原住民" | "山地原住民";

/**
 * CEC count-site marks: ◎ elected (● elected through the women's reserved seat, with `womenQuota`),
 * - displaced by a women's reserved seat (排擠), ？ tie awaiting a draw, ＜ below the minimum winning votes.
 */
export type Mark = "elected" | "displaced" | "tie" | "belowMin" | null;

export interface CandidateTally {
  /** Ballot number (號次). */
  no: number;
  name: string;
  /** Party name exactly as the CEC writes it, e.g. "中國國民黨", "無黨籍及未經政黨推薦". */
  party: string;
  votes: number;
  /** 得票率 in percent, as published. */
  pct: number;
  mark: Mark;
  /** Elected through the women's reserved seat (● 婦女優先當選 / 婦女保障名額), when the source says so. */
  womenQuota?: boolean;
}

export interface RaceTally {
  /** Polling stations reported / expected (投開票所 已送/應送). */
  stations: { reported: number; total: number };
  /** CEC 資料更新時間 as ISO 8601 with +08:00, or null when the page has none. */
  updatedAt: string | null;
  /** 應選人數. */
  seats: number;
  /** 婦女應當選名額 (councilor districts), when the page states it. */
  womenSeats?: number;
  candidates: CandidateTally[];
  /** From the turnout pages (SC mayor / ST councilor): 選舉人數, 投票數, 有效票數, 無效票數 so far. */
  turnout?: Turnout;
}

export interface Turnout {
  electors: number;
  cast: number;
  valid: number;
  invalid: number;
}

/** Written by the poller as `results.json`; read by the web app every ~30 s. */
export interface LiveResults {
  schema: 1;
  /** e.g. "2026-local". */
  election: string;
  /** When the poller wrote this file (ISO 8601). */
  generatedAt: string;
  /** Count-site stage: before counting, counting, or final. */
  stage: "prior" | "count" | "final";
  /** Base URL the numbers came from. */
  source: string;
  mayors: Record<CountyCode, RaceTally>;
  /** Town-level mayor tallies for the county drill-down; refreshed less often. */
  mayorTowns?: Record<TownCode, RaceTally>;
  councils: Record<DistrictId, RaceTally>;
}

export interface CandidateProfile {
  no: number;
  name: string;
  party: string;
  gender?: "M" | "F";
  /** ISO date (converted from the CEC ROC date such as "0740111"). */
  birth?: string;
  birthplace?: string;
  /** Photo path relative to the candidates file, when downloaded. */
  photo?: string;
}

export interface CouncilDistrict {
  county: CountyCode;
  type: DistrictType;
  /** District number as the CEC writes it, e.g. "01". */
  no: string;
  seats?: number;
  candidates: CandidateProfile[];
}

/** Written by `import-candidates` as `candidates.json`. */
export interface CandidateList {
  schema: 1;
  election: string;
  generatedAt: string;
  source: string;
  mayors: Record<CountyCode, CandidateProfile[]>;
  councils: Record<DistrictId, CouncilDistrict>;
}

export type CountyKind = "municipality" | "county" | "city";

export interface CountyInfo {
  code: CountyCode;
  name: string;
  short: string;
  kind: CountyKind;
}

/** The 22 counties/cities, north → south, then the east coast and the outlying islands. */
export const COUNTIES: readonly CountyInfo[] = [
  { code: "10017", name: "基隆市", short: "基隆", kind: "city" },
  { code: "63000", name: "臺北市", short: "臺北", kind: "municipality" },
  { code: "65000", name: "新北市", short: "新北", kind: "municipality" },
  { code: "68000", name: "桃園市", short: "桃園", kind: "municipality" },
  { code: "10004", name: "新竹縣", short: "竹縣", kind: "county" },
  { code: "10018", name: "新竹市", short: "竹市", kind: "city" },
  { code: "10005", name: "苗栗縣", short: "苗栗", kind: "county" },
  { code: "66000", name: "臺中市", short: "臺中", kind: "municipality" },
  { code: "10007", name: "彰化縣", short: "彰化", kind: "county" },
  { code: "10008", name: "南投縣", short: "南投", kind: "county" },
  { code: "10009", name: "雲林縣", short: "雲林", kind: "county" },
  { code: "10010", name: "嘉義縣", short: "嘉縣", kind: "county" },
  { code: "10020", name: "嘉義市", short: "嘉市", kind: "city" },
  { code: "67000", name: "臺南市", short: "臺南", kind: "municipality" },
  { code: "64000", name: "高雄市", short: "高雄", kind: "municipality" },
  { code: "10013", name: "屏東縣", short: "屏東", kind: "county" },
  { code: "10002", name: "宜蘭縣", short: "宜蘭", kind: "county" },
  { code: "10015", name: "花蓮縣", short: "花蓮", kind: "county" },
  { code: "10014", name: "臺東縣", short: "臺東", kind: "county" },
  { code: "10016", name: "澎湖縣", short: "澎湖", kind: "county" },
  { code: "09020", name: "金門縣", short: "金門", kind: "county" },
  { code: "09007", name: "連江縣", short: "連江", kind: "county" },
];

export const districtId = (county: CountyCode, legis: "T1" | "T2" | "T3", no: string): DistrictId =>
  `${county}-${legis}-${no.padStart(2, "0")}`;
