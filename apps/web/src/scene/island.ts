import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { feature } from "topojson-client";
import type { MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { app } from "../app";
import { HEIGHT_SCALE, INSET_SCALE, PAPER, RAMP, RECEDE, SHIFT, partyOf } from "../config";
import { reducedMotion } from "../dom";
import { turnoutCounted } from "../model/analysis";
import type { County } from "../model/types";
import { mulberry32, rankOrder } from "../util";
import { enterCounty } from "./detail";
import { buildStack, labelPoint, projector, type Stack } from "./geo";
import { hoverFromTape } from "./interaction";
import { cam, scene } from "./stage";

/* The island view: one paper stack and one masking-tape label per county. */

export const PAPER_C = new THREE.Color(PAPER);
export const RECEDE_C = new THREE.Color(RECEDE);
const RAMP_C = RAMP.map(([m, c]) => [m, new THREE.Color(c)] as const);
export const rampColor = (margin: number) => (RAMP_C.find(([m]) => margin < m) || [0, PAPER_C])[1];

/** A label the collision pass can move or mute. */
export interface Labeled {
  code: string;
  tape: HTMLElement;
  dy: number;
  /** Placement priority when labels collide (bigger first). */
  weight: number;
}

export interface CountyView extends Labeled {
  county: County;
  stack: Stack;
  label: CSS2DObject;
  anchor: THREE.Vector3;
  topColor: THREE.Color;
  height: number;
  lift: number;
  press: number;
  tapeDecided: boolean | null;
}

const views = new Map<string, CountyView>();
export const countyView = (code: string) => views.get(code)!;
export const pickables: THREE.Object3D[] = [];
/** Kinmen/Matsu frames and notes, hidden in the county view. */
export const insetDecor: THREE.Object3D[] = [];

export function buildIsland(topo: Topology) {
  const rng = mulberry32(20221128);
  const outline: THREE.Vector3[] = [];
  const counties = feature(topo, topo.objects.counties as GeometryCollection<{ COUNTYCODE: string }>).features;
  for (const f of counties) {
    const code = f.properties.COUNTYCODE;
    const c = app.byCode.get(code);
    if (!c) continue;
    const stack = buildStack(f.geometry as Polygon | MultiPolygon, projector(code), { insetScale: SHIFT[code] ? INSET_SCALE : 1 });
    const { minX, minY, maxX, maxY } = stack.box;
    outline.push(...stack.points);
    stack.mesh.userData.code = code;
    scene.add(stack.mesh);
    pickables.push(stack.mesh);

    const [ax, ay] = labelPoint(stack.biggest);
    const wrap = document.createElement("div");
    const tape = document.createElement("div");
    tape.className = "tape";
    tape.style.setProperty("--rot", `${(rng() * 5 - 2.5).toFixed(1)}deg`);
    tape.innerHTML = `<span>${c.name}</span><svg class="mini-stamp" aria-hidden="true"><use href="#stamp"/></svg>`;
    tape.addEventListener("click", () => enterCounty(code));
    hoverFromTape(tape, code);
    wrap.appendChild(tape);
    const label = new CSS2DObject(wrap);
    label.center.set(0.5, 1.15);
    label.position.set(ax, 0.1, -ay);
    scene.add(label);

    const footprint = (maxX - minX) * (maxY - minY);
    views.set(code, {
      code, county: c, stack, label, tape, dy: 0,
      weight: (c.kind === "municipality" ? 1e6 : 0) + footprint * 1000,
      anchor: new THREE.Vector3(ax, 0, -ay),
      topColor: PAPER_C.clone(),
      height: 0.02,
      lift: 0,
      press: 1,
      tapeDecided: false,
    });

    if (SHIFT[code]) {
      const pad = 0.16;
      const x0 = minX - pad, x1 = maxX + pad, z0 = -(maxY + pad), z1 = -(minY - pad);
      const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => new THREE.Vector3(x, 0.004, z));
      const frame = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineDashedMaterial({ color: 0x626c72, dashSize: 0.09, gapSize: 0.07 }));
      frame.computeLineDistances();
      scene.add(frame);
      insetDecor.push(frame);   // the legend explains the dashed frames (示意位置, enlarged ×INSET_SCALE)
    }
  }

  const bounds = new THREE.Box3().setFromPoints(outline);
  cam.baseTarget.copy(bounds.getCenter(new THREE.Vector3()).setY(0));
  cam.framePts = outline.flatMap((p) => [p, p.clone().setY(HEIGHT_SCALE * 0.75)]);
}

export const allCountyViews = () => views.values();

export function markSelectedTape(code: string) {
  for (const v of views.values()) v.tape.classList.toggle("is-selected", v.code === code);
}

/** Force every tape to re-evaluate its decided stamp (after a mode switch). */
export function resetTapes() {
  for (const v of views.values()) v.tapeDecided = null;
}

const tmpColor = new THREE.Color();

export function updateIsland(dt: number) {
  const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
  const { mode, view, detail, hovered } = app;
  for (const v of views.values()) {
    const c = v.county;
    let turnout: number, leaderParty: string | null, decided: boolean;
    if (mode !== "council") {
      const s = c.mayor.state;
      turnout = turnoutCounted(c.mayor);
      leaderParty = s.top.length ? c.mayor.candidates[s.top[0]].party : null;
      decided = s.decided;
    } else {
      const s = c.council.state;
      turnout = s.turnoutCounted;
      leaderParty = s.leaderParty;
      decided = s.complete;
    }
    const open = !!detail && detail.code === c.code && !detail.leaving;
    const away = view === "county" || open;
    if (away) { turnout = 0; leaderParty = null; }
    const target = 0.02 + turnout * HEIGHT_SCALE;
    v.height += (target - v.height) * k;
    v.stack.mesh.visible = !open;
    if (decided && v.tapeDecided === false) v.press = 0;
    if (v.press < 1) v.press = Math.min(1, v.press + dt / 0.45);
    const squash = reducedMotion ? 1 : 1 - 0.07 * Math.sin(Math.PI * v.press);
    const h = v.height * squash;
    v.stack.mesh.scale.y = h;
    v.lift += ((hovered === c.code ? 0.05 : 0) - v.lift) * k;
    v.stack.mesh.position.y = v.lift;

    if (away) tmpColor.copy(RECEDE_C);
    else if (mode === "close") {
      const s = c.mayor.state;
      if (!s.counted || s.votes.length < 2) tmpColor.copy(PAPER_C);
      else { const [a, b] = rankOrder(s.votes); tmpColor.copy(rampColor((s.votes[a] - s.votes[b]) / s.counted)); }
    } else if (!leaderParty) tmpColor.copy(PAPER_C);
    else {
      tmpColor.set(partyOf(leaderParty).color);
      if (!decided) tmpColor.lerp(PAPER_C, 0.62);
    }
    v.topColor.lerp(tmpColor, k);
    v.stack.caps.color.copy(v.topColor);
    v.stack.caps.emissive.setScalar(hovered === c.code ? 0.08 : 0);
    const u = v.stack.uniforms;
    u.uTop.value = h + v.lift;
    u.uBand.value.copy(v.topColor);
    u.uBandMix.value = leaderParty ? 1 : 0;
    v.label.position.y = h + v.lift + 0.06;

    if (v.tapeDecided !== decided) {
      v.tape.classList.toggle("is-decided", decided);
      v.tapeDecided = decided;
    }
  }
}

export function setInsetsVisible(on: boolean) {
  insetDecor.forEach((o) => { o.visible = on; });
}

const overlaps = (a: DOMRectLike, b: DOMRectLike) =>
  a.left < b.right + 2 && a.right > b.left - 2 && a.top < b.bottom + 1 && a.bottom > b.top - 1;
type DOMRectLike = { left: number; right: number; top: number; bottom: number };

/** Nudge colliding labels up or down; mute the ones that still don't fit. */
export function avoidLabelCollisions(active: Iterable<Labeled>) {
  const pinned = (l: Labeled) => l.code === app.selected || l.code === app.hovered;
  const ordered = [...active].sort((a, b) => (pinned(b) ? 1e9 : b.weight) - (pinned(a) ? 1e9 : a.weight));
  // labels also keep clear of the controls floating over the scene
  const placed: DOMRectLike[] = ["text-toggle", "back"].map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el && !el.hidden).map((el) => el.getBoundingClientRect());
  for (const l of ordered) {
    l.tape.classList.remove("is-muted");
    const r = l.tape.getBoundingClientRect();
    const cur = l.dy || 0;
    let chosen: { dy: number; q: DOMRectLike } | null = null;
    for (const dy of [0, -22, 22, -40, 40]) {
      const q = { left: r.left, right: r.right, top: r.top - cur + dy, bottom: r.bottom - cur + dy };
      if (!placed.some((o) => overlaps(q, o))) { chosen = { dy, q }; break; }
    }
    if (!chosen && pinned(l)) chosen = { dy: 0, q: { left: r.left, right: r.right, top: r.top - cur, bottom: r.bottom - cur } };
    if (chosen) {
      if (chosen.dy !== cur) { l.dy = chosen.dy; l.tape.style.setProperty("--dy", `${chosen.dy}px`); }
      placed.push(chosen.q);
    } else l.tape.classList.add("is-muted");
  }
}
