import { CLOSE, INSET_SCALE, modeCopy, type Mode } from "./config";
import { $, reducedMotion } from "./dom";
import type { Source } from "./model/source";
import type { County } from "./model/types";
import type { Detail } from "./scene/detail";
import { enterCounty, exitCounty } from "./scene/detail";
import { countyView, markSelectedTape, resetTapes } from "./scene/island";
import { focusCamera, sceneOk } from "./scene/stage";
import { renderBoard } from "./ui/board";
import { clearCallouts } from "./ui/callouts";
import { ensureTownBoard } from "./ui/closest";
import { openDuelAlert } from "./ui/duels";
import { markSelectedSeat, resetNational } from "./ui/national";
import { isTextOpen, renderText } from "./ui/textview";

/** Shared, mutable app state. Modules read and write it directly; the frame loop in main.ts drives updates. */
export const app = {
  source: undefined as unknown as Source,
  counties: [] as County[],
  byCode: new Map<string, County>(),
  councilSeats: 0,
  mode: "mayor" as Mode,
  closeScope: null as string | null,
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

export function scrollMobileTo(id: "board" | "scene") {
  if (window.innerWidth > 900) return;
  if (id === "scene") return;
  if (document.querySelector(".room")!.classList.contains("map-open")) setMobileMapOpen(false);
  const top = $(id).getBoundingClientRect().top + window.scrollY
    - document.querySelector(".topbar")!.getBoundingClientRect().height
    - 8;
  window.scrollTo({ top, behavior: reducedMotion ? "instant" : "smooth" });
}

export function setMobileMapOpen(open: boolean) {
  if (window.innerWidth > 900) return;
  document.querySelector(".room")!.classList.toggle("map-open", open);
  document.body.classList.toggle("mobile-map-open", open);
  const button = $<HTMLButtonElement>("map-toggle");
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "收起 3D 地圖" : "看 3D 地圖";
  $<HTMLButtonElement>(open ? "map-close" : "map-toggle").focus({ preventScroll: true });
}

export function select(code: string, { byUser = false, district = null as number | null, noCamera = false } = {}) {
  if (byUser && app.view === "county" && app.detail && code !== app.detail.code) {
    if (window.innerWidth <= 900 && !document.querySelector(".room")!.classList.contains("map-open")) exitCounty();
    else {
      enterCounty(code).then(() => { if (district !== null) select(code, { byUser: true, noCamera: true, district }); });
      return;
    }
  }
  if (byUser) {
    app.follow = false;
    app.closeScope = code;
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
  if (next === "close" && app.view === "county") app.closeScope = app.selected;
  $<HTMLSelectElement>("county-select").options[0].disabled = next !== "close";
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
  $("cr-note").textContent = `縣市長 <${CLOSE.mayor.threshold * 100}%・議員末席 <${CLOSE.council.threshold * 100}%`;
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
  const picker = $<HTMLSelectElement>("county-select");
  picker.replaceChildren(new Option("全台", ""), ...app.counties.map((c) => new Option(c.name, c.code)));
  picker.addEventListener("change", () => {
    if (picker.value) select(picker.value, { byUser: true, noCamera: true });
    else {
      if (app.view === "county") exitCounty();
      app.closeScope = null;
      renderBoard();
    }
    scrollMobileTo("board");
  });
  $("map-close").addEventListener("click", () => setMobileMapOpen(false));
  const topbar = document.querySelector<HTMLElement>(".topbar")!;
  const tallyToggle = $<HTMLButtonElement>("tally-toggle");
  const closeTally = () => {
    topbar.classList.remove("is-open");
    tallyToggle.setAttribute("aria-expanded", "false");
  };
  tallyToggle.addEventListener("click", () => {
    const open = topbar.classList.toggle("is-open");
    tallyToggle.setAttribute("aria-expanded", String(open));
  });
  $("seats").addEventListener("click", closeTally);
  document.addEventListener("pointerdown", (e) => { if (!topbar.contains(e.target as Node)) closeTally(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && topbar.classList.contains("is-open")) { closeTally(); tallyToggle.focus(); }
  });
  document.querySelectorAll<HTMLButtonElement>(".mode button").forEach((b) => b.addEventListener("click", () => {
    const m = b.dataset.mode as Mode;
    if (m !== app.mode) setMode(m);
    closeTally();
    scrollMobileTo("board");
  }));
  $("mobile-duel").addEventListener("click", openDuelAlert);
  $("map-toggle").addEventListener("click", () => {
    const open = !document.querySelector(".room")!.classList.contains("map-open");
    setMobileMapOpen(open);
    if (open && app.view !== "county" && (app.closeScope || !app.follow)) void enterCounty(app.closeScope ?? app.selected);
  });
  $<HTMLInputElement>("follow").addEventListener("change", (e) => {
    app.follow = (e.target as HTMLInputElement).checked;
    if (app.follow) {
      if (app.view === "island") app.closeScope = null;
      app.lastFollowSwitch = -Infinity;
    }
  });
}
