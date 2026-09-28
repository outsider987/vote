import { app, county } from "../app";
import { ORDER, partyLabel, partySummary } from "../config";
import { $ } from "../dom";
import { exitCounty } from "../scene/detail";
import { pendingLabel } from "./board";

/* 文字版結果: the same results as a plain table, for screen readers and anyone who prefers text. */

const textView = $("text-view");
export const isTextOpen = () => !textView.hidden;

function openText(open: boolean) {
  textView.hidden = !open;
  $("text-toggle").setAttribute("aria-expanded", String(open));
  if (open) { renderText(); $("text-close").focus(); } else { $("text-toggle").focus(); }
}

export function initTextView() {
  $("text-toggle").addEventListener("click", () => openText(!isTextOpen()));
  $("text-close").addEventListener("click", () => openText(false));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!textView.hidden) openText(false);
    else if (app.view === "county") exitCounty();
  });
  $("back").addEventListener("click", exitCounty);
}

export function renderText() {
  if (app.mode !== "council") {
    $("text-head").innerHTML = `<tr><th scope="col">縣市</th><th scope="col">開票進度</th><th scope="col">領先或當選</th><th scope="col">得票率</th><th scope="col">狀態</th></tr>`;
    $("text-rows").innerHTML = ORDER.map((code) => {
      const c = county(code), r = c.mayor, s = r.state;
      if (!s.top.length) return `<tr><td>${c.name}</td><td class="n">${(s.p * 100).toFixed(1)}%</td><td>尚未開出</td><td class="n">—</td><td>${pendingLabel()}</td></tr>`;
      const j = s.top[0], x = r.candidates[j];
      const pct = s.counted ? ((s.votes[j] / s.counted) * 100).toFixed(2) : "0.00";
      return `<tr><td>${c.name}</td><td class="n">${(s.p * 100).toFixed(1)}%</td><td>${x.name}（${partyLabel(x.party)}）</td><td class="n">${pct}%</td><td class="${s.decided ? "status-won" : ""}">${s.decided ? "當選確定" : pendingLabel()}</td></tr>`;
    }).join("");
  } else {
    $("text-head").innerHTML = `<tr><th scope="col">縣市</th><th scope="col">開票進度</th><th scope="col">已確定席次</th><th scope="col">已確定各黨席次</th><th scope="col">狀態</th></tr>`;
    $("text-rows").innerHTML = ORDER.map((code) => {
      const c = county(code), s = c.council.state;
      return `<tr><td>${c.name}</td><td class="n">${(s.p * 100).toFixed(1)}%</td><td class="n">${s.decidedSeats}／${c.council.seats}</td><td>${partySummary(s.decided, 6) || "—"}</td><td class="${s.complete ? "status-won" : ""}">${s.complete ? "全數確定" : pendingLabel()}</td></tr>`;
    }).join("");
  }
}
