import { $, reducedMotion } from "../dom";
import type { CourtRecord, RecordPerson } from "../model/data";
import { guiltyCount, records } from "../model/records";

/* 調閱卷宗: a candidate's public court records as a case file. Tear the seal, scratch off the
   sentence, follow a source link to stamp each exhibit 已查證. Kraft and twine, never stamp red —
   red means a decided race. */

const LETTERS = "ABCDEFGHIJKLMNOP";
const read = new Set<RecordPerson>();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const later = (ms: number, fn: () => void) => window.setTimeout(fn, reducedMotion ? 0 : ms);

/** The kraft tab for a candidate with records, or "" without. `attrs` carries the opener's data attributes. */
export function dossierTab(person: RecordPerson | null, attrs: string, name: string) {
  if (!person) return "";
  const guilty = guiltyCount(person);
  const done = read.has(person) ? '<span class="dossier-read" aria-label="已閱">✓</span>' : "";
  return `<button type="button" class="dossier-tab${guilty ? "" : " is-light"}" ${attrs} aria-label="調閱${esc(name)}的公開司法紀錄卷宗">卷宗${guilty ? `・判決 <b>${guilty}</b>` : ""}${done}</button>`;
}

let dialog: HTMLDialogElement;
let trigger: HTMLElement | null = null;
let cleanup: (() => void) | null = null;

function field(label: string, value: string, masked = false) {
  if (!value) return "";
  const v = masked
    ? `<span class="redact"><span>${esc(value)}</span><canvas aria-hidden="true"></canvas><button class="peel" type="button" aria-label="揭開${label}">揭開</button></span>`
    : esc(value);
  return `<dt>${label}</dt><dd>${v}</dd>`;
}

function exhibit(r: CourtRecord, i: number) {
  const pending = r.type === "indicted";
  const links = [
    r.judgmentUrl ? `<li><a class="primary" href="${esc(r.judgmentUrl)}" target="_blank" rel="noopener noreferrer">${pending ? "裁判書" : "判決書原文"} ↗</a></li>` : "",
    ...r.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.media)} ${esc(s.date)} ↗</a></li>`),
  ].join("");
  return `<li class="exhibit${pending ? " is-pending" : ""}" style="--r:${[-1.4, 1.1, -0.6, 1.6, -1][i % 5]}deg">
    <span class="pin"></span>
    <div class="exhibit-head"><span class="exhibit-no">證物 ${LETTERS[i] ?? i + 1}</span>${pending ? '<span class="pencil">待審</span>' : ""}<span class="exhibit-kind">${pending ? "起訴・未判決" : "有罪判決"}</span></div>
    <dl>
      ${field(pending ? "起訴" : "罪名", r.offense)}
      ${field("案號", r.caseNo)}
      ${field("刑度", r.sentence, !pending)}
      ${field("審級", r.status, !pending)}
    </dl>
    ${pending ? '<p class="presume">檢方起訴的罪名，法院尚未認定。判決確定前推定無罪。</p>' : ""}
    <ul class="exhibit-sources">${links}</ul>
    <span class="verify-stamp" aria-hidden="true">已查證</span>
  </li>`;
}

export function initDossier() {
  dialog = $<HTMLDialogElement>("dossier-view");
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    cleanup?.();
    cleanup = null;
    document.body.classList.remove("platform-open");
    if (trigger?.isConnected) trigger.focus();
    trigger = null;
  });
}

export function openDossier(person: RecordPerson, raceLine: string, opener: HTMLElement) {
  const file = records.file!;
  trigger = opener;
  const guilty = guiltyCount(person), pending = person.records.length - guilty;
  const count = [guilty ? `有罪判決 <b>${guilty}</b> 件` : "", pending ? `起訴未判決 <b>${pending}</b> 件` : ""].filter(Boolean).join("　");
  const source = `<a href="${esc(file.source.url)}" target="_blank" rel="noopener noreferrer">${esc(file.source.name)}</a>`;
  dialog.innerHTML = `<div class="folder">
    <button class="dossier-close" type="button">關閉</button>
    <div class="cover"><div class="cover-face">
      <div class="cover-label">
        <p class="cover-kind">公開司法紀錄・卷宗</p>
        <h2 class="cover-name" id="dossier-title">${esc(person.name)}</h2>
        <p class="cover-race">${esc(raceLine)}</p>
        <p class="cover-count">${count}</p>
      </div>
      <button class="seal" type="button" aria-label="撕開封條，打開卷宗"><span>封</span><span>條</span></button>
      <p class="seal-hint">撕開封條調閱</p>
    </div></div>
    <div class="inside">
      <svg class="twine" aria-hidden="true"></svg>
      <div class="subject"><span class="pin"></span><p class="subject-name">${esc(person.name)}</p><p class="subject-race">${esc(raceLine)}</p><span class="closed-stamp" aria-hidden="true">本案已閱</span></div>
      <ol class="exhibits">${person.records.map(exhibit).join("")}</ol>
      <p class="verify-progress" role="status">已查證 <b class="num verified-count">0</b> / <b class="num">${person.records.length}</b> 件・點開任一來源，該證物即蓋上「已查證」。</p>
      <p class="dossier-note">資料來源：${source}（${esc(file.source.license)}，截至 ${esc(file.asOf)}）。本站未獨立查核，請以判決書原文為準。列名不代表有前科；有罪判決未必已確定，起訴案件判決確定前推定無罪。資料有誤請向原整理者回報。</p>
    </div>
  </div>`;
  dialog.showModal();
  document.body.classList.add("platform-open");

  const cover = dialog.querySelector<HTMLElement>(".cover")!;
  const seal = dialog.querySelector<HTMLButtonElement>(".seal")!;
  seal.focus();
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    seal.classList.add("is-torn");
    later(380, () => cover.classList.add("is-open"));
    later(900, () => { dealExhibits(); dialog.querySelector<HTMLElement>(".exhibit a, .peel")?.focus({ preventScroll: true }); });
    later(1700, () => cover.remove());
  };
  seal.addEventListener("click", open);
  let startX: number | null = null;
  seal.addEventListener("pointerdown", (e) => { startX = e.clientX; });
  seal.addEventListener("pointermove", (e) => { if (startX !== null && Math.abs(e.clientX - startX) > 40) open(); });
  seal.addEventListener("pointerup", () => { startX = null; });
  dialog.querySelector(".dossier-close")!.addEventListener("click", () => dialog.close());

  let verified = 0;
  dialog.querySelectorAll<HTMLElement>(".exhibit").forEach((card) => {
    card.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      a.classList.add("is-visited");
      if (card.classList.contains("is-verified")) return;
      card.classList.add("is-verified");
      dialog.querySelector(".verified-count")!.textContent = String(++verified);
      if (verified === person.records.length) {
        dialog.querySelector(".closed-stamp")!.classList.add("is-on");
        read.add(person);
        if (!trigger?.querySelector(".dossier-read")) trigger?.insertAdjacentHTML("beforeend", '<span class="dossier-read" aria-label="已閱">✓</span>');
      }
    }));
  });

  const redraw = () => drawTwine(false);
  const dealExhibits = () => {
    const cards = [...dialog.querySelectorAll<HTMLElement>(".exhibit")];
    cards.forEach((card, i) => later(140 * i, () => {
      card.classList.add("is-in");
      card.querySelectorAll<HTMLElement>(".redact").forEach(setupScratch);
    }));
    later(140 * cards.length + 350, () => drawTwine(true));
    addEventListener("resize", redraw);
  };
  cleanup = () => removeEventListener("resize", redraw);
}

/** Twine from the subject's pin to each exhibit's pin, running behind the cards. */
function drawTwine(animate: boolean) {
  if (!dialog.open) return;
  const inside = dialog.querySelector<HTMLElement>(".inside")!;
  const svg = dialog.querySelector<SVGSVGElement>(".twine")!;
  const box = inside.getBoundingClientRect();
  const from = dialog.querySelector(".subject .pin")!.getBoundingClientRect();
  const fx = from.left + from.width / 2 - box.left, fy = from.top + from.height / 2 - box.top;
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  svg.innerHTML = [...dialog.querySelectorAll(".exhibit .pin")].map((pin) => {
    const b = pin.getBoundingClientRect();
    const tx = b.left + b.width / 2 - box.left, ty = b.top + b.height / 2 - box.top;
    const sag = Math.abs(tx - fx) > 60 ? 14 : 40;
    return `<path d="M${fx.toFixed(1)},${fy.toFixed(1)} Q${((fx + tx) / 2).toFixed(1)},${(Math.min(fy, ty) + sag).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}"/>`;
  }).join("");
  if (!animate || reducedMotion) return;
  svg.querySelectorAll("path").forEach((path, i) => {
    const len = path.getTotalLength();
    path.animate([{ strokeDasharray: `${len}`, strokeDashoffset: len }, { strokeDasharray: `${len}`, strokeDashoffset: 0 }],
      { duration: 650, delay: 110 * i, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards" });
  });
}

/** Pencil-shaded cover: drag to scratch it off, or press 揭開. */
function setupScratch(wrap: HTMLElement) {
  const canvas = wrap.querySelector("canvas")!;
  const peel = wrap.querySelector<HTMLButtonElement>(".peel")!;
  const dpr = devicePixelRatio || 1;
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#3a4247";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  for (let x = -h; x < w; x += 4) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke(); }
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineWidth = 26;

  let down = false, done = false;
  let last: { x: number; y: number } | null = null;
  const finish = () => {
    if (done) return;
    done = true;
    if (reducedMotion) { wrap.classList.add("is-revealed"); return; }
    canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" }).finished.then(() => wrap.classList.add("is-revealed"));
  };
  const scratch = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(last?.x ?? x, last?.y ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last = { x, y };
  };
  const cleared = () => {
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, n = 0;
    for (let i = 3; i < px.length; i += 64) { n++; if (px[i] === 0) clear++; }
    return clear / n;
  };
  const at = (e: PointerEvent): [number, number] => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  canvas.addEventListener("pointerdown", (e) => { down = true; last = null; canvas.setPointerCapture(e.pointerId); peel.hidden = true; scratch(...at(e)); });
  canvas.addEventListener("pointermove", (e) => { if (down) scratch(...at(e)); });
  canvas.addEventListener("pointerup", () => { down = false; if (cleared() > 0.35) finish(); else peel.hidden = false; });
  peel.addEventListener("click", () => {
    peel.hidden = true;
    // keep keyboard users moving: next cover in this exhibit, else its first source
    const card = wrap.closest(".exhibit")!;
    (card.querySelector<HTMLElement>(".peel:not([hidden])") ?? card.querySelector<HTMLElement>("a"))?.focus({ preventScroll: true });
    if (reducedMotion) { finish(); return; }
    let t = 0;
    last = null;
    const step = () => {
      t++;
      scratch((t / 28) * (w + 24) - 12, h / 2 + Math.sin(t * 1.4) * (h / 2));
      if (t < 28) requestAnimationFrame(step);
      else finish();
    };
    step();
  });
}
