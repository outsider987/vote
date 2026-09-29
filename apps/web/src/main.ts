import * as THREE from "three";
import type { CandidateList } from "@vote/shared";
import { app, initModeSwitch, select, setMode } from "./app";
import { COUNT_STARTS_AT, districtLabel, partyLabel, partyOf, partySummary } from "./config";
import { $, params, reducedMotion } from "./dom";
import { councilAggregate } from "./model/analysis";
import { loadCouncils, loadCountyTopo, loadMayors } from "./model/data";
import { LiveSource, buildLive } from "./model/live";
import { ReplaySource, buildReplay } from "./model/replay";
import { updateDetail } from "./scene/detail";
import { initPointer, pick, setHover } from "./scene/interaction";
import { allCountyViews, avoidLabelCollisions, buildIsland, updateIsland } from "./scene/island";
import { cam, camera, controls, initStage, labelRenderer, renderer, scene, sceneOk, startFraming, updateCamera } from "./scene/stage";
import { updateBoard } from "./ui/board";
import { enqueueCallout, preloadEmblems, pumpCallouts } from "./ui/callouts";
import { initClosest } from "./ui/closest";
import { initLiveClock, initReplayClock, initStandbyClock, setStandbyStatus, updateLiveClock, updateReplayClock } from "./ui/clock";
import { hideNotice, showWaiting, startCountdown } from "./ui/countdown";
import { refreshDuels, updateDuelFlashPosition, updateDuels } from "./ui/duels";
import { initNational, renderNational } from "./ui/national";
import { initTextView, isTextOpen, renderText } from "./ui/textview";
import { updateTip } from "./ui/tips";
import { fmt } from "./util";

// Which edition to show. The default ("auto") is the 2026 site: a countdown until the count starts, then
// live results. ?source=replay is the 2022 replay (tests and demos); ?source=live forces live mode now
// (rehearsals). VITE_SOURCE sets a build's default. results.json lives at VITE_LIVE_URL.
const REQUESTED = (() => {
  const v = params.get("source") || import.meta.env.VITE_SOURCE || "auto";
  return v === "replay" || v === "live" ? v : "auto";
})();
// ?countdown=seconds swaps the real start time for a short test countdown.
const COUNTDOWN_TEST = params.has("countdown");
const COUNT_AT = COUNTDOWN_TEST ? Date.now() + Math.max(0, Number(params.get("countdown")) || 0) * 1000 : COUNT_STARTS_AT;
const LIVE_URL: string = import.meta.env.VITE_LIVE_URL || "live/results.json";
const LIVE_RETRY_MS = 15_000;
// Refresh every 30 s by default; ?poll=seconds changes it (5–120 s), e.g. ?poll=5 for local rehearsals.
const POLL_MS = Math.min(120, Math.max(5, Number(params.get("poll")) || 30)) * 1000;

const loadingText = $("loading").querySelector("p")!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- model update: runs every frame for both sources ---------- */

function updateModel(initial = false) {
  const src = app.source;
  const forward = !initial && src.isForward();
  const { mode, follow } = app;
  for (const c of app.counties) {
    const r = c.mayor;
    src.refresh(r);
    const s = r.state;
    if (s.decided && !r.decidedPrev && mode !== "council") {
      if (follow && mode === "mayor" && !initial) app.pendingFollow = { code: c.code };
      const w = s.winners.length ? r.candidates[s.winners[0]] : null;
      if (forward && w) {
        const p = partyOf(w.party);
        enqueueCallout({
          label: "當選確定",
          name: w.name,
          party: w.party,
          color: p.color,
          meta: `<i class="chip" style="--c:${p.color}"></i>${c.name}・${partyLabel(w.party)}`,
          plain: `${c.name}・${partyLabel(w.party)}`,
        });
      }
    }
    r.decidedPrev = s.decided;

    const cn = c.council;
    cn.districts.forEach((d, k) => {
      src.refresh(d);
      if (d.state.decided && !d.decidedPrev && mode === "council") {
        if (follow && !initial) app.pendingFollow = { code: c.code, district: k };
        if (forward && d.state.winners.length) {
          const parties: Record<string, number> = {};
          for (const j of d.state.winners) {
            const party = d.candidates[j].party;
            parties[party] = (parties[party] || 0) + 1;
          }
          const seats = d.state.winners.length;
          enqueueCallout({
            label: "議員席次確定",
            name: c.name,
            color: "var(--stamp)",
            council: { seats, parties },
            meta: `${districtLabel(d)}・${seats} 席`,
            plain: `${districtLabel(d)}，${seats} 席，${partySummary(parties, 4)}`,
          });
        }
      }
      d.decidedPrev = d.state.decided;
    });
    cn.state = councilAggregate(cn);
  }
  src.commit();
  if (app.follow && app.pendingFollow && performance.now() - app.lastFollowSwitch > 3200) {
    select(app.pendingFollow.code, { district: app.pendingFollow.district ?? null });
    app.pendingFollow = null;
    app.lastFollowSwitch = performance.now();
  }
}

/* ---------- frame loop ---------- */

const timer = new THREE.Timer();
let frameNo = 0;

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const now = performance.now();
  const src = app.source;
  const mapVisible = sceneOk && (window.innerWidth > 900 || document.querySelector(".room")!.classList.contains("map-open"));
  src.tick(dt);
  updateModel();
  if (mapVisible) {
    updateIsland(dt);
    updateDetail(reducedMotion ? 1 : 1 - Math.exp(-dt * 9));
    updateCamera(now, dt, src.playing);
    updateDuelFlashPosition();
  }
  pumpCallouts(now);
  refreshDuels(now);
  if (frameNo % 2 === 0) updateDuels(now);
  if (mapVisible && app.pointer.inside && frameNo % 3 === 0) setHover(pick(app.pointer.x, app.pointer.y));
  if (frameNo % 2 === 0) {
    updateBoard();
    renderNational();
    updateTip();
    if (src instanceof ReplaySource) updateReplayClock(src);
  }
  if (isTextOpen() && frameNo % 20 === 0) renderText();
  if (mapVisible) {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (frameNo % 8 === 0) avoidLabelCollisions(app.view === "county" && app.detail ? app.detail.items : allCountyViews());
  }
  frameNo++;
}

/* ---------- boot ---------- */

const EMBLEM_CREDIT = "黨徽：維基共享資源，公有領域（中國國民黨、民主進步黨黨旗中央、台灣民眾黨）；無黨籍及其他政黨以文字圓印表示。";

function setSourceNote(label: string, short: string, detail: string) {
  $("source-note-label").textContent = label;
  $("source-note-short").textContent = short;
  $("source-note-detail").textContent = detail;
}

function applyReplayCopy() {
  document.title = "開票所｜2022 開票重播";
  $("brand-sub").innerHTML = '<span class="sub-long">2022 真實結果・過程模擬・<a href="./">看 2026</a></span><span class="sub-short">2022 過程模擬・<a href="./">看 2026</a></span>';
  setSourceNote("2022 結果重播", "中途模擬・最終結果真實", "最終票數與當選結果為真實資料；中途票數與開票進度為模擬。");
  $("text-credit").textContent = `資料來源：中央選舉委員會選舉資料庫。最終票數與當選結果為真實資料；中途票數與開票進度為模擬。${EMBLEM_CREDIT}`;
}

function applyStandbyCopy() {
  document.title = "開票所｜2026 地方選舉開票";
  $("brand-sub").innerHTML = '<span class="sub-long">2026 地方選舉・11 月 28 日 16:00 開票</span><span class="sub-short">2026・11/28 開票</span>';
  setSourceNote("2026 開票預備", "中選會資料・開票後更新", `11 月 28 日開票後依中選會資料約每分鐘查詢；本頁每 ${Math.round(POLL_MS / 1000)} 秒檢查，有新票數才更新。`);
  $("text-credit").textContent = `資料來源：中央選舉委員會。11 月 28 日 16:00 後約每分鐘檢查開票資料，本頁每 ${Math.round(POLL_MS / 1000)} 秒確認新資料；有新票數才更新，以中選會公告為準。${EMBLEM_CREDIT}`;
}

function standbyStatus(list: CandidateList | null) {
  // an empty list is the placeholder published before the real one exists
  if (!list || !Object.keys(list.mayors).length) return "候選人名單尚未公布；有資料後會自動更新。";
  const mayors = Object.values(list.mayors).reduce((a, l) => a + l.length, 0);
  const councils = Object.values(list.councils).reduce((a, d) => a + d.candidates.length, 0);
  return `已公布 ${fmt(mayors)} 位縣市長、${fmt(councils)} 位議員候選人；開票後有新票數才更新。`;
}

/** After the countdown: look for the first real 2026 results, then reload straight into live mode. */
async function waitForResults() {
  showWaiting();
  setStandbyStatus(`開票開始，等待中選會第一筆資料・每 ${Math.round(POLL_MS / 1000)} 秒自動檢查`);
  const probe = new LiveSource(LIVE_URL);
  for (;;) {
    if ((await probe.fetch()) && !probe.rehearsal && probe.started) {
      const url = new URL(location.href);
      url.searchParams.delete("countdown");
      if (COUNTDOWN_TEST && Date.now() < COUNT_STARTS_AT) url.searchParams.set("source", "live");
      location.replace(url.toString());
      return;
    }
    await wait(POLL_MS);
  }
}

function applyLiveCopy(live: LiveSource) {
  const snap = live.snapshot!;
  const emblems = EMBLEM_CREDIT;
  const now = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  $("intro-time").textContent = now;
  if (live.rehearsal) {
    // accuracy first: rehearsal numbers must never read as the real count
    document.title = "開票所｜彩排資料";
    $("brand-sub").innerHTML = `<span class="sub-long">彩排・以 ${snap.election} 資料模擬開票，非即時結果</span><span class="sub-short">彩排資料・非即時</span>`;
    $("text-credit").textContent = `彩排資料：以 ${snap.election} 選舉結果模擬中選會開票網站，並非即時開票結果。${emblems}`;
    setSourceNote("彩排資料", "模擬資料・非即時結果", "這是模擬開票，並非 2026 即時結果。");
    $("intro-line").textContent = "彩排資料，非即時開票";
    return;
  }
  document.title = "開票所｜2026 地方選舉即時開票";
  $("brand-sub").innerHTML = '<span class="sub-long">2026 地方選舉・即時開票</span><span class="sub-short">2026 即時開票</span>';
  $("text-credit").textContent = `資料來源：中央選舉委員會開票網站。約每分鐘檢查來源，本頁每 ${Math.round(POLL_MS / 1000)} 秒確認新資料；有新票數才更新，以中選會公告為準。${emblems}`;
  setSourceNote("2026 即時開票", `中選會資料・每 ${Math.round(POLL_MS / 1000)} 秒檢查`, `依中選會資料約每分鐘查詢；本頁每 ${Math.round(POLL_MS / 1000)} 秒檢查，有新票數才更新。`);
  $("intro-line").textContent = snap.stage === "prior" ? "16:00 開始開票" : snap.stage === "final" ? "開票結束" : "即時開票中";
}

async function boot() {
  let mayorFile, councilFile, topo;
  try {
    [mayorFile, councilFile, topo] = await Promise.all([loadMayors(), loadCouncils(), loadCountyTopo()]);
  } catch (err) {
    loadingText.textContent = "資料載入失敗，請重新整理頁面";
    throw err;
  }

  let replay: ReplaySource | null = null, live: LiveSource | null = null;
  let standby = false, list: CandidateList | null = null;
  if (REQUESTED === "replay") {
    replay = new ReplaySource();
    app.source = replay;
    app.counties = buildReplay(mayorFile, councilFile);
  } else {
    live = new LiveSource(LIVE_URL, POLL_MS);
    if (REQUESTED === "live") {
      while (!(await live.fetch())) {
        loadingText.innerHTML = '即時開票資料尚未開始，稍後自動重試<br><a href="?source=replay">先看 2022 模擬重播</a>';
        await wait(LIVE_RETRY_MS);
      }
    } else {
      // the 2026 site: live once real results exist after the count starts; until then it stands ready
      standby = !(Date.now() >= COUNT_AT && (await live.fetch()) && !live.rehearsal && live.started);
      if (standby) live.useEmpty();
    }
    list = await live.fetchCandidates();
    app.source = live;
    app.counties = buildLive(live.snapshot!, mayorFile, councilFile, list);
  }
  app.byCode = new Map(app.counties.map((c) => [c.code, c]));
  app.councilSeats = app.counties.reduce((a, c) => a + c.council.seats, 0);
  await Promise.race([document.fonts.ready, wait(2500)]);

  // URL state: ?mode=mayor|council, ?c=county code, ?d=district index, ?t=0–1 (replay), ?intro=0
  app.mode = params.get("mode") === "council" ? "council" : "mayor";
  const c = params.get("c");
  if (c && app.byCode.has(c)) { app.selected = c; app.closeScope = c; }
  app.selectedDistrict = Number(params.get("d")) || 0;
  app.follow = !c;

  initStage();
  if (sceneOk) {
    buildIsland(topo);
    initPointer();
    startFraming();
  }
  initNational();
  initClosest();
  initTextView();
  initModeSwitch();
  preloadEmblems();

  const startT = replay && params.has("t") ? Number(params.get("t")) : null;
  if (replay) {
    applyReplayCopy();
    initReplayClock(replay);
    if (startT !== null && Number.isFinite(startT)) { replay.seek(startT); replay.commit(); replay.playing = false; }
    if (COUNTDOWN_TEST) { replay.seek(0); replay.commit(); replay.playing = false; }
  } else if (live && standby) {
    document.body.classList.add("is-standby");
    applyStandbyCopy();
    initStandbyClock(standbyStatus(list));
  } else if (live) {
    applyLiveCopy(live);
    initLiveClock();
    updateLiveClock(live);
    live.start(() => updateLiveClock(live));
    setInterval(() => updateLiveClock(live), 1000);
  }

  $<HTMLInputElement>("follow").checked = app.follow;
  updateModel(true);
  setMode(app.mode);
  select(app.selected, { district: app.selectedDistrict });
  if (sceneOk) renderer.setAnimationLoop(frame);
  else {
    const loop = () => { frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  const introOn = sceneOk && startT === null && params.get("intro") !== "0" && !reducedMotion;
  const countdownReplay = !!replay && COUNTDOWN_TEST;
  requestAnimationFrame(() => {
    $("loading").classList.add("is-done");
    if (introOn) {
      controls.enabled = false;
      cam.introStart = performance.now();
      // 「16:00 投票結束，開始開票」 belongs to the moment counting starts, not to a page still counting down
      if (!standby && !countdownReplay) $("intro").classList.add("is-on");
    }
    if (standby) {
      if (Date.now() < COUNT_AT) startCountdown(COUNT_AT, { test: COUNTDOWN_TEST, footer: true, onDone: () => void waitForResults() });
      else void waitForResults();
    } else if (countdownReplay) {
      startCountdown(COUNT_AT, {
        test: true,
        footer: false,
        onDone: () => {
          hideNotice();
          replay!.playing = true;
          const intro = $("intro");
          intro.classList.remove("is-on");
          void intro.offsetWidth;
          intro.classList.add("is-on");
        },
      });
    }
  });
}

const sourceNote = $<HTMLDetailsElement>("source-note");
const mobileWidth = matchMedia("(max-width: 900px)");
sourceNote.open = !mobileWidth.matches;
mobileWidth.addEventListener("change", () => { sourceNote.open = !mobileWidth.matches; });

boot();
