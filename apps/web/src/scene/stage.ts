import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { app } from "../app";
import { $, reducedMotion } from "../dom";

/* Renderer, lights, the desk, and the camera that frames the island or one county. */

export const host = $("scene-canvas");
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
export const viewDir = new THREE.Vector3(-0.06, 0.78, 0.62).normalize();

function createRenderer() {
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  } catch (err) {
    console.error("WebGL unavailable:", err);
    return null;
  }
}

const maybeRenderer = createRenderer();
/** False when WebGL is unavailable: the board, tallies and text view still run without the 3D scene. */
export const sceneOk = maybeRenderer !== null;
export const renderer = maybeRenderer as THREE.WebGLRenderer;
export const labelRenderer = new CSS2DRenderer();
export const controls = sceneOk ? new OrbitControls(camera, renderer.domElement) : (null as unknown as OrbitControls);

type Tween = { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number };
type Fly = { fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3; t0: number; dur: number };

export const cam = {
  baseTarget: new THREE.Vector3(),
  baseDistance: 20,
  /** Coastline samples at the ground and at a typical stack height; the island view keeps them all in frame. */
  framePts: [] as THREE.Vector3[],
  userMoved: false,
  lastInteract: -Infinity,
  tween: null as Tween | null,
  fly: null as Fly | null,
  introStart: null as number | null,
};
export const INTRO_MS = 1600;

export function initStage() {
  if (!sceneOk) {
    host.classList.add("no-webgl");
    host.innerHTML = '<p class="no-webgl-note">這個瀏覽器無法顯示立體圖。右側計票板與「文字版結果」照常更新。</p>';
    return;
  }
  host.appendChild(renderer.domElement);
  Object.assign(labelRenderer.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
  host.appendChild(labelRenderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6ddd9, 1.65));
  const sun = new THREE.DirectionalLight(0xffffff, 1.55);
  sun.position.set(-7, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xf2f6ff, 0.45);
  fill.position.set(8, 6, -6);
  scene.add(fill);

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.11 }));
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);

  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, enablePan: false,
    minPolarAngle: 0.28, maxPolarAngle: 1.12, rotateSpeed: 0.55, zoomSpeed: 0.8,
  });
  controls.addEventListener("start", () => { cam.userMoved = true; cam.lastInteract = performance.now(); });
  controls.addEventListener("end", () => { cam.lastInteract = performance.now(); });
}

/** Called once the island is built and `cam.framePts` / `cam.baseTarget` are known. */
export function startFraming() {
  if (!sceneOk) return;
  controls.target.copy(cam.baseTarget);
  new ResizeObserver(resize).observe(host);
  resize();
}

export function islandTarget() {
  const t = cam.baseTarget.clone();
  if (host.clientWidth > 900) t.x += 0.9;   // leave room for the close-race column
  return t;
}

/** Tape labels hang above their stacks; on phones the top edge needs this much room (px) or they clip. */
const topPad = () => (host.clientWidth < 700 ? 30 : 0);

/**
 * Smallest camera distance along viewDir from `target` that keeps every point inside the frame,
 * with `padTop` pixels kept clear at the top.
 */
export function fitFor(points: THREE.Vector3[], target: THREE.Vector3, margin: number, padTop = topPad()) {
  const top = margin - (padTop * 2) / (host.clientHeight || 1);
  const saved = camera.position.clone();
  const savedQ = camera.quaternion.clone();
  const v = new THREE.Vector3();
  let lo = 1, hi = 300;
  for (let i = 0; i < 26; i++) {
    const d = (lo + hi) / 2;
    camera.position.copy(target).addScaledVector(viewDir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const fits = points.every((p) => {
      v.copy(p).project(camera);
      return Math.abs(v.x) <= margin && v.y <= top && v.y >= -margin;
    });
    if (fits) hi = d; else lo = d;
  }
  camera.position.copy(saved);
  camera.quaternion.copy(savedQ);
  camera.updateMatrixWorld();
  return hi;
}

export const islandDistance = () => fitFor(cam.framePts, islandTarget(), host.clientWidth < 700 ? 0.94 : 0.88);

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = (w || 1) / (h || 1);
  camera.updateProjectionMatrix();
  if (!cam.userMoved) controls.target.copy(islandTarget());
  const d = islandDistance();
  if (!cam.userMoved) camera.position.copy(controls.target).addScaledVector(viewDir, d);
  cam.baseDistance = d;
  if (app.view !== "county") setIslandLimits();
}

export function setIslandLimits() {
  controls.minDistance = cam.baseDistance * 0.4;
  controls.maxDistance = cam.baseDistance * 1.7;
}

/** Nudge the island view toward a county without leaving the overview. */
export function focusCamera(anchor: THREE.Vector3) {
  const to = controls.target.clone().lerp(anchor.clone().setY(0), 0.16);
  cam.tween = { from: controls.target.clone(), to, t0: performance.now(), dur: reducedMotion ? 1 : 550 };
}

export function flyTo(target: THREE.Vector3, dist: number) {
  cam.fly = {
    fromT: controls.target.clone(), toT: target,
    fromP: camera.position.clone(), toP: target.clone().addScaledVector(viewDir, dist),
    t0: performance.now(), dur: reducedMotion ? 1 : 1000,
  };
}

const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
let driftDir = 1;

export function updateCamera(now: number, dt: number, drifting: boolean) {
  if (cam.introStart !== null) {
    const x = easeOutExpo(Math.min(1, (now - cam.introStart) / INTRO_MS));
    const from = new THREE.Vector3(0.02, 1, 0.12).normalize();
    const dir = from.lerp(viewDir, x).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, cam.baseDistance * (1.25 - 0.25 * x));
    camera.lookAt(controls.target);
    if (x >= 1) { cam.introStart = null; controls.enabled = true; }
    return;
  }
  if (cam.fly) {
    const f = cam.fly;
    const x = Math.min(1, (now - f.t0) / f.dur);
    const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    controls.target.lerpVectors(f.fromT, f.toT, e);
    camera.position.lerpVectors(f.fromP, f.toP, e);
    camera.lookAt(controls.target);
    if (x >= 1) cam.fly = null;
    controls.update();
    return;
  }
  if (cam.tween) {
    const t = cam.tween;
    const x = Math.min(1, (now - t.t0) / t.dur);
    const e = 1 - Math.pow(1 - x, 3);
    const next = t.from.clone().lerp(t.to, e);
    camera.position.add(next.clone().sub(controls.target));
    controls.target.copy(next);
    if (x >= 1) cam.tween = null;
  }
  // a slow sway while the count runs and nobody is steering
  if (!reducedMotion && drifting && now - cam.lastInteract > 6000) {
    const off = camera.position.clone().sub(controls.target);
    const az = Math.atan2(off.x, off.z);
    if (az > 0.42) driftDir = -1;
    if (az < -0.2) driftDir = 1;
    off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, driftDir * dt * 0.035);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
}
