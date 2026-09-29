import { app } from "../app";
import { EMBLEMS, partyLabel, partyOf, partySeatTotals } from "../config";
import { $ } from "../dom";

/* Decision callouts: a party emblem for a mayor, a seat wheel for a council district. */

export interface Callout {
  label: string;
  name: string;
  /** Mayor: shows the winner's party emblem and 當選 stamp. */
  party?: string;
  /** Council district: shows each party's confirmed seats and a distinct 確定 stamp. */
  council?: { seats: number; parties: Record<string, number> };
  color: string;
  meta: string;
  /** Plain-text meta for the screen-reader announcement. */
  plain: string;
}

const queue: (Callout & { at: number })[] = [];
let busyUntil = 0;
let timer = 0;

export function preloadEmblems() {
  Object.values(EMBLEMS).forEach((src) => { new Image().src = src!; });
}

export function enqueueCallout(item: Callout) {
  queue.push({ ...item, at: performance.now() });
}

export function clearCallouts() {
  queue.length = 0;
  busyUntil = 0;
  clearTimeout(timer);
  $("callout").classList.remove("is-on");
}

export function pumpCallouts(now: number) {
  if (now < busyUntil || !queue.length) return;
  // when decisions pile up, skip stale ones rather than fall behind the count
  while (queue.length > 1 && now - queue[0].at > 5000) queue.shift();
  const item = queue.shift()!;
  const dur = Math.round(2400 / Math.sqrt(app.source.speed));
  const el = $("callout");
  $("duel-flash").hidden = true;
  el.classList.remove("is-on");
  void el.offsetWidth;
  el.style.setProperty("--dur", `${dur}ms`);
  el.querySelector<HTMLElement>(".callout-band")!.style.setProperty("--c", item.color);
  el.classList.toggle("is-winner", !!item.party || !!item.council);
  el.classList.toggle("is-council", !!item.council);
  el.querySelector<HTMLElement>(".callout-big")!.textContent = item.council ? "確定" : "當選";
  let meta = item.meta;
  if (item.party) {
    const src = EMBLEMS[partyOf(item.party).key];
    const label = partyLabel(item.party);
    $("callout-emblem").innerHTML = src
      ? `<img src="${src}" alt="">`
      : `<div class="seal" style="--c:${item.color};--seal-size:${label.length <= 3 ? 42 : label.length <= 5 ? 32 : 24}px">${label}</div>`;
  } else if (item.council) {
    const { seats } = item.council;
    const parties = partySeatTotals(item.council.parties);
    let used = 0;
    const gradient = parties.map((p) => {
      const from = used;
      used += p.seats;
      return `${p.color} ${from / seats * 100}% ${used / seats * 100}%`;
    }).join(", ");
    $("callout-emblem").innerHTML = `<div class="council-wheel" style="--wheel:conic-gradient(${gradient})"><span class="num">${seats}</span><small>席確定</small></div>`;
    meta += parties.slice(0, 4).map((p) => `<span class="callout-party"><i class="chip" style="--c:${p.color}"></i>${p.name} ${p.seats}</span>`).join("");
  }
  $("callout-label").textContent = item.label;
  $("callout-name").textContent = item.name;
  $("callout-meta").innerHTML = meta;
  el.classList.add("is-on");
  $("announcer").textContent = `${item.label}：${item.name}，${item.plain}`;
  clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove("is-on"), dur);
  busyUntil = now + dur + 150;
}
