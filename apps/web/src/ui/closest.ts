import { app, county, scrollMobileTo, select, setMobileMapOpen, setMode } from "../app";
import { districtLabel, partyOf } from "../config";
import { $, reducedMotion } from "../dom";
import { duelOf } from "../model/analysis";
import type { Race, RaceState } from "../model/types";
import { enterCounty, loadTownAssets, townRacesFor } from "../scene/detail";
import { townItem } from "../scene/interaction";
import { fmt } from "../util";

/* 最接近: every race ranked by its current margin — mayors, councilors' last seat, and towns. */

type Tab = "mayor" | "council" | "town";

interface Entry {
  key: string;
  code: string;
  district?: number;
  town?: string;
  place: string;
  sub: string;
  race: Race;
  s: RaceState;
  a: number;
  b: number;
  gap: number;
  margin: number;
}
interface CloseRow { li: HTMLLIElement; a: number; b: number; rank: HTMLElement; gap: HTMLElement; pct: HTMLElement; nA: HTMLElement; nB: HTMLElement; status: HTMLElement }

let closeTab: Tab = "mayor";
let closeRows = new Map<string, CloseRow>();
let closeOrder: string[] = [];
let lastCalc = 0;
/** Every town's mayor race, once the town data has loaded. */
let townBoard: { code: string; county: string; race: Race; name: string }[] | null = null;

export function ensureTownBoard() {
  if (townBoard) return;
  loadTownAssets().then((assets) => {
    if (townBoard) return;
    townBoard = app.counties.flatMap((c) => townRacesFor(c.code, assets.towns[c.code] ?? [])
      .map((race) => ({ code: race.key, county: c.code, race, name: `${c.name} ${race.name}` })));
    if (app.mode === "close") renderCloseList(true);
  });
}

export function initClosest() {
  document.querySelectorAll<HTMLButtonElement>(".close-tabs .district-tab").forEach((b) => b.addEventListener("click", () => {
    closeTab = b.dataset.tab as Tab;
    document.querySelectorAll(".close-tabs .district-tab").forEach((o) => o.setAttribute("aria-selected", String(o === b)));
    ensureTownBoard();
    renderCloseList(true);
  }));
}

function closeEntries(tab: Tab): Entry[] {
  const out: Entry[] = [];
  const scope = app.closeScope;
  const counties = scope ? [county(scope)] : app.counties;
  if (tab === "mayor") {
    for (const c of counties) {
      const du = duelOf(c.mayor);
      if (du) out.push({ key: `m:${c.code}`, code: c.code, place: c.name, sub: c.raceLabel.replace("選舉", ""), race: c.mayor, s: c.mayor.state, ...du });
    }
  } else if (tab === "council") {
    for (const c of counties) c.council.districts.forEach((d, k) => {
      const du = duelOf(d);
      if (du) out.push({ key: `c:${d.id}`, code: c.code, district: k, place: `${c.name} ${districtLabel(d)}`, sub: `最後一席・應選 ${d.seats}`, race: d, s: d.state, ...du });
    });
  } else if (townBoard) {
    for (const t of townBoard) {
      if (scope && t.county !== scope) continue;
      app.source.refresh(t.race);
      const du = duelOf(t.race);
      if (du) out.push({ key: `t:${t.code}`, code: t.county, town: t.code, place: t.name, sub: county(t.county).raceLabel.replace("選舉", ""), race: t.race, s: t.race.state, ...du });
    }
  }
  return out.sort((x, y) => x.margin - y.margin);
}

function closeCounts() {
  const n = (tab: Tab, lim: number) => closeEntries(tab).filter((e) => e.margin < lim).length;
  $("st-progress").textContent = `${n("mayor", 0.05)} 場`;
  $("st-counted").textContent = `${n("council", 0.01)} 區`;
  $("st-turnout").textContent = townBoard ? `${n("town", 0.05)} 區` : "—";
}

export function renderCloseList(force: boolean) {
  const now = performance.now();
  if (!force && now - lastCalc < 500) return;
  lastCalc = now;
  const list = $("close-list");
  if (force) { list.innerHTML = ""; closeRows = new Map(); closeOrder = []; }
  const entries = closeEntries(closeTab).slice(0, 15);
  $("close-note").textContent = closeTab === "town" && !townBoard ? "正在載入鄉鎮資料…"
    : entries.length ? "依差距百分比排序，點選可查看該地區" : "開票開始後，差距最小的地方會列在這裡";
  const keys = new Set(entries.map((e) => e.key));
  for (const [key, row] of closeRows) if (!keys.has(key)) { row.li.remove(); closeRows.delete(key); }
  for (const e of entries) {
    let row = closeRows.get(e.key);
    const samePair = row && ((row.a === e.a && row.b === e.b) || (row.a === e.b && row.b === e.a));
    if (row && !samePair) { row.li.remove(); closeRows.delete(e.key); row = undefined; }
    if (!row) row = createCloseRow(e);
    const A = e.race.candidates[row.a], B = e.race.candidates[row.b];
    const va = e.s.votes[row.a], vb = e.s.votes[row.b];
    const m = (va - vb) / e.s.counted;
    const x = 50 - Math.max(-1, Math.min(1, m / 0.05)) * 50;
    row.li.style.setProperty("--x", `${x.toFixed(2)}%`);
    row.li.style.setProperty("--fl", `${Math.min(x, 50).toFixed(2)}%`);
    row.li.style.setProperty("--fr", `${(100 - Math.max(x, 50)).toFixed(2)}%`);
    row.li.style.setProperty("--fc", va >= vb ? partyOf(A.party).color : partyOf(B.party).color);
    row.nA.classList.toggle("is-ahead", va > vb);
    row.nB.classList.toggle("is-ahead", vb > va);
    row.gap.textContent = `${(Math.abs(m) * 100).toFixed(2)}%`;
    row.pct.textContent = `差 ${fmt(Math.abs(va - vb))} 票`;
    row.status.textContent = e.s.decided ? "確定" : `開票 ${(e.s.p * 100).toFixed(0)}%`;
    row.status.classList.toggle("is-final", e.s.decided);
  }
  const order = entries.map((e) => e.key);
  if (order.join() !== closeOrder.join()) {
    const before = new Map([...closeRows].filter(([, r]) => r.li.isConnected).map(([k, r]) => [k, r.li.getBoundingClientRect().top]));
    order.forEach((k, i) => { const r = closeRows.get(k)!; r.rank.textContent = String(i + 1); list.appendChild(r.li); });
    if (!force && !reducedMotion) for (const [k, r] of closeRows) {
      if (!before.has(k)) continue;
      const dy = before.get(k)! - r.li.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) r.li.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" });
    }
    closeOrder = order;
  }
  closeCounts();
}

function createCloseRow(e: Entry): CloseRow {
  const A = e.race.candidates[e.a], B = e.race.candidates[e.b];
  const pa = partyOf(A.party), pb = partyOf(B.party);
  const li = document.createElement("li");
  li.style.setProperty("--ca", pa.color);
  li.style.setProperty("--cb", pb.color);
  li.innerHTML = `<button type="button" class="cl-row" style="--ca:${pa.color};--cb:${pb.color}">
      <span class="cl-rank"></span>
      <span class="cl-place">${e.place}<small>${e.sub}</small><small class="cl-status"></small></span>
      <span class="cl-gap"><b class="cl-v"></b><span class="cl-pct num"></span></span>
      <span class="cl-duel">
        <span class="cl-name a"><i class="chip" style="--c:${pa.color}"></i>${A.name}</span>
        <span class="cl-gauge" aria-hidden="true"><i class="cr-track"></i><i class="cr-fill"></i><i class="cr-zero"></i><i class="cr-knot"></i></span>
        <span class="cl-name b">${B.name}<i class="chip" style="--c:${pb.color}"></i></span>
      </span>
    </button>`;
  li.querySelector("button")!.addEventListener("click", () => openCloseEntry(e));
  const q = (sel: string) => li.querySelector<HTMLElement>(sel)!;
  const row: CloseRow = { li, a: e.a, b: e.b, rank: q(".cl-rank"), gap: q(".cl-v"), pct: q(".cl-pct"), nA: q(".cl-name.a"), nB: q(".cl-name.b"), status: q(".cl-status") };
  closeRows.set(e.key, row);
  return row;
}

function openCloseEntry(e: Entry) {
  if (window.innerWidth <= 900) {
    if (e.town) {
      setMode("mayor");
      setMobileMapOpen(true);
      enterCounty(e.code).then(() => {
        const tape = townItem(e.town!)?.tape;
        if (tape) { tape.classList.remove("is-flash"); void tape.offsetWidth; tape.classList.add("is-flash"); }
        scrollMobileTo("scene");
      });
    } else {
      if (document.querySelector(".room")!.classList.contains("map-open")) setMobileMapOpen(false);
      setMode(e.district === undefined ? "mayor" : "council");
      select(e.code, { byUser: true, noCamera: true, district: e.district ?? null });
      scrollMobileTo("board");
    }
    return;
  }
  if (e.district !== undefined) {
    setMode("council");
    enterCounty(e.code).then(() => select(e.code, { byUser: true, noCamera: true, district: e.district! }));
  } else {
    setMode("mayor");
    enterCounty(e.code).then(() => {
      const tape = e.town ? townItem(e.town)?.tape : undefined;
      if (tape) { tape.classList.remove("is-flash"); void tape.offsetWidth; tape.classList.add("is-flash"); }
    });
  }
}
