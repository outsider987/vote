import { app, county } from "../app";
import { partyLabel, partySummary } from "../config";
import { $ } from "../dom";
import { duelOf } from "../model/analysis";
import { townTip } from "../scene/detail";
import { townItem } from "../scene/interaction";
import { fmt } from "../util";

/* The hover tip in the scene, and the floating tip for seat buttons. */

const tip = $("scene-tip");

export function updateTip() {
  const code = app.hovered;
  if (!code) { tip.hidden = true; return; }
  let html: string;
  if (code.length > 5) {
    const it = townItem(code);
    if (!it) { tip.hidden = true; return; }
    html = townTip(it);
  } else {
    const c = county(code);
    if (app.mode !== "council") {
      const r = c.mayor, s = r.state;
      let line = "尚未開出票數";
      if (s.top.length) {
        const j = s.top[0], x = r.candidates[j];
        const pct = s.counted ? ((s.votes[j] / s.counted) * 100).toFixed(2) : "0.00";
        line = `${s.decided ? "當選" : "領先"}　${x.name}（${partyLabel(x.party)}）${pct}%`;
      }
      html = `<b>${c.name}</b>　開票 ${(s.p * 100).toFixed(1)}%<br><span class="t-sub">${line}</span>`;
      const du = app.mode === "close" ? duelOf(r) : null;
      if (du) html += `<br><span class="t-sub">前兩名差 ${fmt(du.gap)} 票（${(du.margin * 100).toFixed(2)}%）</span>`;
    } else {
      const s = c.council.state;
      const parties = partySummary(s.decided, 3);
      html = `<b>${c.name}議員</b>　開票 ${(s.p * 100).toFixed(1)}%<br><span class="t-sub">已確定 ${s.decidedSeats}／${c.council.seats} 席${parties ? "・" + parties : ""}</span>`;
    }
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const r = $("scene").getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(app.pointer.x - r.left + 14, r.width - w - 8))}px`;
  tip.style.top = `${Math.max(8, Math.min(app.pointer.y - r.top + 14, r.height - h - 8))}px`;
}

const floatTip = $("float-tip");

export function showFloat(el: HTMLElement, html: string) {
  const r = el.getBoundingClientRect();
  floatTip.innerHTML = html;
  floatTip.hidden = false;
  floatTip.style.left = `${Math.min(Math.max(r.left + r.width / 2, 140), innerWidth - 140)}px`;
  floatTip.style.top = `${r.top}px`;
}

export const hideFloat = () => { floatTip.hidden = true; };
