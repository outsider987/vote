import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { feature } from "topojson-client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection } from "topojson-specification";
import { app, county, select, updateLegend } from "../app";
import { HEIGHT_SCALE, districtLabel, partyLabel, partyOf } from "../config";
import { $, reducedMotion } from "../dom";
import { duelOf, turnoutCounted } from "../model/analysis";
import { loadTownTopo, loadTowns, type TownsFile } from "../model/data";
import { townRaces } from "../model/replay";
import type { District, Race, TownRecord } from "../model/types";
import { mulberry32 } from "../util";
import { buildStack, disposeStack, labelPoint, projector, type Stack } from "./geo";
import { hoverFromTape, setHover } from "./interaction";
import { PAPER_C, rampColor, setInsetsVisible, type Labeled } from "./island";
import { cam, controls, fitFor, flyTo, host, islandDistance, islandTarget, scene, sceneOk, setIslandLimits } from "./stage";

/* 縣市細節: clicking a county swaps the island for that county's towns. */

export interface TownItem extends Labeled {
  stack: Stack;
  town: TownRecord;
  label: CSS2DObject;
  race: Race;
  /** Indices into the county's council districts that include this town. */
  districts: number[];
  topColor: THREE.Color;
  height: number;
  lift: number;
  margin: number | null;
}

export interface Detail {
  code: string;
  group: THREE.Group;
  items: TownItem[];
  points: THREE.Vector3[];
  heightScale: number;
  leaving: boolean;
}

type TownFeature = Feature<Polygon | MultiPolygon, { TOWNCODE: string }>;
let townAssets: Promise<{ towns: TownsFile; features: TownFeature[] }> | null = null;

export function loadTownAssets() {
  townAssets ??= Promise.all([loadTowns(), loadTownTopo()]).then(([towns, topo]) => ({
    towns,
    features: feature(topo, topo.objects.towns as GeometryCollection<{ TOWNCODE: string }>).features as TownFeature[],
  }));
  return townAssets;
}

// Town races are built once per county: simulated in the replay, filled from results.json when live.
const townRaceCache = new Map<string, Race[]>();
export function townRacesFor(code: string, towns: TownRecord[]) {
  let races = townRaceCache.get(code);
  if (!races) {
    races = townRaces(county(code), towns, app.source.kind === "replay");
    townRaceCache.set(code, races);
  }
  return races;
}

export async function enterCounty(code: string) {
  if (!sceneOk) { select(code, { byUser: true, noCamera: true }); return; }
  if (app.detail && app.detail.code === code && !app.detail.leaving) return;
  const assets = await loadTownAssets();
  if (app.detail) disposeDetail(app.detail);
  const c = county(code);
  const trng = mulberry32(Number(code) * 7 + 11);
  const group = new THREE.Group();
  scene.add(group);
  const P = projector(code);
  const points: THREE.Vector3[] = [];
  const towns = assets.towns[code] ?? [];
  const races = townRacesFor(code, towns);
  const items = towns.flatMap((t, i): TownItem[] => {
    const f = assets.features.find((ff) => ff.properties.TOWNCODE === t.code);
    if (!f) return [];
    const stack = buildStack(f.geometry, P, { minArea: 0.0004 });
    stack.mesh.userData.town = t.code;
    group.add(stack.mesh);
    points.push(...stack.points);
    const [ax, ay] = labelPoint(stack.biggest);
    const wrap = document.createElement("div");
    const tape = document.createElement("div");
    tape.className = "tape town";
    tape.style.setProperty("--rot", `${(trng() * 4 - 2).toFixed(1)}deg`);
    tape.textContent = t.name;
    wrap.appendChild(tape);
    const label = new CSS2DObject(wrap);
    label.center.set(0.5, 1.15);
    label.position.set(ax, 0.1, -ay);
    group.add(label);
    const districts = c.council.districts
      .map((d, k) => (d.type === "區域" && d.towns.some((tt) => tt.code === t.code) ? k : -1)).filter((k) => k >= 0);
    const { minX, minY, maxX, maxY } = stack.box;
    const item: TownItem = {
      code: t.code, tape, dy: 0, weight: (maxX - minX) * (maxY - minY) * 1000,
      stack, town: t, label, race: races[i], districts,
      topColor: PAPER_C.clone(), height: 0.02, lift: 0, margin: null,
    };
    tape.addEventListener("click", () => clickTown(item));
    hoverFromTape(tape, t.code);
    return [item];
  });
  const box = new THREE.Box3().setFromPoints(points);
  const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const heightScale = Math.min(HEIGHT_SCALE, Math.max(0.35, span * 0.34));   // same relief ratio as the island view
  app.detail = { code, group, items, points, heightScale, leaving: false };
  app.view = "county";
  cam.userMoved = true;
  document.body.classList.add("in-county");
  setInsetsVisible(false);
  $("back").hidden = false;
  select(code, { byUser: true, noCamera: true });
  const target = box.getCenter(new THREE.Vector3()).setY(0);
  const framing = points.flatMap((pt) => [pt, pt.clone().setY(heightScale * 0.75)]);
  const dist = fitFor(framing, target, host.clientWidth < 700 ? 0.9 : 0.8);
  controls.minDistance = dist * 0.4;     // the island limits would stop the camera short of small counties
  controls.maxDistance = dist * 2.5;
  flyTo(target, dist);
  updateLegend();
}

export function exitCounty() {
  const leaving = app.detail;
  if (!leaving || leaving.leaving) return;
  leaving.leaving = true;
  app.view = "island";
  document.body.classList.remove("in-county");
  setInsetsVisible(true);
  $("back").hidden = true;
  setHover(null);
  setIslandLimits();
  flyTo(islandTarget(), islandDistance());
  setTimeout(() => {
    disposeDetail(leaving);
    if (app.detail === leaving) app.detail = null;
    cam.userMoved = false;
  }, reducedMotion ? 0 : 800);
  updateLegend();
}

function disposeDetail(d: Detail) {
  for (const it of d.items) {
    it.label.removeFromParent();
    disposeStack(it.stack);
  }
  scene.remove(d.group);
}

export function clickTown(it: TownItem) {
  if (app.mode === "council" && it.districts.length && app.detail) {
    select(app.detail.code, { byUser: true, noCamera: true, district: it.districts[0] });
  }
}

function seatLeader(ds: District[]) {
  const count: Record<string, number> = {};
  for (const d of ds) for (const j of d.state.top) count[d.candidates[j].party] = (count[d.candidates[j].party] || 0) + 1;
  let best: string | null = null, n = 0;
  for (const [party, m] of Object.entries(count)) if (m > n) { n = m; best = party; }
  return best;
}

const tmpColor = new THREE.Color();

export function updateDetail(k: number) {
  const d = app.detail;
  if (!d) return;
  const c = county(d.code);
  const { mode, hovered } = app;
  for (const it of d.items) {
    app.source.refresh(it.race);
    let turnout = 0, party: string | null = null, done = false;
    if (!d.leaving) {
      if (mode !== "council") {
        const s = it.race.state;
        turnout = turnoutCounted(it.race);
        party = s.top.length ? c.mayor.candidates[s.top[0]].party : null;
        done = s.decided;
        if (mode === "close") it.margin = duelOf(it.race)?.margin ?? null;
      } else {
        const ds = it.districts.map((kk) => c.council.districts[kk]);
        const p = ds.reduce((a, dd) => a + dd.state.p, 0) / Math.max(1, ds.length);
        turnout = (it.town.votesCast * p) / it.town.electors;
        party = seatLeader(ds);
        done = ds.length > 0 && ds.every((dd) => dd.state.decided);
      }
    }
    it.height += (0.02 + turnout * d.heightScale - it.height) * k;
    it.lift += ((hovered === it.code ? 0.04 : 0) - it.lift) * k;
    it.stack.mesh.scale.y = it.height;
    it.stack.mesh.position.y = it.lift;
    if (mode === "close" && !d.leaving) tmpColor.copy(it.margin == null ? PAPER_C : rampColor(it.margin));
    else if (!party) tmpColor.copy(PAPER_C);
    else {
      tmpColor.set(partyOf(party).color);
      if (!done) tmpColor.lerp(PAPER_C, 0.62);
    }
    it.topColor.lerp(tmpColor, k);
    it.stack.caps.color.copy(it.topColor);
    it.stack.caps.emissive.setScalar(hovered === it.code ? 0.08 : 0);
    const u = it.stack.uniforms;
    u.uTop.value = it.height + it.lift;
    u.uBand.value.copy(it.topColor);
    u.uBandMix.value = party ? 1 : 0;
    it.label.position.y = it.height + it.lift + 0.05;
  }
}

export function townTip(it: TownItem) {
  const c = county(app.detail!.code);
  const ms = it.race.state;
  let mayorLine = "尚未開出票數";
  if (ms.top.length && ms.counted) {
    const j = ms.top[0], x = c.mayor.candidates[j];
    mayorLine = `${ms.decided ? "開完" : "領先"}　${x.name}（${partyLabel(x.party)}）${((ms.votes[j] / ms.counted) * 100).toFixed(1)}%`;
  }
  const councilLine = it.districts.map((kk) => {
    const d = c.council.districts[kk];
    return `${districtLabel(d)}・應選 ${d.seats} 席・${d.state.decided ? "當選確定" : `開票 ${(d.state.p * 100).toFixed(0)}%`}`;
  }).join("；");
  return `<b>${it.town.name}</b>　開票 ${(ms.p * 100).toFixed(0)}%`
    + `<br><span class="t-sub">${c.raceLabel.replace("選舉", "")}　${mayorLine}</span>`
    + `<br><span class="t-sub">議員　${councilLine || "選區資料待公布"}</span>`;
}
