import { app, county, select } from "../app";
import { CLOSE, districtLabel, partyLabel, partyOf } from "../config";
import { $ } from "../dom";
import type { District, Race } from "../model/types";
import { fmt, rankOrder } from "../util";

/* 拉鋸戰: up to three live close races beside the map, each with a tug-of-war gauge. */

type Cfg = (typeof CLOSE)[keyof typeof CLOSE];

interface Pick { key: string; code: string; district: number | null; race: Race; a: number; b: number; m: number }
interface Duel extends Pick {
  cfg: Cfg;
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

/** The 拉鋸戰 mode uses the mayor settings. */
export const duelCfg = (): Cfg => CLOSE[app.mode === "council" ? "council" : "mayor"];

function pickDuels() {
  const cfg = duelCfg(), out: Pick[] = [];
  const consider = (race: Race, code: string, district: number | null, key: string) => {
    const s = race.state;
    if (s.p < 0.12 || s.decided || race.candidates.length <= race.seats) return;
    const order = rankOrder(s.votes);
    const a = order[race.seats - 1], b = order[race.seats];
    const m = (s.votes[a] - s.votes[b]) / Math.max(1, s.counted);
    if (m < cfg.threshold) out.push({ key, code, district, race, a, b, m });
  };
  for (const c of app.counties) {
    if (app.mode !== "council") consider(c.mayor, c.code, null, `m:${c.code}`);
    else c.council.districts.forEach((d, k) => consider(d, c.code, k, `c:${d.id}`));
  }
  return out.sort((x, y) => x.m - y.m).slice(0, 3);
}

function createDuel(pick: Pick, now: number): Duel {
  const { race, a, b } = pick;
  const A = race.candidates[a], B = race.candidates[b];
  const pa = partyOf(A.party), pb = partyOf(B.party);
  const c = county(pick.code);
  const place = pick.district === null ? `${c.name}・${c.raceLabel.replace("選舉", "")}` : `${c.name} ${districtLabel(race as District)}`;
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
  li.querySelector("button")!.addEventListener("click", () => select(pick.code, { byUser: true, district: pick.district }));
  crList.appendChild(li);
  const q = (sel: string) => li.querySelector<HTMLElement>(sel)!;
  return {
    ...pick, cfg: duelCfg(), el: li, colors: [pa.color, pb.color], stage: pick.district === null ? "" : "最後一席・",
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

export function clearDuels() {
  duels.forEach((d) => d.el.remove());
  duels = [];
  lastPick = -Infinity;
}

export function refreshDuels(now: number) {
  if (now - lastPick < 1500) return;
  lastPick = now;
  const picks = pickDuels();
  const nearest = picks[0];
  $("mobile-duel").hidden = !nearest;
  $("mobile-duel-text").textContent = nearest
    ? `${county(nearest.code).name}${nearest.district === null ? "" : ` ${districtLabel(nearest.race as District)}`}・差 ${fmt(Math.abs(nearest.race.state.votes[nearest.a] - nearest.race.state.votes[nearest.b]))} 票・開票 ${(nearest.race.state.p * 100).toFixed(0)}%`
    : app.source.started ? "目前沒有接近戰局・查看排行" : "開票後顯示";
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
  $("cr-empty").textContent = any ? "" : (!app.source.started ? "開票開始後，差距最小的戰局會出現在這裡。" : duelCfg().empty);
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
