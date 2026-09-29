import { $ } from "../dom";
import { countdownParts } from "../util";

/* 2026 開票前: the countdown notice taped to the desk, mirrored in the footer. */

let timer = 0;

/**
 * Show the notice and tick until `target`. `test` marks a shortened rehearsal countdown (?countdown=);
 * `footer` mirrors it in the footer clock (not in the replay, whose clock shows the replay time).
 */
export function startCountdown(target: number, { test, footer, onDone }: { test: boolean; footer: boolean; onDone: () => void }) {
  $("notice").hidden = false;
  document.body.classList.add("is-counting");
  $("notice-label").textContent = test ? "測試倒數" : "距離開票";
  $("notice-line").innerHTML = test ? "倒數結束後開始開票" : "11 月 28 日（六）16:00<br>投票結束，開始開票";
  if (footer && test) $("standby-date").textContent = "測試倒數";
  if (footer) $("clock-date").textContent = test ? "測試倒數" : "距離開票";
  let shown = "";
  const tick = () => {
    const left = target - Date.now();
    const { days, hms } = countdownParts(left);
    const key = `${days}|${hms}`;
    if (key !== shown) {
      shown = key;
      $("notice-time").innerHTML = (days ? `<span>${days}<small>天</small></span>` : "") + `<span>${hms}</span>`;
      if (footer) $("clock-time").textContent = days ? `${days}天 ${hms}` : hms;
      if (footer) $("standby-time").innerHTML = days ? `<span>${days}<small>天</small></span><span>${hms}</span>` : `<span>${hms}</span>`;
    }
    if (left <= 0) {
      clearInterval(timer);
      onDone();
    }
  };
  timer = window.setInterval(tick, 250);
  tick();
}

/** After the countdown, until the first real results arrive. */
export function showWaiting() {
  $("notice").hidden = false;
  $("notice-label").textContent = "開票開始";
  $("notice-time").innerHTML = "<span>16:00</span>";
  $("notice-line").innerHTML = "等待中選會第一筆開票資料<br>本頁會自動更新";
  $("clock-time").textContent = "16:00";
  $("clock-date").textContent = "開票開始";
  $("standby-title").textContent = "開票開始";
  $("standby-time").textContent = "16:00";
  $("standby-description").textContent = "等待中選會第一筆開票資料，本頁會自動更新。";
}

export function hideNotice() {
  $("notice").hidden = true;
  document.body.classList.remove("is-counting");
}
