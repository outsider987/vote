import { app, county, scrollMobileTo, select, setMode } from "../app";
import { districtLabel, partyLabel, partyOf } from "../config";
import { $ } from "../dom";
import { closeDuels } from "../model/analysis";
import type { District } from "../model/types";
import { countyView } from "../scene/island";
import { camera, host, sceneOk } from "../scene/stage";
import { fmt } from "../util";

/* 拉鋸戰: up to three live close races beside the map, each with a tug-of-war gauge. */

type Pick = ReturnType<typeof closeDuels>[number];
interface Duel extends Pick {
  el: HTMLLIElement;
  colors: [string, string];
  stage: string;
  vA: HTMLElement; vB: HTMLElement; nA: HTMLElement; nB: HTMLElement;
  gap: HTMLElement; prog: HTMLElement; tag: HTMLElement;
  bornAt: number; lastSign: number; flipUntil: number; finalAt: number; leaving: boolean;
}

const crList = $("cr-list");
let duels: Duel[] = [];
let lastPick = -Infinity;
let mobilePick: Pick | null = null;
const announced = new Set<string>();
let flashCode: string | null = null;
let flashTop = "";
let flashUntil = 0;
let flashTimer = 0;

export function openDuelAlert() {
  if (mobilePick) {
    setMode(mobilePick.kind);
    select(mobilePick.code, { byUser: true, noCamera: true, district: mobilePick.district });
  } else setMode("close");
  scrollMobileTo("board");
}

function showDuelFlash(pick: Pick, now: number) {
  if (!app.source.started) return;
  const a = pick.race.candidates[pick.a], b = pick.race.candidates[pick.b];
  const place = pick.district === null ? `${county(pick.code).name}・${county(pick.code).raceLabel.replace("選舉", "")}` : `${county(pick.code).name}・議員 ${districtLabel(pick.race as District)}`;
  $("duel-flash-place").textContent = place;
  $("duel-flash-a-name").textContent = a.name;
  $("duel-flash-b-name").textContent = b.name;
  $("duel-flash-a").style.setProperty("--c", partyOf(a.party).color);
  $("duel-flash-b").style.setProperty("--c", partyOf(b.party).color);
  $("duel-flash-gap").textContent = `差 ${fmt(Math.abs(pick.race.state.votes[pick.a] - pick.race.state.votes[pick.b]))} 票・${(pick.m * 100).toFixed(2)}%`;
  const flash = $("duel-flash");
  $("duel-flash-pointer").setAttribute("hidden", "");
  $("duel-flash-panel").style.top = "";
  flashTop = "";
  flash.hidden = false;
  flash.classList.remove("is-on");
  void flash.offsetWidth;
  flash.classList.add("is-on");
  flashCode = pick.code;
  flashUntil = now + 4500;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { flash.hidden = true; flashCode = null; }, 4500);
}

/** Keep the temporary pointer on the county while the camera moves. */
export function updateDuelFlashPosition() {
  const flash = $("duel-flash"), pointer = $("duel-flash-pointer");
  if (flash.hidden || !flashCode || !sceneOk || window.innerWidth <= 900 || (app.view === "county" && app.detail?.code !== flashCode)) { pointer.setAttribute("hidden", ""); return; }
  const view = countyView(flashCode);
  const p = view.anchor.clone().setY(view.height + view.lift + 0.1).project(camera);
  const x = (p.x + 1) * host.clientWidth / 2, y = (1 - p.y) * host.clientHeight / 2;
  if (x < 0 || x > flash.clientWidth || y < 0 || y > flash.clientHeight) { pointer.setAttribute("hidden", ""); return; }
  pointer.removeAttribute("hidden");
  const panelEl = $("duel-flash-panel");
  if (!flashTop) flashTop = y < flash.clientHeight / 2 ? "58%" : "12%";
  if (panelEl.style.top !== flashTop) panelEl.style.top = flashTop;
  const panel = panelEl.getBoundingClientRect(), bounds = flash.getBoundingClientRect();
  const fromX = x < panel.left - bounds.left ? panel.left - bounds.left : panel.right - bounds.left;
  const fromY = panel.top - bounds.top + panel.height / 2;
  const bend = x < fromX ? Math.min(fromX, x) - 70 : Math.max(fromX, x) + 70;
  const line = document.querySelector<SVGPathElement>("#duel-flash-line")!;
  const target = document.querySelector<SVGGElement>("#duel-flash-target")!;
  line.setAttribute("d", `M ${fromX} ${fromY} C ${bend} ${fromY}, ${bend} ${y}, ${x} ${y}`);
  target.setAttribute("transform", `translate(${x} ${y})`);
}

function createDuel(pick: Pick, now: number): Duel {
  const { race, a, b } = pick;
  const A = race.candidates[a], B = race.candidates[b];
  const pa = partyOf(A.party), pb = partyOf(B.party);
  const c = county(pick.code);
  const place = pick.district === null ? `${c.name}・${c.raceLabel.replace("選舉", "")}` : `${c.name}・議員 ${districtLabel(race as District)}`;
  const side = (cand: typeof A, color: string, cls: string) => `<span class="cr-side ${cls}"><span class="cr-name">${cand.name}</span>`
    + `<span class="cr-party"><i class="chip" style="--c:${color}"></i>${partyLabel(cand.party)}</span><span class="cr-v num">0</span></span>`;
  const li = document.createElement("li");
  li.className = "cr-card";
  li.style.setProperty("--ca", pa.color);
  li.style.setProperty("--cb", pb.color);
  li.innerHTML = `<button type="button" class="cr-btn" aria-label="${place}：${A.name} 對 ${B.name}">
      <span class="cr-top"><span class="cr-place">${place}</span><span class="cr-tag"></span></span>
      <span class="cr-names">${side(A, pa.color, "a")}${side(B, pb.color, "b")}</span>
      <span class="cr-gauge" aria-hidden="true"><i class="cr-track"></i><i class="cr-fill"></i><i class="cr-zero"></i><i class="cr-knot"></i></span>
      <span class="cr-foot"><span class="cr-gap num"></span><span class="cr-prog"></span></span>
    </button>`;
  li.querySelector("button")!.addEventListener("click", () => { setMode(pick.kind); select(pick.code, { byUser: true, district: pick.district }); });
  crList.appendChild(li);
  const q = (sel: string) => li.querySelector<HTMLElement>(sel)!;
  return {
    ...pick, el: li, colors: [pa.color, pb.color], stage: pick.district === null ? "" : "最後一席・",
    vA: q(".cr-side.a .cr-v"), vB: q(".cr-side.b .cr-v"), nA: q(".cr-side.a .cr-name"), nB: q(".cr-side.b .cr-name"),
    gap: q(".cr-gap"), prog: q(".cr-prog"), tag: q(".cr-tag"),
    bornAt: now, lastSign: 0, flipUntil: 0, finalAt: 0, leaving: false,
  };
}

function retireDuel(d: Duel) {
  if (d.leaving) return;
  d.leaving = true;
  d.el.classList.add("is-leaving");
  setTimeout(() => { d.el.remove(); duels = duels.filter((x) => x !== d); }, 420);
}

export function refreshDuels(now: number) {
  if (now - lastPick < 1500) return;
  lastPick = now;
  const picks = closeDuels(app.counties);
  const nearest = picks[0];
  if ($("loading").classList.contains("is-done") && !$("callout").classList.contains("is-on") && now >= flashUntil) {
    const fresh = picks.find((pick) => !announced.has(pick.key));
    if (fresh) {
      picks.forEach((pick) => announced.add(pick.key));
      showDuelFlash(fresh, now);
    }
  }
  mobilePick = nearest ?? null;
  const alert = $("mobile-duel");
  alert.hidden = false;
  $("mobile-duel-title").textContent = nearest ? "拉鋸戰" : "選情監看";
  $("mobile-duel-text").textContent = nearest
    ? `${county(nearest.code).name}${nearest.district === null ? "・縣市長" : `・議員 ${districtLabel(nearest.race as District)}`}：${nearest.race.candidates[nearest.a].name}／${nearest.race.candidates[nearest.b].name}，差 ${fmt(Math.abs(nearest.race.state.votes[nearest.a] - nearest.race.state.votes[nearest.b]))} 票`
    : app.source.started ? "目前沒有達警報門檻的戰局" : "開票後開始監看";
  $("mobile-duel-action").textContent = nearest ? "查看這場選舉" : "查看拉鋸戰排行";
  if (window.innerWidth <= 900) {
    duels.forEach((d) => d.el.remove());
    duels = [];
    return;
  }
  const keys = new Set(picks.map((pk) => pk.key));
  for (const d of duels) {
    if (!d.leaving && !d.finalAt && !keys.has(d.key) && now - d.bornAt > 3500) retireDuel(d);
  }
  for (const pk of picks) {
    const active = duels.filter((d) => !d.leaving);
    if (active.length >= 3) break;
    if (!active.some((d) => d.key === pk.key)) duels.push(createDuel(pk, now));
  }
  const any = duels.some((d) => !d.leaving);
  $("cr-empty").textContent = any ? "" : (!app.source.started ? "開票開始後，差距最小的戰局會出現在這裡。" : "目前沒有達到警報門檻的拉鋸戰局。");
}

export function updateDuels(now: number) {
  for (const d of duels) {
    if (d.leaving) continue;
    const s = d.race.state;
    const va = s.votes[d.a], vb = s.votes[d.b];
    const m = (va - vb) / Math.max(1, s.counted);
    const pos = Math.max(-1, Math.min(1, m / d.cfg.scale));
    const x = 50 - pos * 50;                  // the knot moves toward whoever leads (A left, B right)
    d.el.style.setProperty("--x", `${x.toFixed(2)}%`);
    d.el.style.setProperty("--fl", `${Math.min(x, 50).toFixed(2)}%`);
    d.el.style.setProperty("--fr", `${(100 - Math.max(x, 50)).toFixed(2)}%`);
    d.el.style.setProperty("--fc", va >= vb ? d.colors[0] : d.colors[1]);
    d.vA.textContent = fmt(va);
    d.vB.textContent = fmt(vb);
    d.nA.classList.toggle("is-ahead", va > vb);
    d.nB.classList.toggle("is-ahead", vb > va);
    d.gap.textContent = `差 ${fmt(Math.abs(va - vb))} 票`;
    d.prog.textContent = s.decided ? `${d.stage}開票完成` : `${d.stage}開票 ${(s.p * 100).toFixed(0)}%`;
    const sign = Math.sign(va - vb);
    if (sign && d.lastSign && sign !== d.lastSign && !d.finalAt) {
      d.tag.textContent = d.cfg.flip;
      d.el.classList.remove("is-flip");
      void d.el.offsetWidth;
      d.el.classList.add("is-flip");
      d.flipUntil = now + 1500;
    }
    if (sign) d.lastSign = sign;
    if (d.flipUntil && now > d.flipUntil) { d.el.classList.remove("is-flip"); d.flipUntil = 0; if (!d.finalAt) d.tag.textContent = ""; }
    if (s.decided && !d.finalAt) {
      d.finalAt = now;
      d.tag.textContent = "確定";
      d.el.classList.remove("is-flip");
      d.el.classList.add("is-final");
    }
    if (d.finalAt && now - d.finalAt > 2600) retireDuel(d);
  }
}
