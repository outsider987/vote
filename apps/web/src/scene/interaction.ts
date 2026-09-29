import * as THREE from "three";
import { app, scrollMobileTo } from "../app";
import { clickTown, enterCounty } from "./detail";
import { countyView, pickables } from "./island";
import { camera, renderer, sceneOk } from "./stage";

/* Hover and click on stacks and tapes. A code longer than 5 digits is a town. */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt: { x: number; y: number } | null = null;

export function initPointer() {
  if (!sceneOk) return;
  const el = renderer.domElement;
  el.addEventListener("pointermove", (e) => {
    app.pointer.inside = true;
    app.pointer.x = e.clientX;
    app.pointer.y = e.clientY;
  });
  el.addEventListener("pointerleave", () => { app.pointer.inside = false; setHover(null); });
  el.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  el.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;   // a drag, not a click
    const code = pick(e.clientX, e.clientY);
    if (!code) return;
    if (code.length > 5) { const it = townItem(code); if (it) clickTown(it); }
    else enterCounty(code).then(() => scrollMobileTo("board"));
  });
}

export function pick(x: number, y: number): string | null {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const list = app.view === "county" && app.detail ? app.detail.items.map((it) => it.stack.mesh) : pickables;
  const hit = raycaster.intersectObjects(list, false)[0];
  return hit ? (hit.object.userData.town || hit.object.userData.code) ?? null : null;
}

export const townItem = (code: string) => app.detail?.items.find((it) => it.code === code) ?? null;
const tapeOf = (code: string | null) => (!code ? undefined : code.length > 5 ? townItem(code)?.tape : countyView(code)?.tape);

export function setHover(code: string | null) {
  if (app.hovered === code) return;
  tapeOf(app.hovered)?.classList.remove("is-hover");
  app.hovered = code;
  tapeOf(code)?.classList.add("is-hover");
  if (sceneOk) renderer.domElement.style.cursor = code ? "pointer" : "";
}

export function hoverFromTape(tape: HTMLElement, code: string) {
  tape.addEventListener("pointerenter", (e) => { app.pointer.x = e.clientX; app.pointer.y = e.clientY; setHover(code); });
  tape.addEventListener("pointermove", (e) => { app.pointer.x = e.clientX; app.pointer.y = e.clientY; });
  tape.addEventListener("pointerleave", () => setHover(null));
}
