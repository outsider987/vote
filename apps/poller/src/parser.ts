import { parse } from "node-html-parser";
import type { CandidateTally, Mark, RaceTally, Turnout } from "@vote/shared";

export type ParseResult = { ok: true; value: RaceTally } | { ok: false; error: { code: "MARKUP" | "NUMBER" | "DATE"; message: string } };
export type TurnoutResult = { ok: true; value: { rows: { label: string; turnout: Turnout }[]; updatedAt: string | null } } | { ok: false; error: { code: "MARKUP" | "NUMBER" | "DATE"; message: string } };

const clean = (text: string) => text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function integer(value: string): number | null {
  const text = clean(value);
  return /^\d{1,3}(?:,\d{3})*$|^\d+$/.test(text) ? Number(text.replaceAll(",", "")) : null;
}

function date(text: string, year: number): string | null {
  const match = text.match(/資料(?:更新)?時間\s*[:：]\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, mm, dd, hh, min, ss = "00"] = match;
  const m = Number(mm), d = Number(dd), h = Number(hh), n = Number(min), s = Number(ss);
  const check = new Date(Date.UTC(year, m - 1, d));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || h > 23 || n > 59 || s > 59) throw new Error("Invalid update time");
  return `${year}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}T${hh!.padStart(2, "0")}:${min}:${ss}+08:00`;
}

export function parseCandidateVotes(html: string, year: number): ParseResult {
  const root = parse(html);
  const text = clean(root.text);
  const stations = text.match(/投開票所數\s*已送\s*\/\s*應送\s*[:：]\s*([\d,]+)\s*\/\s*([\d,]+)/)
    ?? text.match(/已送投(?:開)?票所數\s*\/\s*總投(?:開)?票所數\s*[:：]\s*([\d,]+)\s*\/\s*([\d,]+)/);
  const seats = text.match(/應選人數\s*[:：]\s*([\d,]+)/);
  const women = text.match(/婦女應當選名額\s*[:：]\s*([\d,]+)/);
  if (!stations || !seats) return { ok: false, error: { code: "MARKUP", message: "Missing station count or seats" } };
  const reported = integer(stations[1]!), total = integer(stations[2]!), seatCount = integer(seats[1]!), womenSeats = women ? integer(women[1]!) : undefined;
  if (reported === null || total === null || seatCount === null || seatCount < 1 || reported > total || total === 0 || womenSeats === null) {
    return { ok: false, error: { code: "NUMBER", message: "Invalid station count or seats" } };
  }
  const table = root.querySelectorAll("table").find(node => {
    const labels = node.querySelectorAll("th").map(th => clean(th.text));
    return labels.includes("號次") && labels.includes("姓名") && labels.includes("得票數");
  });
  if (!table) return { ok: false, error: { code: "MARKUP", message: "Candidate table not found" } };
  const labels = table.querySelectorAll("th").map(th => clean(th.text));
  const column = (name: string) => labels.findIndex(label => label.includes(name));
  const noCol = column("號次"), nameCol = column("姓名"), voteCol = column("得票數"), pctCol = column("得票率"), partyCol = column("推薦之政黨"), markCol = column("註記");
  if ([noCol, nameCol, voteCol, pctCol, partyCol].some(x => x < 0)) {
    return { ok: false, error: { code: "MARKUP", message: `Unknown candidate columns: ${labels.join(", ")}` } };
  }
  const candidates: CandidateTally[] = [];
  for (const row of table.querySelectorAll("tbody tr")) {
    const cells = row.querySelectorAll("td").map(td => clean(td.text));
    if (!cells.length) continue;
    if (cells.length !== labels.length) return { ok: false, error: { code: "MARKUP", message: "Candidate row column count differs from header" } };
    const no = integer(cells[noCol]!);
    const votes = integer(cells[voteCol]!);
    const pctText = cells[pctCol]!.replace(/[%％]/g, "").trim();
    const pct = /^\d+(?:\.\d+)?$/.test(pctText) ? Number(pctText) : null;
    if (no === null || votes === null || pct === null || pct > 100 || !cells[nameCol]) {
      return { ok: false, error: { code: "NUMBER", message: `Invalid candidate row: ${cells.join(" | ")}` } };
    }
    const marks = (markCol < 0 ? "" : cells[markCol]!).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    const markBySymbol: Record<string, Mark> = { "": null, "◎": "elected", "●": "elected", "-": "displaced", "－": "displaced", "‐": "displaced", "？": "tie", "＜": "belowMin" };
    if (!Object.hasOwn(markBySymbol, marks)) {
      return { ok: false, error: { code: "MARKUP", message: `Unknown candidate mark: ${marks}` } };
    }
    const candidate: CandidateTally = { no, name: cells[nameCol]!, party: cells[partyCol]!, votes, pct, mark: markBySymbol[marks]! };
    if (marks === "●") candidate.womenQuota = true;
    candidates.push(candidate);
  }
  if (!candidates.length && reported > 0) return { ok: false, error: { code: "MARKUP", message: "No candidates on a reported race" } };
  if (new Set(candidates.map(c => c.no)).size !== candidates.length) return { ok: false, error: { code: "MARKUP", message: "Duplicate ballot numbers" } };
  try {
    const value: RaceTally = { stations: { reported, total }, updatedAt: date(text, year), seats: seatCount, candidates };
    if (womenSeats !== undefined) value.womenSeats = womenSeats;
    return { ok: true, value };
  } catch {
    return { ok: false, error: { code: "DATE", message: "Invalid CEC update time" } };
  }
}

export function parseTurnoutPage(html: string, year: number): TurnoutResult {
  const root = parse(html);
  const table = root.querySelectorAll("table").find(node => {
    const labels = node.querySelectorAll("th").map(th => clean(th.text));
    return labels.includes("選舉人數") && labels.includes("投票數") && labels.includes("有效票數") && labels.includes("無效票數") && (labels.includes("行政區") || labels.includes("選舉區"));
  });
  if (!table) return { ok: false, error: { code: "MARKUP", message: "Turnout table not found" } };
  const labels = table.querySelectorAll("th").map(th => clean(th.text));
  const index = (name: string) => labels.indexOf(name);
  const labelCol = Math.max(index("行政區"), index("選舉區"));
  const rows: { label: string; turnout: Turnout }[] = [];
  for (const row of table.querySelectorAll("tbody tr")) {
    const cells = row.querySelectorAll("td").map(td => clean(td.text));
    if (!cells.length) continue;
    if (cells.length !== labels.length || !cells[labelCol]) return { ok: false, error: { code: "MARKUP", message: `Invalid turnout row: ${cells.join(" | ")}` } };
    const electors = integer(cells[index("選舉人數")]!), cast = integer(cells[index("投票數")]!), valid = integer(cells[index("有效票數")]!), invalid = integer(cells[index("無效票數")]!);
    if (electors === null || cast === null || valid === null || invalid === null || cast > electors || cast !== valid + invalid) {
      return { ok: false, error: { code: "NUMBER", message: `Invalid turnout numbers: ${cells.join(" | ")}` } };
    }
    rows.push({ label: cells[labelCol]!, turnout: { electors, cast, valid, invalid } });
  }
  if (!rows.length) return { ok: false, error: { code: "MARKUP", message: "No turnout rows" } };
  try { return { ok: true, value: { rows, updatedAt: date(clean(root.text), year) } }; }
  catch { return { ok: false, error: { code: "DATE", message: "Invalid CEC update time" } }; }
}
