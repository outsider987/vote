import type { RecordsFile, RecordPerson } from "./data";

/* 公開司法紀錄: 2026 candidates' public court records, from 台灣前進「民間版選舉公報」 (data/records-2026.json). */

export type RecordLevel = RecordPerson["level"];

// Keep in sync with nameKey() in scripts/prepare_2026_records.mjs: drops romanized indigenous names and PDF stray letters.
export const recordKey = (level: RecordLevel, county: string, name: string) =>
  `${level}|${county.replace(/^台/, "臺")}|${name.replace(/[\sA-Za-z．·・.]/g, "")}`;

export const records = {
  file: null as RecordsFile | null,
  byKey: new Map<string, RecordPerson>(),
};

export function setRecords(file: RecordsFile) {
  records.file = file;
  records.byKey = new Map(file.people.map((p) => [recordKey(p.level, p.county, p.name), p]));
}

/** District is checked when known (council rows), so a namesake in another district never matches. */
export function recordsOf(level: RecordLevel, county: string, name: string, district?: number) {
  const person = records.byKey.get(recordKey(level, county, name));
  if (!person || (level === "council" && district && person.district !== district)) return null;
  return person;
}

export const guiltyCount = (person: RecordPerson) => person.records.filter((r) => r.type === "guilty").length;
