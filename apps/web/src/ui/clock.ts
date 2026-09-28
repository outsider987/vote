import { SPAN_MIN, START_MIN } from "../config";
import { $ } from "../dom";
import type { LiveSource } from "../model/live";
import type { ReplaySource } from "../model/replay";
import { fmt } from "../util";
import { clearCallouts } from "./callouts";

/* The footer: replay transport (play, scrub, speed) or, when live, the count-site clock and progress. */

const playBtn = $<HTMLButtonElement>("play");
const scrub = $<HTMLInputElement>("scrub");
let shownPlaying: boolean | null = null;

function syncPlay(src: ReplaySource) {
  if (shownPlaying === src.playing) return;
  shownPlaying = src.playing;
  playBtn.classList.toggle("is-paused", !src.playing);
  playBtn.setAttribute("aria-label", src.playing ? "暫停" : "播放");
}

const clockText = (t: number) => {
  const m = Math.round(START_MIN + t * SPAN_MIN);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function initReplayClock(src: ReplaySource) {
  playBtn.addEventListener("click", () => {
    if (!src.playing && src.T >= 1) { src.seek(0); clearCallouts(); }
    src.playing = !src.playing;
    syncPlay(src);
  });
  $("replay").addEventListener("click", () => { src.seek(0); clearCallouts(); src.playing = true; syncPlay(src); });
  document.querySelectorAll<HTMLButtonElement>(".speed button").forEach((b) => b.addEventListener("click", () => {
    src.speed = Number(b.dataset.speed);
    document.querySelectorAll(".speed button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  }));
  scrub.addEventListener("input", () => { src.seek(Number(scrub.value) / 1000); clearCallouts(); });
  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
    if (e.code !== "Space" || ["INPUT", "BUTTON", "TEXTAREA", "SELECT"].includes(tag)) return;
    e.preventDefault();
    playBtn.click();
  });
  syncPlay(src);
}

export function updateReplayClock(src: ReplaySource) {
  syncPlay(src);
  const v = Math.round(src.T * 1000);
  if (Number(scrub.value) !== v) scrub.value = String(v);
  scrub.style.setProperty("--fill", `${src.T * 100}%`);
  scrub.setAttribute("aria-valuetext", clockText(src.T));
  $("clock-time").textContent = clockText(src.T);
}

/* ---------- live ---------- */

const hms = (iso: string) => {
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : "—";
};

export function initLiveClock() {
  $("clock").classList.add("is-live");
  $("clock").setAttribute("aria-label", "即時開票狀態");
  $("live-status").hidden = false;
  $("clock-date").textContent = "中選會資料時間";
}

/** Refresh the footer from the latest snapshot and the connection state. Cheap; call about once a second. */
export function updateLiveClock(src: LiveSource) {
  const snap = src.snapshot;
  if (!snap) return;
  let reported = 0, total = 0, latest = "";
  for (const t of Object.values(snap.mayors)) {
    reported += t.stations.reported;
    total += t.stations.total;
    if (t.updatedAt && t.updatedAt > latest) latest = t.updatedAt;
  }
  $("clock-time").textContent = latest ? hms(latest) : "—";
  $("live-progress-text").textContent = total
    ? `縣市長投開票所 ${fmt(reported)}／${fmt(total)} 已回報（${((reported / total) * 100).toFixed(1)}%）`
    : "等待中選會公布投開票所數";
  $("live-bar").style.setProperty("--fill", `${total ? (reported / total) * 100 : 0}%`);

  const age = Date.now() - Date.parse(snap.generatedAt);
  const offline = src.status === "error" && Date.now() - src.lastOk > 90_000;
  const stalled = !offline && snap.stage !== "final" && age > 180_000;
  $("clock").classList.toggle("is-stale", offline || stalled);
  $("live-badge").textContent = src.rehearsal ? "彩排" : "即時";
  $("live-note").textContent = src.rehearsal ? "彩排資料，非即時開票"
    : offline ? "連線中斷，稍後自動重試"
    : stalled ? `資料 ${Math.round(age / 60_000)} 分鐘未更新`
    : snap.stage === "prior" ? "尚未開票，16:00 起自動更新"
    : snap.stage === "final" ? "開票結束"
    : `每 ${Math.round(src.intervalMs / 1000)} 秒自動更新`;
}
