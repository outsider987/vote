import { COUNTIES } from "@vote/shared";
import type { DistrictType } from "@vote/shared";

export type PartyKey = "kmt" | "dpp" | "tpp" | "npp" | "ind" | "other";
export interface PartyStyle { key: PartyKey; short: string; color: string }

// Party colors: KMT/DPP/TPP validated as a categorical set (all-pairs ΔE ≥ 16, contrast ≥ 3:1 on the board);
// the rest always appear next to their party name.
const PARTIES: Record<string, PartyStyle> = {
  "中國國民黨": { key: "kmt", short: "國民黨", color: "#2A52BE" },
  "民主進步黨": { key: "dpp", short: "民進黨", color: "#3B8A2A" },
  "台灣民眾黨": { key: "tpp", short: "民眾黨", color: "#1592B8" },
  "時代力量": { key: "npp", short: "時代力量", color: "#B38700" },
  "無黨籍及未經政黨推薦": { key: "ind", short: "無黨籍", color: "#7A8288" },
};
const INDEPENDENT = PARTIES["無黨籍及未經政黨推薦"];
const OTHER_PARTY: PartyStyle = { key: "other", short: "其他政黨", color: "#8067B7" };

export const LEGEND: readonly { key: PartyKey; name: string; color: string }[] = [
  { key: "kmt", name: "國民黨", color: "#2A52BE" },
  { key: "dpp", name: "民進黨", color: "#3B8A2A" },
  { key: "tpp", name: "民眾黨", color: "#1592B8" },
  { key: "npp", name: "時代力量", color: "#B38700" },
  { key: "ind", name: "無黨籍", color: "#7A8288" },
  { key: "other", name: "其他政黨", color: "#8067B7" },
];

// The count site and the results database spell independents differently ("無", "無黨籍", …).
export const partyOf = (name: string): PartyStyle =>
  PARTIES[name] ?? (/^無$|無黨籍|未經政黨推薦/.test(name) ? INDEPENDENT : OTHER_PARTY);
export const partyLabel = (name: string): string => {
  const p = partyOf(name);
  return p === OTHER_PARTY ? name : p.short;
};

/** Public-domain emblems (see data/party-emblems/sources.json); other parties get a text seal. */
export const EMBLEMS: Partial<Record<PartyKey, string>> = {
  kmt: "data/party-emblems/kmt.svg",
  dpp: "data/party-emblems/dpp.svg",
  tpp: "data/party-emblems/tpp.svg",
};

// North → south, then east coast, then the outlying islands.
export const ORDER: readonly string[] = COUNTIES.map((c) => c.code);
export const SHORT: Record<string, string> = Object.fromEntries(COUNTIES.map((c) => [c.code, c.short]));

// Kinmen and Matsu are drawn closer to Taiwan (labelled 示意位置), shifted in degrees.
export const SHIFT: Record<string, [number, number]> = { "09020": [0.95, 0.35], "09007": [-0.1, -0.95] };
export const INSET_SCALE = 1.8;   // their footprint is enlarged too (labelled 非等比例)

/** The election this site covers; live results from any other election are shown as a rehearsal. */
export const ELECTION = "2026-local";
/** Polls close and counting starts: Saturday 2026-11-28, 16:00 Taiwan time. */
export const COUNT_STARTS_AT = Date.parse("2026-11-28T16:00:00+08:00");

export type Mode = "mayor" | "council" | "close";

export function modeCopy(mode: Mode, councilSeats: number) {
  if (mode === "council") return {
    height: "<b>紙堆高度</b>＝議員選票已開出票數 ÷ 選舉人數",
    top: "<b>頂層顏色</b>＝席次最多的政黨，淡色為開票中、實色並蓋章為全數確定",
    seatOf: `／${councilSeats}`,
    seatLabel: "席確定",
  };
  if (mode === "close") return {
    height: "<b>紙堆高度</b>＝已開出票數 ÷ 選舉人數",
    top: `<b>螢光筆</b>＝縣市長前兩名差距，越深越接近<span class="ramp" aria-hidden="true">${RAMP.slice().reverse().map(([, c]) => `<i style="background:${c}"></i>`).join("")}</span> 20%・10%・5%・2% 以內`,
    seatOf: `／${COUNTIES.length}`,
    seatLabel: "席當選確定",
  };
  return {
    height: "<b>紙堆高度</b>＝已開出票數 ÷ 選舉人數，開完即為投票率",
    top: "<b>頂層顏色</b>＝淡色為目前領先、實色並蓋章為當選確定",
    seatOf: `／${COUNTIES.length}`,
    seatLabel: "席當選確定",
  };
}

export const DURATION = 40;           // replay seconds for 16:00 → 23:30 at 1×
export const START_MIN = 16 * 60;
export const SPAN_MIN = 7.5 * 60;
export const HEIGHT_SCALE = 2.1;      // world units of stack height at 100% turnout
export const LON0 = 120.75, LAT0 = 23.8, MAP_SCALE = 2.75;
export const PAPER = "#F4F5F3";
export const RECEDE = "#CBD3CF";      // counties behind an open county fade toward the desk
// Closeness "highlighter" ramp (validated: one hue, monotone lightness, light end ≥ 2:1 on the board).
export const RAMP: readonly [number, string][] = [[0.02, "#975221"], [0.05, "#B56C2E"], [0.10, "#CC873B"], [0.20, "#DDA24A"]];

// 拉鋸戰. Mayor: leader vs runner-up. Councilor: the last seat (rank N) vs the first loser (rank N+1).
export const CLOSE = {
  mayor: { threshold: 0.04, scale: 0.05, flip: "領先易主", note: "指針刻度 ±5 個百分點", empty: "目前沒有差距在 4% 以內的縣市長戰局。" },
  council: { threshold: 0.015, scale: 0.02, flip: "排名互換", note: "指針刻度 ±2 個百分點", empty: "目前沒有最後一席差距在 1.5% 以內的選區。" },
} as const;

const indigenousShort = (d: { type: DistrictType }) => (d.type === "平地原住民" ? "平原" : "山原");
export const districtLabel = (d: { type: DistrictType; no: string }) =>
  (d.type === "區域" ? `第${d.no}選區` : `第${d.no}選區・${indigenousShort(d)}`);
export const districtShort = (d: { type: DistrictType; no: string }) =>
  (d.type === "區域" ? d.no : `${d.no}${indigenousShort(d)}`);

/** "國民黨 12・民進黨 9" — seat counts grouped by legend party, largest first. */
export function partySummary(counts: Record<string, number>, limit = 4) {
  const grouped: Partial<Record<PartyKey, number>> = {};
  for (const [party, n] of Object.entries(counts)) {
    const key = partyOf(party).key;
    grouped[key] = (grouped[key] || 0) + n;
  }
  return LEGEND.filter((l) => grouped[l.key]).sort((a, b) => grouped[b.key]! - grouped[a.key]!)
    .slice(0, limit).map((l) => `${l.name} ${grouped[l.key]}`).join("・");
}
