import { INSET_SCALE, modeCopy, type Mode } from "./config";
import { $ } from "./dom";
import type { Source } from "./model/source";
import type { County } from "./model/types";
import type { Detail } from "./scene/detail";
import { enterCounty } from "./scene/detail";
import { countyView, markSelectedTape, resetTapes } from "./scene/island";
import { focusCamera, sceneOk } from "./scene/stage";
import { renderBoard } from "./ui/board";
import { clearCallouts } from "./ui/callouts";
import { ensureTownBoard } from "./ui/closest";
import { clearDuels, duelCfg } from "./ui/duels";
import { markSelectedSeat, resetNational } from "./ui/national";
import { isTextOpen, renderText } from "./ui/textview";

/** Shared, mutable app state. Modules read and write it directly; the frame loop in main.ts drives updates. */
export const app = {
  source: undefined as unknown as Source,
  counties: [] as County[],
  byCode: new Map<string, County>(),
  councilSeats: 0,
  mode: "mayor" as Mode,
  view: "island" as "island" | "county",
  detail: null as Detail | null,
  selected: "63000",
  selectedDistrict: 0,
  follow: true,
  pendingFollow: null as { code: string; district?: number } | null,
  lastFollowSwitch: -Infinity,
  hovered: null as string | null,
  pointer: { inside: false, x: 0, y: 0 },
};

export const county = (code: string) => app.byCode.get(code)!;

export function select(code: string, { byUser = false, district = null as number | null, noCamera = false } = {}) {
  if (byUser && app.view === "county" && app.detail && code !== app.detail.code) {
    enterCounty(code).then(() => { if (district !== null) select(code, { byUser: true, noCamera: true, district }); });
    return;
  }
  if (byUser) {
    app.follow = false;
    $<HTMLInputElement>("follow").checked = false;
    if (!noCamera && app.view === "island" && sceneOk) focusCamera(countyView(code).anchor);
  }
  const changed = app.selected !== code;
  app.selected = code;
  if (district !== null) app.selectedDistrict = district;
  else if (changed) app.selectedDistrict = 0;
  markSelectedTape(code);
  markSelectedSeat(code);
  renderBoard();
}

export function setMode(next: Mode) {
  app.mode = next;
  document.querySelectorAll<HTMLButtonElement>(".mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === next)));
  const copy = modeCopy(next, app.councilSeats);
  updateLegend();
  $("seat-of").textContent = copy.seatOf;
  $("seat-label").textContent = copy.seatLabel;
  document.body.classList.remove("mode-mayor", "mode-council", "mode-close");
  document.body.classList.add(`mode-${next}`);
  $("close-panel").hidden = next !== "close";
  if (next === "close") ensureTownBoard();
  $("seats").hidden = next === "council";
  $("seatbar").hidden = next !== "council";
  $("council-panel").hidden = next !== "council";
  clearCallouts();
  clearDuels();
  $("cr-note").textContent = duelCfg().note;
  resetTapes();
  resetNational();
  renderBoard();
  if (isTextOpen()) renderText();
}

export function updateLegend() {
  const copy = modeCopy(app.mode, app.councilSeats);
  const inCounty = app.view === "county";
  $("legend-height").innerHTML = inCounty
    ? (app.mode !== "council" ? "<b>鄉鎮紙堆</b>＝各區已開出票數 ÷ 選舉人數" : "<b>鄉鎮紙堆</b>＝所屬選區開票進度 × 該區投票率")
    : copy.height;
  $("legend-inset").innerHTML = sceneOk ? `<b>虛線框</b>＝金門、連江為示意位置，島嶼放大 ${INSET_SCALE} 倍` : "";
  $("legend-top").innerHTML = inCounty
    ? (app.mode === "close" ? copy.top : app.mode === "mayor" ? "<b>頂層顏色</b>＝該區領先的候選人政黨，開完變實色" : "<b>頂層顏色</b>＝所屬議員選區席次最多的政黨，全數確定後變實色")
    : copy.top;
}

export function initModeSwitch() {
  document.querySelectorAll<HTMLButtonElement>(".mode button").forEach((b) => b.addEventListener("click", () => {
    const m = b.dataset.mode as Mode;
    if (m !== app.mode) setMode(m);
  }));
  $<HTMLInputElement>("follow").addEventListener("change", (e) => {
    app.follow = (e.target as HTMLInputElement).checked;
    if (app.follow) app.lastFollowSwitch = -Infinity;
  });
}
