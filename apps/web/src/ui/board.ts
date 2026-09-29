import { app, county, select } from "../app";
import { districtLabel, districtShort, partyLabel, partyOf, partySeatTotals } from "../config";
import { $, reducedMotion, SVGNS } from "../dom";
import { councilTurnout } from "../model/analysis";
import { ReplaySource } from "../model/replay";
import type { Race } from "../model/types";
import { fmt, mulberry32 } from "../util";
import { renderCloseList } from "./closest";
import { hideFloat, showFloat } from "./tips";

/* 計票板: the selected race as rows of hand-drawn 正 tallies, ranked by the live count. */

interface Row {
  li: HTMLLIElement;
  j: number;
  votes: HTMLElement;
  pct: HTMLElement;
  svg: SVGSVGElement;
  strokes: number;
  /** Stroke cap: the final count in the replay, none when live. */
  max: number;
  cells: number;
  minCells: number;
}
interface SeatGroup { el: HTMLElement; dots: HTMLElement[]; decided: boolean | null }

const board = {
  race: null as Race | null,
  seed: 0,
  unit: 0,
  rows: [] as Row[],
  groups: [] as SeatGroup[],
  tabs: [] as HTMLElement[],
  order: [] as number[],
  lastReorder: 0,
  lastRows: null as string | null,
  lastStats: null as string | null,
  lastParties: null as string | null,
};

// Five strokes of 正, in writing order, on a 22×24 cell.
const STROKES = [[3, 4, 19, 4], [11, 4, 11, 19], [11, 11.5, 17, 11.5], [5.5, 11, 5.5, 19], [2, 19, 20, 19]];

function strokePath(seed: number, j: number, k: number) {
  const r = mulberry32(seed * 7919 + j * 131 + k * 17 + 3);
  const [x1, y1, x2, y2] = STROKES[k % 5];
  const ox = Math.floor(k / 5) * 26;
  const jx = () => (r() - 0.5) * 1.3;
  const ax = x1 + ox + jx(), ay = y1 + jx(), bx = x2 + ox + jx(), by = y2 + jx();
  const mx = (ax + bx) / 2 + (r() - 0.5) * 1.4, my = (ay + by) / 2 + (r() - 0.5) * 1.4;
  return `M${ax.toFixed(1)} ${ay.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

function sizeTally(svg: SVGSVGElement, cells: number) {
  svg.setAttribute("viewBox", `0 0 ${cells * 26} 24`);
  svg.setAttribute("width", String(cells * 26));
}

function renderRows(race: Race, seed: number) {
  board.race = race;
  board.seed = seed;
  board.unit = race.unit;
  board.lastReorder = 0;
  board.lastRows = null;
  $("unit").innerHTML = `每一劃＝<b class="num">${fmt(race.unit)}</b> 票`;
  if (!race.candidates.length) {
    $("rows").innerHTML = `<li class="rows-empty">${app.source.started ? "尚未取得這場選舉的候選人資料" : "候選人名單公布後會顯示在這裡（號次 10 月 23 日抽籤）"}</li>`;
    board.rows = [];
    board.order = [];
    return;
  }
  const finalCells = (j: number) => (race.finalVotes ? Math.max(1, Math.ceil(Math.floor(race.finalVotes[j] / race.unit) / 5)) : 1);
  $("rows").innerHTML = race.candidates.map((x, j) => {
    const p = partyOf(x.party);
    const cells = finalCells(j);
    const photo = x.photo ? `<div class="photo"><img src="${x.photo}" alt="" loading="lazy" decoding="async"></div>` : "";
    const bio = x.birth ? `<span class="bio">${[x.gender === "M" ? "男" : x.gender === "F" ? "女" : "", `${x.birth.replaceAll("-", ".")} 生`, x.birthplace ? `出生地 ${x.birthplace}` : "", x.incumbent ? `時任${race.kind === "district" ? "議員" : "縣市長"}` : ""].filter(Boolean).join("・")}</span>` : "";
    const platform = x.platformUrl ? `<button class="platform-link" type="button" data-platform="${j}" aria-label="在本站查看${x.name}的政見">政見</button>` : "";
    return `<li class="row${x.photo ? " has-photo" : ""}" data-j="${j}" style="--c:${p.color}">
      ${photo}
      <div class="who"><span class="no" aria-label="${x.no} 號">${x.no}</span><span class="name">${x.name}</span>
        <span class="party"><i class="chip" style="--c:${p.color}"></i>${partyLabel(x.party)}</span><span class="won">當選</span><span class="quota">婦女保障</span><svg class="row-stamp" aria-hidden="true"><use href="#stamp"/></svg>${platform}${bio}</div>
      <div class="nums"><span class="votes num">0</span><span class="pct num">0.00%</span></div>
      <svg class="tally" viewBox="0 0 ${cells * 26} 24" width="${cells * 26}" height="24" aria-hidden="true"></svg>
    </li>`;
  }).join("");
  board.rows = [...$("rows").children].map((el): Row => {
    const li = el as HTMLLIElement;
    const j = Number(li.dataset.j);
    const cells = finalCells(j);
    return {
      li, j,
      votes: li.querySelector<HTMLElement>(".votes")!,
      pct: li.querySelector<HTMLElement>(".pct")!,
      svg: li.querySelector<SVGSVGElement>(".tally")!,
      strokes: 0,
      max: race.finalVotes ? Math.floor(race.finalVotes[j] / race.unit) : Infinity,
      cells,
      minCells: cells,
    };
  });
  board.order = orderOf(race, race.state.votes);
  placeRows(board.order, false);
}

export function initPlatformViewer() {
  const dialog = $<HTMLDialogElement>("platform-view");
  const frame = $<HTMLIFrameElement>("platform-frame");
  const original = $<HTMLAnchorElement>("platform-original");
  const loading = $("platform-loading");
  let trigger: HTMLButtonElement | null = null;
  let resume: ReplaySource | null = null;
  let loadTimer = 0;

  $("rows").addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-platform]");
    if (!button || !board.race) return;
    const candidate = board.race.candidates[Number(button.dataset.platform)];
    if (!candidate?.platformUrl) return;
    trigger = button;
    const race = board.race;
    const page = candidate.platformUrl.match(/#page=(\d+)/)?.[1];
    $("platform-title").textContent = `${candidate.name}的政見`;
    const person = $("platform-person");
    person.textContent = `${county(app.selected).name}${race.kind === "district" ? ` ${race.name}` : ""}・${candidate.no} 號・${partyLabel(candidate.party)}`;
    person.style.setProperty("--c", partyOf(candidate.party).color);
    $("platform-note").textContent = page
      ? `已定位至公報第 ${page} 頁；同頁可能還有其他候選人。可放大閱讀，預覽不便時開啟官方原檔。`
      : "這份公報尚無候選人頁碼，請依姓名與號次查找；可放大閱讀，預覽不便時開啟官方原檔。";
    original.href = candidate.platformUrl;
    clearTimeout(loadTimer);
    loading.hidden = false;
    dialog.showModal();
    document.body.classList.add("platform-open");
    app.pendingFollow = null;
    frame.title = `${candidate.name}的中選會選舉公報`;
    frame.src = candidate.platformUrl;
    if (app.source instanceof ReplaySource && app.source.playing) {
      resume = app.source;
      resume.playing = false;
    }
    $("platform-close").focus();
  });
  frame.addEventListener("load", () => {
    if (dialog.open && frame.hasAttribute("src")) loadTimer = window.setTimeout(() => { loading.hidden = true; }, 1800);
  });
  $("platform-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    clearTimeout(loadTimer);
    frame.removeAttribute("src");
    document.body.classList.remove("platform-open");
    if (resume) { resume.playing = true; resume = null; }
    if (trigger?.isConnected) trigger.focus();
    trigger = null;
  });
}

/** Rows follow the current vote ranking (ties keep ballot order). */
function orderOf(race: Race, votes: readonly number[]) {
  return race.candidates.map((_, j) => j).sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0) || race.candidates[a].no - race.candidates[b].no);
}

/** Reorder rows; moves animate with FLIP. */
function placeRows(order: number[], animate: boolean) {
  const list = $("rows");
  const byJ = new Map(board.rows.map((r) => [r.j, r]));
  const before = animate ? new Map(board.rows.map((r) => [r.j, r.li.getBoundingClientRect().top])) : null;
  for (const j of order) list.appendChild(byJ.get(j)!.li);
  if (!before) return;
  for (const row of board.rows) {
    const dy = before.get(row.j)! - row.li.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    row.li.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" });
  }
}

function updateRows(initial: boolean) {
  const race = board.race;
  if (!race || !board.rows.length) return;
  const s = race.state;
  const key = `${s.p}|${s.counted}|${s.decided}`;
  if (key === board.lastRows) return;
  board.lastRows = key;
  const winners = new Set(s.decided ? s.winners : []);
  const inSeat = new Set(s.decided ? [] : s.top);
  for (const row of board.rows) {
    const v = s.votes[row.j] ?? 0;
    const cand = race.candidates[row.j];
    row.votes.textContent = fmt(v);
    row.pct.textContent = `${s.counted ? ((v / s.counted) * 100).toFixed(2) : "0.00"}%`;
    row.li.classList.toggle(race.seats > 1 ? "in-seat" : "is-leading", inSeat.has(row.j));
    row.li.classList.toggle("is-won", winners.has(row.j));
    row.li.classList.toggle("is-quota", winners.has(row.j) && !!cand.womenQuota);
    const want = Math.min(row.max, Math.floor(v / race.unit));
    const cells = Math.max(row.minCells, Math.ceil(want / 5));
    if (cells !== row.cells) { row.cells = cells; sizeTally(row.svg, cells); }
    while (row.strokes < want) {
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", strokePath(board.seed, row.j, row.strokes));
      path.setAttribute("pathLength", "20");
      if (!initial && !reducedMotion) path.classList.add("draw");
      row.svg.appendChild(path);
      row.strokes++;
    }
    while (row.strokes > want) {
      row.svg.lastChild!.remove();
      row.strokes--;
    }
  }
  const now = performance.now();
  if (initial || now - board.lastReorder > 350) {
    const order = orderOf(race, s.votes);
    if (order.join() !== board.order.join()) {
      placeRows(order, !initial && !reducedMotion);
      board.order = order;
      board.lastReorder = now;
    }
  }
}

export function renderBoard() {
  const c = county(app.selected);
  const idx = app.counties.indexOf(c);
  $<HTMLSelectElement>("county-select").value = app.mode === "close" ? app.closeScope ?? "" : c.code;
  $("board").classList.remove("has-turnout");
  $("board-county").textContent = c.name;
  $("st-progress-label").textContent = "開票進度";
  $("st-turnout-label").textContent = "投票率";
  if (app.mode === "close") {
    $("board-county").textContent = app.closeScope ? c.name : "拉鋸戰";
    $("board-race").textContent = app.closeScope ? "拉鋸戰" : "即時排名";
    $("st-progress-label").textContent = "縣市長 <5%";
    $("st-mid-label").textContent = "議員末席 <1%";
    $("st-turnout-label").textContent = "鄉鎮 <5%";
    renderCloseList(true);
    return;
  }
  if (app.mode === "mayor") {
    $("board-race").textContent = c.raceLabel;
    $("st-mid-label").textContent = "已開出票數";
    renderRows(c.mayor, idx);
  } else {
    const cn = c.council;
    $("board-race").textContent = `${cn.kind}選舉`;
    $("st-mid-label").textContent = "已確定席次";
    $("county-parties").hidden = !cn.districts.length;
    if (!cn.districts.length) {
      $("council-seats").innerHTML = "";
      $("district-tabs").innerHTML = "";
      $("district-head").textContent = app.source.started ? "尚未取得議員選區資料" : "議員選區與候選人名單公布後會顯示在這裡";
      board.groups = [];
      board.tabs = [];
      $("unit").textContent = "";
      $("rows").innerHTML = "";
      board.race = null;
      board.rows = [];
      board.lastStats = null;
      return;
    }
    app.selectedDistrict = Math.min(app.selectedDistrict, cn.districts.length - 1);
    const sel = app.selectedDistrict;
    const d = cn.districts[sel];
    $("council-seats").innerHTML = cn.districts.map((dd, k) => `
      <button type="button" class="seat-group${k === sel ? " is-active" : ""}" data-k="${k}" aria-label="${districtLabel(dd)}，應選 ${dd.seats} 席">
        <span class="gl">${districtShort(dd)}</span>
        <span class="dots">${Array.from({ length: dd.seats }, () => '<i class="seat-dot"></i>').join("")}</span>
      </button>`).join("");
    board.groups = [...$("council-seats").children].map((node, k): SeatGroup => {
      const el = node as HTMLElement;
      el.addEventListener("click", () => select(c.code, { byUser: true, district: k }));
      el.addEventListener("pointerenter", () => {
        const dd = cn.districts[k], s = dd.state;
        showFloat(el, `<b>${districtLabel(dd)}</b>　應選 ${dd.seats} 席<br>${s.decided ? "當選確定" : `開票 ${(s.p * 100).toFixed(1)}%`}`);
      });
      el.addEventListener("pointerleave", hideFloat);
      return { el, dots: [...el.querySelectorAll<HTMLElement>(".seat-dot")], decided: null };
    });
    $("district-tabs").innerHTML = cn.districts.map((dd, k) =>
      `<button type="button" role="tab" class="district-tab" aria-selected="${k === sel}" data-k="${k}">${districtLabel(dd)}・${dd.seats} 席</button>`).join("");
    board.tabs = [...$("district-tabs").children] as HTMLElement[];
    board.tabs.forEach((el, k) => el.addEventListener("click", () => select(c.code, { byUser: true, district: k })));
    const active = board.tabs[sel];
    const strip = $("district-tabs");
    strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2;
    const towns = d.towns.map((t) => t.name);
    const townText = towns.length > 5 ? `${towns.slice(0, 5).join("、")}等 ${towns.length} 區` : towns.join("、");
    const women = d.womenSeats ? `（婦女保障 ${d.womenSeats} 席）` : "";
    $("district-head").innerHTML = `<b>${d.name}</b>${townText ? `（${townText}）` : ""}・應選 <b>${d.seats}</b> 席${women}`;
    renderRows(d, idx * 100 + sel);
  }
  board.lastStats = null;
  board.lastParties = null;
  updateBoard(true);
}

/** Before 16:00 nothing is being counted yet. */
export const pendingLabel = () => (app.source.started ? "開票中" : "尚未開票");

export function updateBoard(initial = false) {
  const c = county(app.selected);
  if (app.mode === "close") { renderCloseList(false); return; }
  // live mode may raise the tally unit mid-count, or deliver a roster late; redraw the rows
  const r = board.race;
  if (r && (r.unit !== board.unit || (r.candidates.length > 0 && !board.rows.length))) { renderRows(r, board.seed); initial = true; }
  if (app.mode === "mayor") {
    const r = c.mayor, s = r.state;
    $("board").classList.toggle("has-turnout", s.decided && r.turnout !== null);
    const key = `${s.p}|${s.counted}|${s.decided}|${app.source.started}`;
    if (key !== board.lastStats) {
      board.lastStats = key;
      $("st-progress").textContent = `${(s.p * 100).toFixed(1)}%`;
      $("st-counted").textContent = fmt(s.counted);
      $("st-turnout").textContent = !s.decided ? pendingLabel() : r.turnout !== null ? `${r.turnout.toFixed(2)}%` : "待公布";
    }
  } else {
    const cn = c.council, s = cn.state;
    $("board").classList.toggle("has-turnout", s.complete && councilTurnout(cn) !== null);
    const key = `${s.p}|${s.decidedSeats}|${app.source.started}`;
    if (key !== board.lastStats) {
      board.lastStats = key;
      $("st-progress").textContent = `${(s.p * 100).toFixed(1)}%`;
      $("st-counted").textContent = `${s.decidedSeats}／${cn.seats}`;
      const ft = s.complete ? councilTurnout(cn) : null;
      $("st-turnout").textContent = !s.complete ? pendingLabel() : ft !== null ? `${ft.toFixed(2)}%` : "待公布";
    }
    const partyKey = `${c.code}|${s.decidedSeats}|${JSON.stringify(s.decided)}|${app.source.started}`;
    if (partyKey !== board.lastParties) {
      board.lastParties = partyKey;
      $("county-parties-title").textContent = s.complete ? "各黨席次" : "各黨已確定席次";
      const totals = partySeatTotals(s.decided, true).map(({ name, color, seats }) => ({ name, color, seats }));
      if (s.decidedSeats < cn.seats) totals.push({ name: app.source.started ? "尚待確定" : "尚未開票", color: "", seats: cn.seats - s.decidedSeats });
      $("county-party-totals").replaceChildren(...totals.map(({ name, color, seats }) => {
        const li = document.createElement("li");
        const chip = document.createElement("i");
        chip.className = color ? "chip" : "chip pending";
        if (color) chip.style.setProperty("--c", color);
        const count = document.createElement("b");
        count.textContent = String(seats);
        li.append(chip, document.createTextNode(name), count);
        return li;
      }));
    }
    cn.districts.forEach((d, k) => {
      const g = board.groups[k];
      if (!g || g.decided === d.state.decided) return;
      g.decided = d.state.decided;
      board.tabs[k].classList.toggle("is-done", g.decided);
      const ds = d.state;
      const ordered = g.decided ? [...ds.winners].sort((a, b) => ds.votes[b] - ds.votes[a]) : [];
      g.dots.forEach((dot, i) => {
        const j = ordered[i];
        dot.classList.toggle("is-filled", j !== undefined);
        dot.classList.toggle("is-quota", j !== undefined && !!d.candidates[j].womenQuota);
        dot.style.setProperty("--c", j !== undefined ? partyOf(d.candidates[j].party).color : "transparent");
      });
    });
  }
  updateRows(initial);
}
