import { app } from "../app";
import { EMBLEMS, partyLabel, partyOf } from "../config";
import { $ } from "../dom";

/* 當選確定: the centre band with the party emblem and a big 當選, one decision at a time. */

export interface Callout {
  label: string;
  name: string;
  /** Set for a winner: shows the party emblem (or a text seal) and the big 當選. */
  party?: string;
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
  el.classList.remove("is-on");
  void el.offsetWidth;
  el.style.setProperty("--dur", `${dur}ms`);
  el.querySelector<HTMLElement>(".callout-band")!.style.setProperty("--c", item.color);
  el.classList.toggle("is-winner", !!item.party);
  if (item.party) {
    const src = EMBLEMS[partyOf(item.party).key];
    const label = partyLabel(item.party);
    $("callout-emblem").innerHTML = src
      ? `<img src="${src}" alt="">`
      : `<div class="seal" style="--c:${item.color};--seal-size:${label.length <= 3 ? 42 : label.length <= 5 ? 32 : 24}px">${label}</div>`;
  }
  $("callout-label").textContent = item.label;
  $("callout-name").textContent = item.name;
  $("callout-meta").innerHTML = item.meta;
  el.classList.add("is-on");
  $("announcer").textContent = `${item.label}：${item.name}，${item.plain}`;
  clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove("is-on"), dur);
  busyUntil = now + dur + 150;
}
