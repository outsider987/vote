import * as THREE from "three";
import { app, initModeSwitch, select, setMode } from "./app";
import { partyLabel, partyOf, partySummary } from "./config";
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
import { initLiveClock, initReplayClock, updateLiveClock, updateReplayClock } from "./ui/clock";
import { refreshDuels, updateDuels } from "./ui/duels";
import { initNational, renderNational } from "./ui/national";
import { initTextView, isTextOpen, renderText } from "./ui/textview";
import { updateTip } from "./ui/tips";

// ?source=live|replay overrides the build default (VITE_SOURCE); results.json lives at VITE_LIVE_URL.
const SOURCE = (params.get("source") ?? import.meta.env.VITE_SOURCE ?? "replay") === "live" ? "live" : "replay";
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
      if (d.state.decided && !d.decidedPrev && mode === "council" && follow && !initial) app.pendingFollow = { code: c.code, district: k };
      d.decidedPrev = d.state.decided;
    });
    cn.state = councilAggregate(cn);
    if (cn.state.complete && !cn.completePrev && mode === "council" && forward) {
      const lead = partyOf(cn.state.leaderParty ?? "");
      const summary = partySummary(cn.state.decided, 4);
      enqueueCallout({
        label: "議員席次確定",
        name: c.name,
        color: lead.color,
        meta: `${cn.seats} 席・${summary}`,
        plain: `${cn.seats} 席，${summary}`,
      });
    }
    cn.completePrev = cn.state.complete;
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
  src.tick(dt);
  updateModel();
  if (sceneOk) {
    updateIsland(dt);
    updateDetail(reducedMotion ? 1 : 1 - Math.exp(-dt * 9));
    updateCamera(now, dt, src.playing);
  }
  pumpCallouts(now);
  refreshDuels(now);
  if (frameNo % 2 === 0) updateDuels(now);
  if (sceneOk && app.pointer.inside && frameNo % 3 === 0) setHover(pick(app.pointer.x, app.pointer.y));
  if (frameNo % 2 === 0) {
    updateBoard();
    renderNational();
    updateTip();
    if (src instanceof ReplaySource) updateReplayClock(src);
  }
  if (isTextOpen() && frameNo % 20 === 0) renderText();
  if (sceneOk) {
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (frameNo % 8 === 0) avoidLabelCollisions(app.view === "county" && app.detail ? app.detail.items : allCountyViews());
  }
  frameNo++;
}

/* ---------- boot ---------- */

function applyLiveCopy(live: LiveSource) {
  const snap = live.snapshot!;
  const emblems = "黨徽：維基共享資源，公有領域（中國國民黨、民主進步黨黨旗中央、台灣民眾黨）；無黨籍及其他政黨以文字圓印表示。";
  const now = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  $("intro-time").textContent = now;
  if (live.rehearsal) {
    // accuracy first: rehearsal numbers must never read as the real count
    document.title = "開票所｜彩排資料";
    $("brand-sub").innerHTML = `<span class="sub-long">彩排・以 ${snap.election} 資料模擬開票，非即時結果</span><span class="sub-short">彩排資料・非即時</span>`;
    $("text-credit").textContent = `彩排資料：以 ${snap.election} 選舉結果模擬中選會開票網站，並非即時開票結果。${emblems}`;
    $("intro-line").textContent = "彩排資料，非即時開票";
    return;
  }
  document.title = "開票所｜2026 地方選舉即時開票";
  $("brand-sub").innerHTML = '<span class="sub-long">2026 地方選舉・即時開票</span><span class="sub-short">2026 即時開票</span>';
  $("text-credit").textContent = `資料來源：中央選舉委員會開票網站，約每分鐘更新；以中選會公告為準。${emblems}`;
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
  if (SOURCE === "live") {
    live = new LiveSource(LIVE_URL, POLL_MS);
    while (!(await live.fetch())) {
      loadingText.innerHTML = '即時開票資料尚未開始，稍後自動重試<br><a href="?source=replay">先看 2022 年結果重播</a>';
      await wait(LIVE_RETRY_MS);
    }
    app.source = live;
    app.counties = buildLive(live.snapshot!, mayorFile, councilFile, await live.fetchCandidates());
  } else {
    replay = new ReplaySource();
    app.source = replay;
    app.counties = buildReplay(mayorFile, councilFile);
  }
  app.byCode = new Map(app.counties.map((c) => [c.code, c]));
  app.councilSeats = app.counties.reduce((a, c) => a + c.council.seats, 0);
  await Promise.race([document.fonts.ready, wait(2500)]);

  // URL state: ?mode=mayor|council, ?c=county code, ?d=district index, ?t=0–1 (replay), ?intro=0
  app.mode = params.get("mode") === "council" ? "council" : "mayor";
  const c = params.get("c");
  if (c && app.byCode.has(c)) app.selected = c;
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
    initReplayClock(replay);
    if (startT !== null && Number.isFinite(startT)) { replay.seek(startT); replay.commit(); replay.playing = false; }
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
  requestAnimationFrame(() => {
    $("loading").classList.add("is-done");
    if (introOn) {
      controls.enabled = false;
      cam.introStart = performance.now();
      $("intro").classList.add("is-on");
    }
  });
}

boot();
