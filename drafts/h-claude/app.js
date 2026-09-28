import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { feature } from "topojson-client";

/* ---------- constants ---------- */

// Party colors: KMT/DPP/TPP validated as a categorical set (all-pairs ΔE ≥ 16, contrast ≥ 3:1 on the board);
// the rest always appear next to their party name.
const PARTIES = {
  "中國國民黨": { key: "kmt", short: "國民黨", color: "#2A52BE" },
  "民主進步黨": { key: "dpp", short: "民進黨", color: "#3B8A2A" },
  "台灣民眾黨": { key: "tpp", short: "民眾黨", color: "#1592B8" },
  "時代力量": { key: "npp", short: "時代力量", color: "#B38700" },
  "無黨籍及未經政黨推薦": { key: "ind", short: "無黨籍", color: "#7A8288" },
};
const OTHER_PARTY = { key: "other", short: "其他政黨", color: "#8067B7" };
const LEGEND = [
  { key: "kmt", name: "國民黨", color: "#2A52BE" },
  { key: "dpp", name: "民進黨", color: "#3B8A2A" },
  { key: "tpp", name: "民眾黨", color: "#1592B8" },
  { key: "npp", name: "時代力量", color: "#B38700" },
  { key: "ind", name: "無黨籍", color: "#7A8288" },
  { key: "other", name: "其他政黨", color: "#8067B7" },
];
const partyOf = (name) => PARTIES[name] || OTHER_PARTY;
const EMBLEMS = { kmt: "../../data/party-emblems/kmt.svg", dpp: "../../data/party-emblems/dpp.svg", tpp: "../../data/party-emblems/tpp.svg" };
Object.values(EMBLEMS).forEach((src) => { new Image().src = src; });
const partyLabel = (name) => (PARTIES[name] ? PARTIES[name].short : name);

// North → south, then east coast, then the outlying islands.
const ORDER = ["10017", "63000", "65000", "68000", "10004", "10018", "10005", "66000", "10007", "10008", "10009",
  "10010", "10020", "67000", "64000", "10013", "10002", "10015", "10014", "10016", "09020", "09007"];
const SHORT = { "10017": "基隆", "63000": "臺北", "65000": "新北", "68000": "桃園", "10004": "竹縣", "10018": "竹市",
  "10005": "苗栗", "66000": "臺中", "10007": "彰化", "10008": "南投", "10009": "雲林", "10010": "嘉縣", "10020": "嘉市",
  "67000": "臺南", "64000": "高雄", "10013": "屏東", "10002": "宜蘭", "10015": "花蓮", "10014": "臺東", "10016": "澎湖",
  "09020": "金門", "09007": "連江" };
// Kinmen and Matsu are drawn closer to Taiwan (labelled 示意位置), shifted in degrees.
const SHIFT = { "09020": [0.95, 0.35], "09007": [-0.1, -0.95] };
const INSET_SCALE = 1.8;   // their footprint is enlarged too (labelled 非等比例)

const MODE_COPY = {
  mayor: {
    height: "<b>紙堆高度</b>＝已開出票數 ÷ 選舉人數，開完即為投票率",
    top: "<b>頂層顏色</b>＝淡色為目前領先、實色並蓋章為當選確定",
    seatOf: "／22",
    seatLabel: "席當選確定",
  },
  close: {
    height: "<b>紙堆高度</b>＝已開出票數 ÷ 選舉人數",
    top: '<b>螢光筆</b>＝縣市長前兩名差距，越深越接近<span class="ramp" aria-hidden="true"><i style="background:#DDA24A"></i><i style="background:#CC873B"></i><i style="background:#B56C2E"></i><i style="background:#975221"></i></span> 20%・10%・5%・2% 以內',
    seatOf: "／22",
    seatLabel: "席當選確定",
  },
  council: {
    height: "<b>紙堆高度</b>＝議員選票已開出票數 ÷ 選舉人數",
    top: "<b>頂層顏色</b>＝席次最多的政黨，淡色為開票中、實色並蓋章為全數確定",
    seatOf: "／910",
    seatLabel: "席確定",
  },
};

const DURATION = 40;           // seconds for 16:00 → 23:30 at 1×
const START_MIN = 16 * 60;
const SPAN_MIN = 7.5 * 60;
const HEIGHT_SCALE = 2.1;      // world units of stack height at 100% turnout
const LON0 = 120.75, LAT0 = 23.8, S = 2.75;
const PAPER = new THREE.Color("#F4F5F3");
// Closeness "highlighter" ramp (validated: one hue, monotone lightness, light end ≥ 2:1 on the board).
const RAMP = [[0.02, "#975221"], [0.05, "#B56C2E"], [0.10, "#CC873B"], [0.20, "#DDA24A"]].map(([m, c]) => [m, new THREE.Color(c)]);
const rampColor = (margin) => (RAMP.find(([m]) => margin < m) || [0, PAPER])[1];
const RECEDE = new THREE.Color("#CBD3CF");   // counties behind an open county fade toward the desk

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let view = "island";        // "island" or "county" (drill-down); read by resize() during boot
let detail = null;          // the open county: { code, group, items, points, heightScale, leaving }
const params = new URLSearchParams(location.search);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const fmt = (n) => Math.round(n).toLocaleString("zh-TW");
const $ = (id) => document.getElementById(id);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function niceUnit(x) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, x))));
  for (const m of [1, 2, 5, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

/* ---------- boot ---------- */

let mayorData, councilData, topo;
try {
  [mayorData, councilData, topo] = await Promise.all([
    fetch("../../data/mayor-2022.json").then((r) => r.json()),
    fetch("../../data/council-2022.json").then((r) => r.json()),
    fetch("../../data/taiwan-atlas-counties-10t.json").then((r) => r.json()),
  ]);
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
} catch (err) {
  $("loading").querySelector("p").textContent = "資料載入失敗，請重新整理頁面";
  throw err;
}

// CEC writes some registered name glyphs as @HEX@ (a CJK compatibility ideograph code point).
// NFC maps it to the standard character so every font can render it.
const decodeName = (name) => name.replace(/@([0-9A-Fa-f]+)@/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)).normalize("NFC"));
for (const c of mayorData.counties) for (const x of c.candidates) x.name = decodeName(x.name);
for (const cc of councilData.counties) for (const d of cc.districts) for (const x of d.candidates) x.name = decodeName(x.name);

/* ---------- replay model ---------- */

// A "race" is one ballot count: a mayor race, or one councilor district (multi-seat).
function makeRace(src, { start, dur, seats, winners, rng }) {
  const sorted = [...src.candidates].sort((a, b) => b.votes - a.votes);
  const cut = sorted[seats - 1] ? sorted[seats - 1].votes : 0;
  const next = sorted[seats] ? sorted[seats].votes : 0;
  return {
    ...src,
    seats,
    start,
    dur,
    winners,
    unit: niceUnit(sorted[0].votes / (seats > 1 ? 40 : 50)),
    amp: (cut - next) / src.valid < 0.05 / seats ? 0.11 : 0.07,
    waves: src.candidates.map(() => [7 + rng() * 12, rng() * 6.283, 15 + rng() * 14, rng() * 6.283]),
    finalVotes: src.candidates.map((x) => x.votes),
    zeros: src.candidates.map(() => 0),
    state: null,
    decidedPrev: false,
  };
}

function raceState(r, T) {
  const x = clamp01((T - r.start) / r.dur);
  const p = x >= 1 ? 1 : 1 - Math.pow(1 - x, 2.3);
  if (p >= 1) return { p: 1, votes: r.finalVotes, counted: r.valid, decided: true, top: r.winners };
  if (p <= 0) return { p: 0, votes: r.zeros, counted: 0, decided: false, top: [] };
  const amp = r.amp * Math.pow(1 - p, 1.3);
  let sum = 0;
  const shares = r.candidates.map((cand, j) => {
    const f = cand.votes / r.valid;
    const [w1, p1, w2, p2] = r.waves[j];
    const s = Math.max(0.0003, f + amp * (Math.sin(w1 * T + p1) * 0.6 + Math.sin(w2 * T + p2) * 0.4) * Math.sqrt(f));
    sum += s;
    return s;
  });
  const total = r.valid * p;
  const votes = shares.map((s) => Math.round((total * s) / sum));
  const top = votes.map((v, j) => j).sort((a, b) => votes[b] - votes[a]).slice(0, r.seats);
  return { p, votes, counted: votes.reduce((a, b) => a + b, 0), decided: false, top };
}

const rng = mulberry32(20221126);
const logE = mayorData.counties.map((c) => Math.log(c.electors));
const logMin = Math.min(...logE), logMax = Math.max(...logE);

const counties = mayorData.counties.map((c) => {
  const size = (Math.log(c.electors) - logMin) / (logMax - logMin);
  const start = 0.012 + rng() * 0.06;
  const dur = Math.min(0.955 - start, 0.2 + 0.64 * Math.pow(size, 1.15) + rng() * 0.08);
  const winner = c.candidates.findIndex((x) => x.elected);
  return {
    ...makeRace(c, { start, dur, seats: 1, winners: [winner], rng }),
    short: SHORT[c.code],
    race: c.type === "county" ? "縣長選舉" : "市長選舉",
    winner,
  };
});
const byCode = new Map(counties.map((c) => [c.code, c]));

// Councilor ballots are counted after the mayor ballots at each polling station, so they start later.
const crng = mulberry32(20221127);
const allDistricts = councilData.counties.flatMap((cc) => cc.districts);
const dLog = allDistricts.map((d) => Math.log(d.electors));
const dLogMin = Math.min(...dLog), dLogMax = Math.max(...dLog);
for (const cc of councilData.counties) {
  const c = byCode.get(cc.code);
  const districts = cc.districts.map((d) => {
    const size = (Math.log(d.electors) - dLogMin) / (dLogMax - dLogMin);
    const start = Math.min(0.45, c.start + 0.05 + crng() * 0.06);
    const dur = Math.min(0.985 - start, 0.26 + 0.6 * Math.pow(size, 1.1) + crng() * 0.08);
    const winners = d.candidates.map((x, j) => (x.elected ? j : -1)).filter((j) => j >= 0);
    return makeRace(d, { start, dur, seats: d.seats, winners, rng: crng });
  });
  c.council = {
    kind: cc.kind,
    seats: cc.seats,
    districts,
    finalTurnout: (districts.reduce((a, d) => a + d.votesCast, 0) / districts.reduce((a, d) => a + d.electors, 0)) * 100,
    state: null,
    completePrev: false,
  };
}

function councilAggregate(c) {
  const cn = c.council;
  let psum = 0, wsum = 0, cast = 0, electors = 0, decidedSeats = 0;
  const decided = {}, combined = {};
  for (const d of cn.districts) {
    const s = d.state;
    psum += s.p * d.valid; wsum += d.valid; cast += d.votesCast * s.p; electors += d.electors;
    if (s.decided) decidedSeats += d.seats;
    for (const j of s.top) {
      const party = d.candidates[j].party;
      combined[party] = (combined[party] || 0) + 1;
      if (s.decided) decided[party] = (decided[party] || 0) + 1;
    }
  }
  let leaderParty = null, best = 0;
  for (const [party, n] of Object.entries(combined)) if (n > best) { best = n; leaderParty = party; }
  return { p: psum / wsum, turnoutCounted: cast / electors, decidedSeats, decided, leaderParty, complete: decidedSeats === cn.seats };
}

/* ---------- three.js scene ---------- */

const host = $("scene-canvas");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
Object.assign(labelRenderer.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
host.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

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

const mercY = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const Y0 = mercY(LAT0);

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Approximate pole of inaccessibility: the interior point farthest from any edge.
function labelPoint(rings) {
  const outer = rings[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  let best = [(minX + maxX) / 2, (minY + maxY) / 2], bestD = -1;
  const N = 26;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = [minX + ((maxX - minX) * i) / N, minY + ((maxY - minY) * j) / N];
    if (!pointInRing(p, outer) || rings.slice(1).some((h) => pointInRing(p, h))) continue;
    let d = Infinity;
    for (const r of rings) for (let k = 0, l = r.length - 1; k < r.length; l = k++) d = Math.min(d, distToSeg(p[0], p[1], r[l], r[k]));
    if (d > bestD) { bestD = d; best = p; }
  }
  return best;
}

function makeSideMaterial() {
  const uniforms = {
    uTop: { value: 0.05 },
    uBand: { value: new THREE.Color("#ffffff") },
    uBandMix: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xf6f7f5, roughness: 0.93, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWY;\nuniform float uTop;\nuniform vec3 uBand;\nuniform float uBandMix;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float seam = 1.0 - smoothstep(0.02, 0.2, fract(vWY / 0.09));
        diffuseColor.rgb *= 1.0 - 0.18 * seam;
        diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(0.0, 0.3, vWY));
        float band = smoothstep(uTop - 0.055, uTop - 0.04, vWY);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBand, band * uBandMix);`);
  };
  m.userData.uniforms = uniforms;
  return m;
}

function projector(code) {
  const [dLon, dLat] = SHIFT[code] || [0, 0];
  return ([lon, lat]) => [(lon + dLon - LON0) * S, (mercY(lat + dLat) - Y0) * S];
}

// Extrude one TopoJSON geometry into a paper stack of height 1 (scaled per frame).
function buildStack(geometry, P, { insetScale = 1, minArea = 0.003 } = {}) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let projected = polys.map((poly) => poly.map((ring) => {
    const pts = ring.map(P);
    const a = pts[0], b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
    return pts;
  }));
  if (insetScale !== 1) {
    // enlarge each island around its own centre, keeping the islands' spacing
    projected = projected.map((rings) => {
      const xs = rings[0].map((pt) => pt[0]), ys = rings[0].map((pt) => pt[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return rings.map((ring) => ring.map(([x, y]) => [cx + (x - cx) * insetScale, cy + (y - cy) * insetScale]));
    });
  }
  const areas = projected.map((rings) => Math.abs(ringArea(rings[0])));
  const maxArea = Math.max(...areas);
  const shapes = [], points = [];
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let biggest = null, biggestArea = 0;
  projected.forEach((rings, i) => {
    const area = areas[i];
    if (area < minArea && area !== maxArea) return;   // drop small islets
    if (area > biggestArea) { biggestArea = area; biggest = rings; }
    for (const [x, y] of rings[0]) {
      box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
    }
    const shape = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of rings.slice(1)) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    shapes.push(shape);
    for (let k = 0; k < rings[0].length; k += 6) points.push(new THREE.Vector3(rings[0][k][0], 0, -rings[0][k][1]));
  });
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const caps = new THREE.MeshStandardMaterial({ color: PAPER.clone(), roughness: 0.96, metalness: 0 });
  const sides = makeSideMaterial();
  const mesh = new THREE.Mesh(geo, [caps, sides]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.y = 0.02;
  return { mesh, caps, sides, biggest, box, points };
}

const stacks = new THREE.Group();
scene.add(stacks);
const insetDecor = [];   // Kinmen/Matsu frames and notes, hidden in the county view
const pickables = [];
const outline = [];   // sampled coastline points, used to frame the camera

for (const f of feature(topo, topo.objects.counties).features) {
  const code = f.properties.COUNTYCODE;
  const c = byCode.get(code);
  if (!c) continue;
  const { mesh, caps, sides, biggest, box, points } = buildStack(f.geometry, projector(code), { insetScale: SHIFT[code] ? INSET_SCALE : 1 });
  const { minX, minY, maxX, maxY } = box;
  outline.push(...points);
  mesh.userData.code = code;
  stacks.add(mesh);
  pickables.push(mesh);

  const [ax, ay] = labelPoint(biggest);
  const wrap = document.createElement("div");
  const tape = document.createElement("div");
  tape.className = "tape";
  tape.style.setProperty("--rot", `${(rng() * 5 - 2.5).toFixed(1)}deg`);
  tape.innerHTML = `<span>${c.name}</span><svg class="mini-stamp" aria-hidden="true"><use href="#stamp"/></svg>`;
  tape.addEventListener("click", () => enterCounty(code));
  tape.addEventListener("pointerenter", (e) => { pointerClient = { x: e.clientX, y: e.clientY }; setHover(code); });
  tape.addEventListener("pointermove", (e) => { pointerClient = { x: e.clientX, y: e.clientY }; });
  tape.addEventListener("pointerleave", () => setHover(null));
  wrap.appendChild(tape);
  const label = new CSS2DObject(wrap);
  label.center.set(0.5, 1.15);
  label.position.set(ax, 0.1, -ay);
  scene.add(label);

  Object.assign(c, {
    mesh, caps, sides, label, tape,
    anchor: new THREE.Vector3(ax, 0, -ay),
    footprint: (maxX - minX) * (maxY - minY),
    topColor: PAPER.clone(),
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
    insetDecor.push(frame);
    const note = document.createElement("span");
    note.className = "inset-note";
    note.textContent = "示意位置・島嶼放大 1.8 倍";
    const noteObj = new CSS2DObject(note);
    noteObj.center.set(0, -0.25);
    noteObj.position.set(x0, 0, z1);
    scene.add(noteObj);
    insetDecor.push(noteObj);
  }
}

/* ---------- camera & controls ---------- */

const bounds = new THREE.Box3().setFromPoints(outline);
const center = bounds.getCenter(new THREE.Vector3()).setY(0);
const framePts = outline.flatMap((p) => [p, p.clone().setY(HEIGHT_SCALE * 0.75)]);
const viewDir = new THREE.Vector3(-0.06, 0.78, 0.62).normalize();
const baseTarget = center.clone();
let baseDistance = 20;

const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.08, enablePan: false,
  minPolarAngle: 0.28, maxPolarAngle: 1.12, rotateSpeed: 0.55, zoomSpeed: 0.8,
});
controls.target.copy(baseTarget);

function islandTarget() {
  const t = baseTarget.clone();
  if (host.clientWidth > 900) t.x += 0.9;   // leave room for the close-race column
  return t;
}

// Smallest camera distance along viewDir from `target` that keeps every point inside the frame.
function fitFor(points, target, margin) {
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
      return Math.abs(v.x) <= margin && Math.abs(v.y) <= margin;
    });
    if (fits) hi = d; else lo = d;
  }
  camera.position.copy(saved);
  camera.quaternion.copy(savedQ);
  camera.updateMatrixWorld();
  return hi;
}

function fitDistance() {
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!userMoved) controls.target.copy(islandTarget());
  return fitFor(framePts, islandTarget(), w < 700 ? 0.94 : 0.88);
}

let userMoved = false;
let lastInteract = -Infinity;
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  const d = fitDistance();
  if (!userMoved) camera.position.copy(controls.target).addScaledVector(viewDir, d);
  baseDistance = d;
  if (view !== "county") {
    controls.minDistance = d * 0.4;
    controls.maxDistance = d * 1.7;
  }
}
controls.addEventListener("start", () => { userMoved = true; lastInteract = performance.now(); });
controls.addEventListener("end", () => { lastInteract = performance.now(); });
new ResizeObserver(resize).observe(host);
resize();

/* ---------- state ---------- */

let mode = params.get("mode") === "council" ? "council" : "mayor";
let T = 0;
let lastT = 0;
let playing = true;
let speed = 1;
let selected = params.has("c") && byCode.has(params.get("c")) ? params.get("c") : "63000";
let selectedDistrict = Number(params.get("d")) || 0;
let follow = !params.has("c");
let lastFollowSwitch = -Infinity;
let pendingFollow = null;
let hovered = null;

/* ---------- interaction ---------- */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerInside = false;
let pointerClient = { x: 0, y: 0 };
let downAt = null;

renderer.domElement.addEventListener("pointermove", (e) => {
  pointerInside = true;
  pointerClient = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener("pointerleave", () => { pointerInside = false; setHover(null); });
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  const code = pick(e.clientX, e.clientY);
  if (!code) return;
  if (code.length > 5) { const it = townItem(code); if (it) clickTown(it); }
  else enterCounty(code);
});

function pick(x, y) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const list = view === "county" && detail ? detail.items.map((it) => it.mesh) : pickables;
  const hit = raycaster.intersectObjects(list, false)[0];
  return hit ? hit.object.userData.town || hit.object.userData.code : null;
}

const townItem = (code) => (detail ? detail.items.find((it) => it.code === code) : null);
const tapeOf = (code) => (code && code.length > 5 ? townItem(code)?.tape : byCode.get(code)?.tape);
function setHover(code) {
  if (hovered === code) return;
  tapeOf(hovered)?.classList.remove("is-hover");
  hovered = code;
  tapeOf(code)?.classList.add("is-hover");
  renderer.domElement.style.cursor = code ? "pointer" : "";
}

function partySummary(counts, limit = 4) {
  const grouped = {};
  for (const [party, n] of Object.entries(counts)) {
    const key = partyOf(party).key;
    grouped[key] = (grouped[key] || 0) + n;
  }
  return LEGEND.filter((l) => grouped[l.key]).sort((a, b) => grouped[b.key] - grouped[a.key])
    .slice(0, limit).map((l) => `${l.name} ${grouped[l.key]}`).join("・");
}

const tip = $("scene-tip");
function updateTip() {
  if (!hovered) { tip.hidden = true; return; }
  const c = byCode.get(hovered);
  let html;
  if (hovered.length > 5) {
    const it = townItem(hovered);
    if (!it) { tip.hidden = true; return; }
    html = townTip(it);
  } else if (mode !== "council") {
    const s = c.state;
    let line = "尚未開出票數";
    if (s.top.length) {
      const j = s.top[0], x = c.candidates[j];
      const pct = s.counted ? ((s.votes[j] / s.counted) * 100).toFixed(2) : "0.00";
      line = `${s.decided ? "當選" : "領先"}　${x.name}（${partyLabel(x.party)}）${pct}%`;
    }
    html = `<b>${c.name}</b>　開票 ${(s.p * 100).toFixed(1)}%<br><span class="t-sub">${line}</span>`;
    if (mode === "close" && s.counted) {
      const [a, b] = rankOrder(s.votes);
      html += `<br><span class="t-sub">前兩名差 ${fmt(s.votes[a] - s.votes[b])} 票（${(((s.votes[a] - s.votes[b]) / s.counted) * 100).toFixed(2)}%）</span>`;
    }
  } else {
    const s = c.council.state;
    const parties = partySummary(s.decided, 3);
    html = `<b>${c.name}議員</b>　開票 ${(s.p * 100).toFixed(1)}%<br><span class="t-sub">已確定 ${s.decidedSeats}／${c.council.seats} 席${parties ? "・" + parties : ""}</span>`;
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const r = $("scene").getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(pointerClient.x - r.left + 14, r.width - w - 8))}px`;
  tip.style.top = `${Math.max(8, Math.min(pointerClient.y - r.top + 14, r.height - h - 8))}px`;
}

const floatTip = $("float-tip");
function showFloat(el, html) {
  const r = el.getBoundingClientRect();
  floatTip.innerHTML = html;
  floatTip.hidden = false;
  floatTip.style.left = `${Math.min(Math.max(r.left + r.width / 2, 140), innerWidth - 140)}px`;
  floatTip.style.top = `${r.top}px`;
}
const hideFloat = () => { floatTip.hidden = true; };

function select(code, { byUser = false, district = null, noCamera = false } = {}) {
  if (byUser && view === "county" && detail && code !== detail.code) {
    enterCounty(code).then(() => { if (district !== null) select(code, { byUser: true, noCamera: true, district }); });
    return;
  }
  if (byUser) {
    follow = false;
    $("follow").checked = false;
    if (!noCamera && view === "island") focusCamera(byCode.get(code));
  }
  const changed = selected !== code;
  selected = code;
  if (district !== null) selectedDistrict = district;
  else if (changed) selectedDistrict = 0;
  counties.forEach((c) => c.tape.classList.toggle("is-selected", c.code === code));
  seatEls.forEach((el, k) => el.classList.toggle("is-selected", ORDER[k] === code));
  renderBoard();
}

$("follow").addEventListener("change", (e) => {
  follow = e.target.checked;
  if (follow) lastFollowSwitch = -Infinity;
});

let camTween = null;
function focusCamera(c) {
  const to = controls.target.clone().lerp(c.anchor.clone().setY(0), 0.16);
  camTween = { from: controls.target.clone(), to, t0: performance.now(), dur: reducedMotion ? 1 : 550 };
}

/* ---------- mode ---------- */

function setMode(next) {
  mode = next;
  document.querySelectorAll(".mode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  const copy = MODE_COPY[mode];
  updateLegend();
  $("seat-of").textContent = copy.seatOf;
  $("seat-label").textContent = copy.seatLabel;
  document.body.classList.remove("mode-mayor", "mode-council", "mode-close");
  document.body.classList.add(`mode-${mode}`);
  $("close-panel").hidden = mode !== "close";
  if (mode === "close") ensureTownBoard();
  $("seats").hidden = mode === "council";
  $("seatbar").hidden = mode !== "council";
  $("council-panel").hidden = mode !== "council";
  clearCallouts();
  clearDuels();
  $("cr-note").textContent = duelCfg().note;
  counties.forEach((c) => { c.tapeDecided = null; });
  renderNational.last = null;
  renderBoard();
  if (!textView.hidden) renderText();
}
document.querySelectorAll(".mode button").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.mode !== mode) setMode(b.dataset.mode);
}));


/* ---------- 縣市細節 county drill-down ---------- */

let townAssets = null;
let camFly = null;

function loadTownAssets() {
  if (!townAssets) {
    townAssets = Promise.all([
      fetch("../../data/mayor-2022-towns.json").then((r) => r.json()),
      fetch("../../data/taiwan-atlas-towns-10t.json").then((r) => r.json()),
    ]).then(([towns, topoTowns]) => ({ towns, features: feature(topoTowns, topoTowns.objects.towns).features }));
  }
  return townAssets;
}

// Town replay: the county's candidates with this town's real votes, finishing no later than the county.
const townRaceCache = new Map();
function townRacesFor(code, towns) {
  if (!townRaceCache.has(code)) {
    const c = byCode.get(code);
    const rr = mulberry32(Number(code) * 13 + 5);
    townRaceCache.set(code, towns.map((t) => {
      const winner = c.candidates.reduce((best, x, j) => ((t.votes[x.no] || 0) > (t.votes[c.candidates[best].no] || 0) ? j : best), 0);
      const start = c.start + rr() * 0.03;
      return makeRace(
        { name: t.name, code: t.code, valid: t.valid, candidates: c.candidates.map((x) => ({ ...x, votes: t.votes[x.no] || 0 })) },
        { start, dur: Math.max(0.05, (c.start + c.dur - start) * (0.82 + rr() * 0.18)), seats: 1, winners: [winner], rng: rr });
    }));
  }
  return townRaceCache.get(code);
}

function flyTo(target, dist) {
  camFly = {
    fromT: controls.target.clone(), toT: target,
    fromP: camera.position.clone(), toP: target.clone().addScaledVector(viewDir, dist),
    t0: performance.now(), dur: reducedMotion ? 1 : 1000,
  };
}

async function enterCounty(code) {
  if (detail && detail.code === code && !detail.leaving) return;
  const assets = await loadTownAssets();
  if (detail) disposeDetail(detail);
  const c = byCode.get(code);
  const trng = mulberry32(Number(code) * 7 + 11);
  const group = new THREE.Group();
  scene.add(group);
  const P = projector(code);
  const points = [];
  const items = assets.towns[code].map((t) => {
    const f = assets.features.find((ff) => ff.properties.TOWNCODE === t.code);
    const built = buildStack(f.geometry, P, { minArea: 0.0004 });
    built.mesh.userData.town = t.code;
    group.add(built.mesh);
    points.push(...built.points);
    const [ax, ay] = labelPoint(built.biggest);
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
    const race = townRacesFor(code, assets.towns[code])[assets.towns[code].indexOf(t)];
    const districts = c.council.districts
      .map((d, k) => (d.type === "區域" && d.towns.some((tt) => tt.code === t.code) ? k : -1)).filter((k) => k >= 0);
    const item = { ...built, town: t, code: t.code, label, tape, race, districts, topColor: PAPER.clone(), height: 0.02, lift: 0 };
    tape.addEventListener("click", () => clickTown(item));
    tape.addEventListener("pointerenter", (e) => { pointerClient = { x: e.clientX, y: e.clientY }; setHover(t.code); });
    tape.addEventListener("pointermove", (e) => { pointerClient = { x: e.clientX, y: e.clientY }; });
    tape.addEventListener("pointerleave", () => setHover(null));
    return item;
  });
  const box = new THREE.Box3().setFromPoints(points);
  const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const heightScale = Math.min(HEIGHT_SCALE, Math.max(0.35, span * 0.34));   // same relief ratio as the island view
  detail = { code, group, items, points, heightScale, leaving: false };
  view = "county";
  userMoved = true;
  document.body.classList.add("in-county");
  insetDecor.forEach((o) => { o.visible = false; });
  $("back").hidden = false;
  select(code, { byUser: true, noCamera: true });
  const target = box.getCenter(new THREE.Vector3()).setY(0);
  if (host.clientWidth > 900) target.x += (box.max.x - box.min.x) * 0.16;
  const framing = points.flatMap((pt) => [pt, pt.clone().setY(heightScale * 0.75)]);
  const dist = fitFor(framing, target, host.clientWidth < 700 ? 0.9 : 0.8);
  controls.minDistance = dist * 0.4;     // the island limits would stop the camera short of small counties
  controls.maxDistance = dist * 2.5;
  flyTo(target, dist);
  updateLegend();
}

function exitCounty() {
  if (!detail || detail.leaving) return;
  const leaving = detail;
  leaving.leaving = true;
  view = "island";
  document.body.classList.remove("in-county");
  insetDecor.forEach((o) => { o.visible = true; });
  $("back").hidden = true;
  setHover(null);
  controls.minDistance = baseDistance * 0.4;
  controls.maxDistance = baseDistance * 1.7;
  flyTo(islandTarget(), fitFor(framePts, islandTarget(), host.clientWidth < 700 ? 0.94 : 0.88));
  setTimeout(() => {
    disposeDetail(leaving);
    if (detail === leaving) detail = null;
    userMoved = false;
  }, reducedMotion ? 0 : 800);
  updateLegend();
}

function disposeDetail(d) {
  for (const it of d.items) {
    it.label.removeFromParent();
    it.mesh.geometry.dispose();
    it.caps.dispose();
    it.sides.dispose();
  }
  scene.remove(d.group);
}

function clickTown(it) {
  if (mode === "council" && it.districts.length) select(detail.code, { byUser: true, noCamera: true, district: it.districts[0] });
}

function seatLeader(ds) {
  const count = {};
  for (const d of ds) for (const j of d.state.top) count[d.candidates[j].party] = (count[d.candidates[j].party] || 0) + 1;
  let best = null, n = 0;
  for (const [party, m] of Object.entries(count)) if (m > n) { n = m; best = party; }
  return best;
}

function updateDetail(k) {
  const d = detail;
  if (!d) return;
  const c = byCode.get(d.code);
  for (const it of d.items) {
    it.race.state = raceState(it.race, T);
    let turnout = 0, party = null, done = false;
    if (!d.leaving) {
      if (mode !== "council") {
        const s = it.race.state;
        turnout = (it.town.votesCast * s.p) / it.town.electors;
        party = s.top.length ? c.candidates[s.top[0]].party : null;
        done = s.decided;
        if (mode === "close") it.margin = s.counted ? (() => { const [a, b] = rankOrder(s.votes); return (s.votes[a] - s.votes[b]) / s.counted; })() : null;
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
    it.mesh.scale.y = it.height;
    it.mesh.position.y = it.lift;
    if (mode === "close" && !d.leaving) tmpColor.copy(it.margin == null ? PAPER : rampColor(it.margin));
    else if (!party) tmpColor.copy(PAPER);
    else {
      tmpColor.set(partyOf(party).color);
      if (!done) tmpColor.lerp(PAPER, 0.62);
    }
    it.topColor.lerp(tmpColor, k);
    it.caps.color.copy(it.topColor);
    it.caps.emissive.setScalar(hovered === it.code ? 0.08 : 0);
    const u = it.sides.userData.uniforms;
    u.uTop.value = it.height + it.lift;
    u.uBand.value.copy(it.topColor);
    u.uBandMix.value = party ? 1 : 0;
    it.label.position.y = it.height + it.lift + 0.05;
  }
}

function townTip(it) {
  const c = byCode.get(detail.code);
  const ms = it.race.state || raceState(it.race, T);
  let mayorLine = "尚未開出票數";
  if (ms.top.length) {
    const j = ms.top[0], x = c.candidates[j];
    mayorLine = `${ms.decided ? "開完" : "領先"}　${x.name}（${partyLabel(x.party)}）${((ms.votes[j] / ms.counted) * 100).toFixed(1)}%`;
  }
  const councilLine = it.districts.map((kk) => {
    const d = c.council.districts[kk];
    return `${districtLabel(d)}・應選 ${d.seats} 席・${d.state.decided ? "當選確定" : `開票 ${(d.state.p * 100).toFixed(0)}%`}`;
  }).join("；");
  return `<b>${it.town.name}</b>　開票 ${(ms.p * 100).toFixed(0)}%`
    + `<br><span class="t-sub">${c.race.replace("選舉", "")}　${mayorLine}</span>`
    + `<br><span class="t-sub">議員　${councilLine}</span>`;
}

function updateLegend() {
  const copy = MODE_COPY[mode];
  const inCounty = view === "county";
  $("legend-height").innerHTML = inCounty
    ? (mode !== "council" ? "<b>鄉鎮紙堆</b>＝各區已開出票數 ÷ 選舉人數" : "<b>鄉鎮紙堆</b>＝所屬選區開票進度 × 該區投票率")
    : copy.height;
  $("legend-top").innerHTML = inCounty
    ? (mode === "close" ? copy.top : mode === "mayor" ? "<b>頂層顏色</b>＝該區領先的候選人政黨，開完變實色" : "<b>頂層顏色</b>＝所屬議員選區席次最多的政黨，全數確定後變實色")
    : copy.top;
}

/* ---------- national tally ---------- */

const seatsEl = $("seats");
const seatEls = ORDER.map((code) => {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "seat";
  b.textContent = SHORT[code];
  b.addEventListener("click", () => select(code, { byUser: true }));
  b.addEventListener("pointerenter", () => showFloat(b, b.getAttribute("aria-label")));
  b.addEventListener("pointerleave", hideFloat);
  li.appendChild(b);
  seatsEl.appendChild(li);
  return b;
});

function renderNational() {
  const tally = Object.fromEntries(LEGEND.map((l) => [l.key, 0]));
  let decided = 0;
  if (mode !== "council") {
    ORDER.forEach((code, k) => {
      const c = byCode.get(code), s = c.state, el = seatEls[k];
      if (s.decided) {
        decided++;
        const w = c.candidates[c.winner];
        const p = partyOf(w.party);
        tally[p.key]++;
        if (!el.classList.contains("is-decided")) {
          el.classList.add("is-decided");
          el.style.setProperty("--c", p.color);
        }
        el.setAttribute("aria-label", `${c.name}：${w.name}（${partyLabel(w.party)}）當選`);
      } else {
        el.classList.remove("is-decided");
        el.setAttribute("aria-label", `${c.name}：開票中 ${(s.p * 100).toFixed(0)}%`);
      }
    });
  } else {
    for (const c of counties) {
      const s = c.council.state;
      decided += s.decidedSeats;
      for (const [party, n] of Object.entries(s.decided)) tally[partyOf(party).key] += n;
    }
  }
  const total = mode === "council" ? 910 : 22;
  $("seat-decided").textContent = decided;
  const always = new Set(["kmt", "dpp", "tpp"]);
  const items = LEGEND.filter((l) => always.has(l.key) || tally[l.key] > 0)
    .map((l) => `<li><i class="chip" style="--c:${l.color}"></i>${l.name}<b>${tally[l.key]}</b></li>`);
  if (decided < total) items.push(`<li><i class="chip pending"></i>開票中<b>${total - decided}</b></li>`);
  const html = items.join("");
  if (html !== renderNational.last) {
    $("party-totals").innerHTML = html;
    renderNational.last = html;
    if (mode === "council") {
      $("seatbar").innerHTML = LEGEND.filter((l) => tally[l.key] > 0)
        .map((l) => `<span style="--c:${l.color};--n:${tally[l.key]}"></span>`).join("")
        + (decided < total ? `<span class="pending" style="--n:${total - decided}"></span>` : "");
    }
  }
}

/* ---------- 計票板 ---------- */

const board = { race: null, rows: [], groups: [], tabs: [] };
const STROKES = [[3, 4, 19, 4], [11, 4, 11, 19], [11, 11.5, 17, 11.5], [5.5, 11, 5.5, 19], [2, 19, 20, 19]];
const SVGNS = "http://www.w3.org/2000/svg";

function strokePath(seed, j, k) {
  const r = mulberry32(seed * 7919 + j * 131 + k * 17 + 3);
  const [x1, y1, x2, y2] = STROKES[k % 5];
  const ox = Math.floor(k / 5) * 26;
  const jx = () => (r() - 0.5) * 1.3;
  const ax = x1 + ox + jx(), ay = y1 + jx(), bx = x2 + ox + jx(), by = y2 + jx();
  const mx = (ax + bx) / 2 + (r() - 0.5) * 1.4, my = (ay + by) / 2 + (r() - 0.5) * 1.4;
  return `M${ax.toFixed(1)} ${ay.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

const indigenousShort = (d) => (d.type === "平地原住民" ? "平原" : "山原");
const districtLabel = (d) => (d.type === "區域" ? `第${d.no}選區` : `第${d.no}選區・${indigenousShort(d)}`);
const districtShort = (d) => (d.type === "區域" ? d.no : `${d.no}${indigenousShort(d)}`);

function renderRows(race, seed) {
  $("unit").innerHTML = `每一劃＝<b class="num">${fmt(race.unit)}</b> 票`;
  $("rows").innerHTML = race.candidates.map((x, j) => {
    const p = partyOf(x.party);
    const cells = Math.max(1, Math.ceil(Math.floor(x.votes / race.unit) / 5));
    const photo = x.photo ? `<div class="photo"><img src="${x.photo}" alt="${x.name}"></div>` : "";
    return `<li class="row${x.photo ? " has-photo" : ""}" data-j="${j}" style="--c:${p.color}">
      ${photo}
      <div class="who"><span class="no" aria-label="${x.no} 號">${x.no}</span><span class="name">${x.name}</span>
        <span class="party"><i class="chip" style="--c:${p.color}"></i>${partyLabel(x.party)}</span><span class="won">當選</span><span class="quota">婦女保障</span><svg class="row-stamp" aria-hidden="true"><use href="#stamp"/></svg></div>
      <div class="nums"><span class="votes num">0</span><span class="pct num">0.00%</span></div>
      <svg class="tally" viewBox="0 0 ${cells * 26} 24" width="${cells * 26}" height="24" aria-hidden="true"></svg>
    </li>`;
  }).join("");
  board.race = race;
  board.rows = [...$("rows").children].map((li) => ({
    li, j: Number(li.dataset.j), seed,
    votes: li.querySelector(".votes"),
    pct: li.querySelector(".pct"),
    svg: li.querySelector(".tally"),
    strokes: 0,
    max: Math.floor(race.candidates[Number(li.dataset.j)].votes / race.unit),
  }));
  board.order = orderOf(race, race.state ? race.state.votes : race.zeros);
  placeRows(board.order, false);
  board.lastReorder = 0;
  board.lastRows = null;
}

// Rows follow the current vote ranking (ties keep ballot order); moves animate with FLIP.
function orderOf(race, votes) {
  return race.candidates.map((_, j) => j).sort((a, b) => votes[b] - votes[a] || race.candidates[a].no - race.candidates[b].no);
}

function placeRows(order, animate) {
  const list = $("rows");
  const before = animate ? new Map(board.rows.map((r) => [r.j, r.li.getBoundingClientRect().top])) : null;
  for (const j of order) list.appendChild(board.rows[j].li);
  if (!animate) return;
  for (const row of board.rows) {
    const dy = before.get(row.j) - row.li.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    row.li.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" });
  }
}

function updateRows(initial) {
  const race = board.race, s = race.state;
  const key = `${s.p}|${s.counted}`;
  if (key === board.lastRows) return;
  board.lastRows = key;
  const winners = new Set(s.decided ? race.winners : []);
  const inSeat = new Set(s.decided ? [] : s.top);
  board.rows.forEach((row) => {
    const v = s.votes[row.j];
    const cand = race.candidates[row.j];
    row.votes.textContent = fmt(v);
    row.pct.textContent = `${s.counted ? ((v / s.counted) * 100).toFixed(2) : "0.00"}%`;
    row.li.classList.toggle(race.seats > 1 ? "in-seat" : "is-leading", inSeat.has(row.j));
    row.li.classList.toggle("is-won", winners.has(row.j));
    row.li.classList.toggle("is-quota", winners.has(row.j) && !!cand.womenQuota);
    const want = Math.min(row.max, Math.floor(v / race.unit));
    while (row.strokes < want) {
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", strokePath(row.seed, row.j, row.strokes));
      path.setAttribute("pathLength", "20");
      if (!initial && !reducedMotion) path.classList.add("draw");
      row.svg.appendChild(path);
      row.strokes++;
    }
    while (row.strokes > want) {
      row.svg.lastChild.remove();
      row.strokes--;
    }
  });
  const now = performance.now();
  if (initial || now - board.lastReorder > 350) {
    const order = orderOf(race, s.votes);
    if (order.join() !== board.order.join()) {
      placeRows(order, !initial && !reducedMotion);
      board.order = order;
      board.lastReorder = now;
    }
  }
}

function renderBoard() {
  const c = byCode.get(selected);
  const idx = counties.indexOf(c);
  $("board-county").textContent = c.name;
  $("st-progress-label").textContent = "開票進度";
  $("st-turnout-label").textContent = "投票率";
  if (mode === "close") {
    $("board-county").textContent = "選情最接近";
    $("board-race").textContent = "即時排名";
    $("st-progress-label").textContent = "縣市長差 5% 內";
    $("st-mid-label").textContent = "議員最後一席差 1% 內";
    $("st-turnout-label").textContent = "鄉鎮差 5% 內";
    renderCloseList(true);
    return;
  }
  if (mode === "mayor") {
    $("board-race").textContent = c.race;
    $("st-mid-label").textContent = "已開出票數";
    renderRows(c, idx);
  } else {
    const cn = c.council;
    selectedDistrict = Math.min(selectedDistrict, cn.districts.length - 1);
    const d = cn.districts[selectedDistrict];
    $("board-race").textContent = `${cn.kind}選舉`;
    $("st-mid-label").textContent = "已確定席次";
    $("council-seats").innerHTML = cn.districts.map((dd, k) => `
      <button type="button" class="seat-group${k === selectedDistrict ? " is-active" : ""}" data-k="${k}" aria-label="${districtLabel(dd)}，應選 ${dd.seats} 席">
        <span class="gl">${districtShort(dd)}</span>
        <span class="dots">${Array.from({ length: dd.seats }, () => '<i class="seat-dot"></i>').join("")}</span>
      </button>`).join("");
    board.groups = [...$("council-seats").children].map((el, k) => {
      el.addEventListener("click", () => select(c.code, { byUser: true, district: k }));
      el.addEventListener("pointerenter", () => {
        const dd = cn.districts[k], s = dd.state;
        showFloat(el, `<b>${districtLabel(dd)}</b>　應選 ${dd.seats} 席<br>${s.decided ? "當選確定" : `開票 ${(s.p * 100).toFixed(1)}%`}`);
      });
      el.addEventListener("pointerleave", hideFloat);
      return { el, dots: [...el.querySelectorAll(".seat-dot")], decided: null };
    });
    $("district-tabs").innerHTML = cn.districts.map((dd, k) =>
      `<button type="button" role="tab" class="district-tab" aria-selected="${k === selectedDistrict}" data-k="${k}">${districtLabel(dd)}・${dd.seats} 席</button>`).join("");
    board.tabs = [...$("district-tabs").children];
    board.tabs.forEach((el, k) => el.addEventListener("click", () => select(c.code, { byUser: true, district: k })));
    const active = board.tabs[selectedDistrict];
    const strip = $("district-tabs");
    strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2;
    const towns = d.towns.map((t) => t.name);
    const townText = towns.length > 5 ? `${towns.slice(0, 5).join("、")}等 ${towns.length} 區` : towns.join("、");
    $("district-head").innerHTML = `<b>${d.name}</b>${townText ? `（${townText}）` : ""}・應選 <b>${d.seats}</b> 席`;
    renderRows(d, idx * 100 + selectedDistrict);
  }
  board.lastStats = null;
  updateBoard(true);
}

function updateBoard(initial = false) {
  const c = byCode.get(selected);
  if (mode === "close") { renderCloseList(false); return; }
  if (mode === "mayor") {
    const s = c.state;
    const key = `${s.p}|${s.counted}`;
    if (key !== board.lastStats) {
      board.lastStats = key;
      $("st-progress").textContent = `${(s.p * 100).toFixed(1)}%`;
      $("st-counted").textContent = fmt(s.counted);
      $("st-turnout").textContent = s.decided ? `${c.turnout.toFixed(2)}%` : "開票中";
    }
  } else {
    const cn = c.council, s = cn.state;
    const key = `${s.p}|${s.decidedSeats}`;
    if (key !== board.lastStats) {
      board.lastStats = key;
      $("st-progress").textContent = `${(s.p * 100).toFixed(1)}%`;
      $("st-counted").textContent = `${s.decidedSeats}／${cn.seats}`;
      $("st-turnout").textContent = s.complete ? `${cn.finalTurnout.toFixed(2)}%` : "開票中";
    }
    cn.districts.forEach((d, k) => {
      const g = board.groups[k];
      if (!g || g.decided === d.state.decided) return;
      g.decided = d.state.decided;
      board.tabs[k].classList.toggle("is-done", g.decided);
      const ordered = g.decided ? [...d.winners].sort((a, b) => d.candidates[b].votes - d.candidates[a].votes) : [];
      g.dots.forEach((dot, i) => {
        const j = ordered[i];
        dot.classList.toggle("is-filled", j !== undefined);
        dot.classList.toggle("is-quota", j !== undefined && !!d.candidates[j].womenQuota);
        dot.style.setProperty("--c", j !== undefined ? partyOf(d.candidates[j].party).color : "transparent");
      });
    });
  }
  updateRows(initial);
}

/* ---------- 當選確定 callout ---------- */

const calloutQueue = [];
let calloutBusyUntil = 0;
let calloutTimer = null;

function enqueueCallout(item) {
  calloutQueue.push({ ...item, at: performance.now() });
}

function clearCallouts() {
  calloutQueue.length = 0;
  calloutBusyUntil = 0;
  clearTimeout(calloutTimer);
  $("callout").classList.remove("is-on");
}

function pumpCallouts(now) {
  if (now < calloutBusyUntil || !calloutQueue.length) return;
  while (calloutQueue.length > 1 && now - calloutQueue[0].at > 5000) calloutQueue.shift();
  const item = calloutQueue.shift();
  const dur = Math.round(2400 / Math.sqrt(speed));
  const el = $("callout");
  el.classList.remove("is-on");
  void el.offsetWidth;
  el.style.setProperty("--dur", `${dur}ms`);
  el.querySelector(".callout-band").style.setProperty("--c", item.color);
  el.classList.toggle("is-winner", !!item.party);
  if (item.party) {
    const key = partyOf(item.party).key;
    const label = partyLabel(item.party);
    $("callout-emblem").innerHTML = EMBLEMS[key]
      ? `<img src="${EMBLEMS[key]}" alt="">`
      : `<div class="seal" style="--c:${item.color};--seal-size:${label.length <= 3 ? 42 : label.length <= 5 ? 32 : 24}px">${label}</div>`;
  }
  $("callout-label").textContent = item.label;
  $("callout-name").textContent = item.name;
  $("callout-meta").innerHTML = item.meta;
  el.classList.add("is-on");
  $("announcer").textContent = `${item.label}：${item.name}，${item.plain}`;
  clearTimeout(calloutTimer);
  calloutTimer = setTimeout(() => el.classList.remove("is-on"), dur);
  calloutBusyUntil = now + dur + 150;
}


/* ---------- 拉鋸戰 close races ---------- */

// Mayor: leader vs runner-up. Councilor: the last seat (rank N) vs the first loser (rank N+1).
const CLOSE = {
  mayor: { threshold: 0.04, scale: 0.05, flip: "領先易主", note: "指針刻度 ±5 個百分點", empty: "目前沒有差距在 4% 以內的縣市長戰局。" },
  council: { threshold: 0.015, scale: 0.02, flip: "排名互換", note: "指針刻度 ±2 個百分點", empty: "目前沒有最後一席差距在 1.5% 以內的選區。" },
};
const crList = $("cr-list");
const duelCfg = () => CLOSE[mode === "council" ? "council" : "mayor"];   // the 最接近 mode uses the mayor settings
let duels = [];
let lastDuelPick = -Infinity;

const rankOrder = (votes) => votes.map((v, j) => j).sort((x, y) => votes[y] - votes[x]);

function pickDuels() {
  const cfg = duelCfg(), out = [];
  const consider = (race, code, district, key) => {
    const s = race.state;
    if (s.p < 0.12 || s.decided || race.candidates.length <= race.seats) return;
    const order = rankOrder(s.votes);
    const a = order[race.seats - 1], b = order[race.seats];
    const m = (s.votes[a] - s.votes[b]) / Math.max(1, s.counted);
    if (m < cfg.threshold) out.push({ key, code, district, race, a, b, m });
  };
  for (const c of counties) {
    if (mode !== "council") consider(c, c.code, null, `m:${c.code}`);
    else c.council.districts.forEach((d, k) => consider(d, c.code, k, `c:${d.id}`));
  }
  return out.sort((x, y) => x.m - y.m).slice(0, 3);
}

function createDuel(pick, now) {
  const { race, a, b } = pick;
  const A = race.candidates[a], B = race.candidates[b];
  const pa = partyOf(A.party), pb = partyOf(B.party);
  const c = byCode.get(pick.code);
  const place = pick.district === null ? `${c.name}・${c.race.replace("選舉", "")}` : `${c.name} ${districtLabel(race)}`;
  const side = (cand, p, cls) => `<span class="cr-side ${cls}"><span class="cr-name">${cand.name}</span>`
    + `<span class="cr-party"><i class="chip" style="--c:${p.color}"></i>${partyLabel(cand.party)}</span><span class="cr-v num">0</span></span>`;
  const li = document.createElement("li");
  li.className = "cr-card";
  li.style.setProperty("--ca", pa.color);
  li.style.setProperty("--cb", pb.color);
  li.innerHTML = `<button type="button" class="cr-btn" aria-label="${place}：${A.name} 對 ${B.name}">
      <span class="cr-top"><span class="cr-place">${place}</span><span class="cr-tag"></span></span>
      <span class="cr-names">${side(A, pa, "a")}${side(B, pb, "b")}</span>
      <span class="cr-gauge" aria-hidden="true"><i class="cr-track"></i><i class="cr-fill"></i><i class="cr-zero"></i><i class="cr-knot"></i></span>
      <span class="cr-foot"><span class="cr-gap num"></span><span class="cr-prog"></span></span>
    </button>`;
  li.querySelector("button").addEventListener("click", () => select(pick.code, { byUser: true, district: pick.district }));
  crList.appendChild(li);
  const q = (sel) => li.querySelector(sel);
  return {
    ...pick, mode: mode === "council" ? "council" : "mayor", el: li, colors: [pa.color, pb.color], stage: pick.district === null ? "" : "最後一席・",
    vA: q(".cr-side.a .cr-v"), vB: q(".cr-side.b .cr-v"), nA: q(".cr-side.a .cr-name"), nB: q(".cr-side.b .cr-name"),
    gap: q(".cr-gap"), prog: q(".cr-prog"), tag: q(".cr-tag"),
    bornAt: now, lastSign: 0, flipUntil: 0, finalAt: 0, leaving: false,
  };
}

function retireDuel(d) {
  if (d.leaving) return;
  d.leaving = true;
  d.el.classList.add("is-leaving");
  setTimeout(() => { d.el.remove(); duels = duels.filter((x) => x !== d); }, 420);
}

function clearDuels() {
  duels.forEach((d) => d.el.remove());
  duels = [];
  lastDuelPick = -Infinity;
}

function refreshDuels(now) {
  if (now - lastDuelPick < 1500) return;
  lastDuelPick = now;
  const picks = pickDuels();
  const keys = new Set(picks.map((pk) => pk.key));
  for (const d of duels) {
    if (!d.leaving && !d.finalAt && !keys.has(d.key) && now - d.bornAt > 3500) retireDuel(d);
  }
  for (const pk of picks) {
    const active = duels.filter((d) => !d.leaving);
    if (active.length >= 3) break;
    if (!active.some((d) => d.key === pk.key)) duels.push(createDuel(pk, now));
  }
  const any = duels.some((d) => !d.leaving);
  $("cr-empty").textContent = any ? "" : (T <= 0.02 ? "開票開始後，差距最小的戰局會出現在這裡。" : duelCfg().empty);
}

function updateDuels(now) {
  for (const d of duels) {
    if (d.leaving) continue;
    const s = d.race.state;
    const va = s.votes[d.a], vb = s.votes[d.b];
    const m = (va - vb) / Math.max(1, s.counted);
    const pos = Math.max(-1, Math.min(1, m / CLOSE[d.mode].scale));
    const x = 50 - pos * 50;                  // the knot moves toward whoever leads (A left, B right)
    d.el.style.setProperty("--x", `${x.toFixed(2)}%`);
    d.el.style.setProperty("--fl", `${Math.min(x, 50).toFixed(2)}%`);
    d.el.style.setProperty("--fr", `${(100 - Math.max(x, 50)).toFixed(2)}%`);
    d.el.style.setProperty("--fc", va >= vb ? d.colors[0] : d.colors[1]);
    d.vA.textContent = fmt(va);
    d.vB.textContent = fmt(vb);
    d.nA.classList.toggle("is-ahead", va > vb);
    d.nB.classList.toggle("is-ahead", vb > va);
    d.gap.textContent = `差 ${fmt(Math.abs(va - vb))} 票`;
    d.prog.textContent = s.decided ? `${d.stage}開票完成` : `${d.stage}開票 ${(s.p * 100).toFixed(0)}%`;
    const sign = Math.sign(va - vb);
    if (sign && d.lastSign && sign !== d.lastSign && !d.finalAt) {
      d.tag.textContent = CLOSE[d.mode].flip;
      d.el.classList.remove("is-flip");
      void d.el.offsetWidth;
      d.el.classList.add("is-flip");
      d.flipUntil = now + 1500;
    }
    if (sign) d.lastSign = sign;
    if (d.flipUntil && now > d.flipUntil) { d.el.classList.remove("is-flip"); d.flipUntil = 0; if (!d.finalAt) d.tag.textContent = ""; }
    if (s.decided && !d.finalAt) {
      d.finalAt = now;
      d.tag.textContent = "確定";
      d.el.classList.remove("is-flip");
      d.el.classList.add("is-final");
    }
    if (d.finalAt && now - d.finalAt > 2600) retireDuel(d);
  }
}


/* ---------- 最接近 closest-races leaderboard ---------- */

let closeTab = "mayor";
let closeRows = new Map();      // key → row refs
let closeOrder = [];
let lastCloseCalc = 0;
let townBoard = null;           // [{ code, county, race, name }] once town data is loaded

function ensureTownBoard() {
  if (townBoard) return;
  loadTownAssets().then((assets) => {
    if (townBoard) return;
    townBoard = counties.flatMap((c) => townRacesFor(c.code, assets.towns[c.code])
      .map((race) => ({ code: race.code, county: c.code, race, name: `${c.name} ${race.name}` })));
    if (mode === "close") renderCloseList(true);
  });
}

document.querySelectorAll(".close-tabs .district-tab").forEach((b) => b.addEventListener("click", () => {
  closeTab = b.dataset.tab;
  document.querySelectorAll(".close-tabs .district-tab").forEach((o) => o.setAttribute("aria-selected", String(o === b)));
  ensureTownBoard();
  renderCloseList(true);
}));

function duelOf(race, s, seats) {
  if (!s.counted || race.candidates.length <= seats) return null;
  const order = rankOrder(s.votes);
  const a = order[seats - 1], b = order[seats];
  return { a, b, gap: s.votes[a] - s.votes[b], margin: (s.votes[a] - s.votes[b]) / s.counted };
}

function closeEntries(tab) {
  const out = [];
  if (tab === "mayor") {
    for (const c of counties) {
      const du = duelOf(c, c.state, 1);
      if (du) out.push({ key: `m:${c.code}`, code: c.code, place: c.name, sub: c.race.replace("選舉", ""), race: c, s: c.state, ...du });
    }
  } else if (tab === "council") {
    for (const c of counties) c.council.districts.forEach((d, k) => {
      const du = duelOf(d, d.state, d.seats);
      if (du) out.push({ key: `c:${d.id}`, code: c.code, district: k, place: `${c.name} ${districtLabel(d)}`, sub: `最後一席・應選 ${d.seats}`, race: d, s: d.state, ...du });
    });
  } else if (townBoard) {
    for (const t of townBoard) {
      t.race.state = raceState(t.race, T);
      const du = duelOf(t.race, t.race.state, 1);
      if (du) out.push({ key: `t:${t.code}`, code: t.county, town: t.code, place: t.name, sub: byCode.get(t.county).race.replace("選舉", ""), race: t.race, s: t.race.state, ...du });
    }
  }
  return out.sort((x, y) => x.margin - y.margin);
}

function closeCounts() {
  const n = (tab, lim) => closeEntries(tab).filter((e) => e.margin < lim).length;
  $("st-progress").textContent = `${n("mayor", 0.05)} 場`;
  $("st-counted").textContent = `${n("council", 0.01)} 區`;
  $("st-turnout").textContent = townBoard ? `${n("town", 0.05)} 區` : "—";
}

function renderCloseList(force) {
  const now = performance.now();
  if (!force && now - lastCloseCalc < 500) return;
  lastCloseCalc = now;
  const list = $("close-list");
  if (force) { list.innerHTML = ""; closeRows = new Map(); closeOrder = []; }
  const entries = closeEntries(closeTab).slice(0, 15);
  $("close-note").textContent = closeTab === "town" && !townBoard ? "正在載入鄉鎮資料…"
    : entries.length ? "依目前差距由小到大排列，點選可查看該地區" : "開票開始後，差距最小的地方會列在這裡";
  const keys = new Set(entries.map((e) => e.key));
  for (const [key, row] of closeRows) if (!keys.has(key)) { row.li.remove(); closeRows.delete(key); }
  for (const e of entries) {
    let row = closeRows.get(e.key);
    const samePair = row && ((row.a === e.a && row.b === e.b) || (row.a === e.b && row.b === e.a));
    if (row && !samePair) { row.li.remove(); closeRows.delete(e.key); row = null; }
    if (!row) row = createCloseRow(e);
    const A = e.race.candidates[row.a], B = e.race.candidates[row.b];
    const va = e.s.votes[row.a], vb = e.s.votes[row.b];
    const m = (va - vb) / e.s.counted;
    const x = 50 - Math.max(-1, Math.min(1, m / 0.05)) * 50;
    row.li.style.setProperty("--x", `${x.toFixed(2)}%`);
    row.li.style.setProperty("--fl", `${Math.min(x, 50).toFixed(2)}%`);
    row.li.style.setProperty("--fr", `${(100 - Math.max(x, 50)).toFixed(2)}%`);
    row.li.style.setProperty("--fc", va >= vb ? partyOf(A.party).color : partyOf(B.party).color);
    row.nA.classList.toggle("is-ahead", va > vb);
    row.nB.classList.toggle("is-ahead", vb > va);
    row.gap.textContent = `差 ${fmt(Math.abs(va - vb))} 票`;
    row.pct.textContent = `${(Math.abs(m) * 100).toFixed(2)}%`;
    row.status.textContent = e.s.decided ? "確定" : `開票 ${(e.s.p * 100).toFixed(0)}%`;
    row.status.classList.toggle("is-final", e.s.decided);
  }
  const order = entries.map((e) => e.key);
  if (order.join() !== closeOrder.join()) {
    const before = new Map([...closeRows].filter(([, r]) => r.li.isConnected).map(([k, r]) => [k, r.li.getBoundingClientRect().top]));
    order.forEach((k, i) => { const r = closeRows.get(k); r.rank.textContent = i + 1; list.appendChild(r.li); });
    if (!force && !reducedMotion) for (const [k, r] of closeRows) {
      if (!before.has(k)) continue;
      const dy = before.get(k) - r.li.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) r.li.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)" });
    }
    closeOrder = order;
  }
  closeCounts();
}

function createCloseRow(e) {
  const A = e.race.candidates[e.a], B = e.race.candidates[e.b];
  const pa = partyOf(A.party), pb = partyOf(B.party);
  const li = document.createElement("li");
  li.style.setProperty("--ca", pa.color);
  li.style.setProperty("--cb", pb.color);
  li.innerHTML = `<button type="button" class="cl-row" style="--ca:${pa.color};--cb:${pb.color}">
      <span class="cl-rank"></span>
      <span class="cl-place">${e.place}<small>${e.sub}</small><small class="cl-status"></small></span>
      <span class="cl-gap"><b class="cl-v"></b><span class="cl-pct num"></span></span>
      <span class="cl-duel">
        <span class="cl-name a"><i class="chip" style="--c:${pa.color}"></i>${A.name}</span>
        <span class="cl-gauge" aria-hidden="true"><i class="cr-track"></i><i class="cr-fill"></i><i class="cr-zero"></i><i class="cr-knot"></i></span>
        <span class="cl-name b">${B.name}<i class="chip" style="--c:${pb.color}"></i></span>
      </span>
    </button>`;
  li.querySelector("button").addEventListener("click", () => openCloseEntry(e));
  const q = (sel) => li.querySelector(sel);
  const row = { li, a: e.a, b: e.b, rank: q(".cl-rank"), gap: q(".cl-v"), pct: q(".cl-pct"), nA: q(".cl-name.a"), nB: q(".cl-name.b"), status: q(".cl-status") };
  closeRows.set(e.key, row);
  return row;
}

function openCloseEntry(e) {
  if (e.district !== undefined) {
    setMode("council");
    enterCounty(e.code).then(() => select(e.code, { byUser: true, noCamera: true, district: e.district }));
  } else {
    setMode("mayor");
    enterCounty(e.code).then(() => {
      const tape = e.town && townItem(e.town)?.tape;
      if (tape) { tape.classList.remove("is-flash"); void tape.offsetWidth; tape.classList.add("is-flash"); }
    });
  }
}

/* ---------- text view ---------- */

const textView = $("text-view");
function openText(open) {
  textView.hidden = !open;
  $("text-toggle").setAttribute("aria-expanded", String(open));
  if (open) { renderText(); $("text-close").focus(); } else { $("text-toggle").focus(); }
}
$("text-toggle").addEventListener("click", () => openText(textView.hidden));
$("text-close").addEventListener("click", () => openText(false));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!textView.hidden) openText(false);
  else if (view === "county") exitCounty();
});
$("back").addEventListener("click", exitCounty);

function renderText() {
  if (mode !== "council") {
    $("text-head").innerHTML = `<tr><th scope="col">縣市</th><th scope="col">開票進度</th><th scope="col">領先或當選</th><th scope="col">得票率</th><th scope="col">狀態</th></tr>`;
    $("text-rows").innerHTML = ORDER.map((code) => {
      const c = byCode.get(code), s = c.state;
      if (!s.top.length) return `<tr><td>${c.name}</td><td class="n">0.0%</td><td>尚未開出</td><td class="n">—</td><td>開票中</td></tr>`;
      const j = s.top[0], x = c.candidates[j];
      const pct = ((s.votes[j] / s.counted) * 100).toFixed(2);
      return `<tr><td>${c.name}</td><td class="n">${(s.p * 100).toFixed(1)}%</td><td>${x.name}（${partyLabel(x.party)}）</td><td class="n">${pct}%</td><td class="${s.decided ? "status-won" : ""}">${s.decided ? "當選確定" : "開票中"}</td></tr>`;
    }).join("");
  } else {
    $("text-head").innerHTML = `<tr><th scope="col">縣市</th><th scope="col">開票進度</th><th scope="col">已確定席次</th><th scope="col">已確定各黨席次</th><th scope="col">狀態</th></tr>`;
    $("text-rows").innerHTML = ORDER.map((code) => {
      const c = byCode.get(code), s = c.council.state;
      return `<tr><td>${c.name}</td><td class="n">${(s.p * 100).toFixed(1)}%</td><td class="n">${s.decidedSeats}／${c.council.seats}</td><td>${partySummary(s.decided, 6) || "—"}</td><td class="${s.complete ? "status-won" : ""}">${s.complete ? "全數確定" : "開票中"}</td></tr>`;
    }).join("");
  }
}

/* ---------- playback ---------- */

const playBtn = $("play");
const scrub = $("scrub");

function setPlaying(on) {
  playing = on;
  playBtn.classList.toggle("is-paused", !on);
  playBtn.setAttribute("aria-label", on ? "暫停" : "播放");
}
playBtn.addEventListener("click", () => {
  if (!playing && T >= 1) { T = 0; clearCallouts(); }
  setPlaying(!playing);
});
$("replay").addEventListener("click", () => { T = 0; clearCallouts(); setPlaying(true); });
document.querySelectorAll(".speed button").forEach((b) => b.addEventListener("click", () => {
  speed = Number(b.dataset.speed);
  document.querySelectorAll(".speed button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
}));
scrub.addEventListener("input", () => { T = scrub.value / 1000; clearCallouts(); });
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || ["INPUT", "BUTTON", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  e.preventDefault();
  playBtn.click();
});

function clockText(t) {
  const m = Math.round(START_MIN + t * SPAN_MIN);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/* ---------- intro ---------- */

const startT = params.has("t") ? clamp01(Number(params.get("t"))) : null;
const introOn = startT === null && params.get("intro") !== "0" && !reducedMotion;
let introStart = null;
const INTRO_MS = 1600;
if (startT !== null) { T = startT; lastT = T; setPlaying(false); }

/* ---------- frame loop ---------- */

const timer = new THREE.Timer();
let frameNo = 0;
const tmpColor = new THREE.Color();
const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

function updateModel() {
  const forward = playing && T > lastT && T - lastT < 0.02;
  for (const c of counties) {
    c.state = raceState(c, T);
    if (c.state.decided && !c.decidedPrev && mode !== "council") {
      if (follow && mode === "mayor") pendingFollow = { code: c.code };
      if (forward) {
        const w = c.candidates[c.winner], p = partyOf(w.party);
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
    c.decidedPrev = c.state.decided;

    const cn = c.council;
    cn.districts.forEach((d, k) => {
      d.state = raceState(d, T);
      if (d.state.decided && !d.decidedPrev && mode === "council" && follow) pendingFollow = { code: c.code, district: k };
      d.decidedPrev = d.state.decided;
    });
    cn.state = councilAggregate(c);
    if (cn.state.complete && !cn.completePrev && mode === "council" && forward) {
      const lead = partyOf(cn.state.leaderParty);
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
  lastT = T;
  if (follow && pendingFollow && performance.now() - lastFollowSwitch > 3200) {
    select(pendingFollow.code, { district: pendingFollow.district ?? null });
    pendingFollow = null;
    lastFollowSwitch = performance.now();
  }
}

function updateScene(dt) {
  const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
  for (const c of counties) {
    let turnout, leaderParty, decided;
    if (mode !== "council") {
      const s = c.state;
      turnout = (c.votesCast * s.p) / c.electors;
      leaderParty = s.top.length ? c.candidates[s.top[0]].party : null;
      decided = s.decided;
    } else {
      const s = c.council.state;
      turnout = s.turnoutCounted;
      leaderParty = s.leaderParty;
      decided = s.complete;
    }
    const away = view === "county" || (detail && detail.code === c.code && !detail.leaving);
    if (away) { turnout = 0; leaderParty = null; }
    const target = 0.02 + turnout * HEIGHT_SCALE;
    c.height += (target - c.height) * k;
    c.mesh.visible = !(detail && detail.code === c.code && !detail.leaving);
    if (decided && c.tapeDecided === false) c.press = 0;
    if (c.press < 1) c.press = Math.min(1, c.press + dt / 0.45);
    const squash = reducedMotion ? 1 : 1 - 0.07 * Math.sin(Math.PI * c.press);
    const h = c.height * squash;
    c.mesh.scale.y = h;
    c.lift += ((hovered === c.code ? 0.05 : 0) - c.lift) * k;
    c.mesh.position.y = c.lift;

    if (away) tmpColor.copy(RECEDE);
    else if (mode === "close") {
      const s = c.state;
      if (!s.counted) tmpColor.copy(PAPER);
      else { const [a, b] = rankOrder(s.votes); tmpColor.copy(rampColor((s.votes[a] - s.votes[b]) / s.counted)); }
    } else if (!leaderParty) tmpColor.copy(PAPER);
    else {
      tmpColor.set(partyOf(leaderParty).color);
      if (!decided) tmpColor.lerp(PAPER, 0.62);
    }
    c.topColor.lerp(tmpColor, k);
    c.caps.color.copy(c.topColor);
    c.caps.emissive.setScalar(hovered === c.code ? 0.08 : 0);
    const u = c.sides.userData.uniforms;
    u.uTop.value = h + c.lift;
    u.uBand.value.copy(c.topColor);
    u.uBandMix.value = leaderParty ? 1 : 0;
    c.label.position.y = h + c.lift + 0.06;

    if (c.tapeDecided !== decided) {
      c.tape.classList.toggle("is-decided", decided);
      c.tapeDecided = decided;
    }
  }
}

const overlaps = (a, b) => a.left < b.right + 2 && a.right > b.left - 2 && a.top < b.bottom + 1 && a.bottom > b.top - 1;
function avoidLabelCollisions() {
  const active = view === "county" && detail ? detail.items : counties;
  const ordered = [...active].sort((a, b) => priority(b) - priority(a));
  const placed = [];
  for (const c of ordered) {
    const pinned = c.code === selected || c.code === hovered;
    c.tape.classList.remove("is-muted");
    const r = c.tape.getBoundingClientRect();
    const cur = c.dy || 0;
    let chosen = null;
    for (const dy of [0, -22, 22, -40, 40]) {
      const q = { left: r.left, right: r.right, top: r.top - cur + dy, bottom: r.bottom - cur + dy };
      if (!placed.some((o) => overlaps(q, o))) { chosen = { dy, q }; break; }
    }
    if (!chosen && pinned) chosen = { dy: 0, q: { left: r.left, right: r.right, top: r.top - cur, bottom: r.bottom - cur } };
    if (chosen) {
      if (chosen.dy !== cur) { c.dy = chosen.dy; c.tape.style.setProperty("--dy", `${chosen.dy}px`); }
      placed.push(chosen.q);
    } else c.tape.classList.add("is-muted");
  }
}
function priority(c) {
  if (c.code === selected || c.code === hovered) return 1e9;
  if (c.town) return (c.box.maxX - c.box.minX) * (c.box.maxY - c.box.minY) * 1000;
  return (c.type === "municipality" ? 1e6 : 0) + c.footprint * 1000;
}

function updateCamera(now, dt) {
  if (introStart !== null) {
    const x = easeOutExpo(Math.min(1, (now - introStart) / INTRO_MS));
    const from = new THREE.Vector3(0.02, 1, 0.12).normalize();
    const dir = from.lerp(viewDir, x).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, baseDistance * (1.25 - 0.25 * x));
    camera.lookAt(controls.target);
    if (x >= 1) { introStart = null; controls.enabled = true; }
    return;
  }
  if (camFly) {
    const x = Math.min(1, (now - camFly.t0) / camFly.dur);
    const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    controls.target.lerpVectors(camFly.fromT, camFly.toT, e);
    camera.position.lerpVectors(camFly.fromP, camFly.toP, e);
    camera.lookAt(controls.target);
    if (x >= 1) camFly = null;
    controls.update();
    return;
  }
  if (camTween) {
    const x = Math.min(1, (now - camTween.t0) / camTween.dur);
    const e = 1 - Math.pow(1 - x, 3);
    const next = camTween.from.clone().lerp(camTween.to, e);
    camera.position.add(next.clone().sub(controls.target));
    controls.target.copy(next);
    if (x >= 1) camTween = null;
  }
  if (!reducedMotion && playing && now - lastInteract > 6000) {
    const off = camera.position.clone().sub(controls.target);
    const az = Math.atan2(off.x, off.z);
    updateCamera.dir = updateCamera.dir || 1;
    if (az > 0.42) updateCamera.dir = -1;
    if (az < -0.2) updateCamera.dir = 1;
    off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, updateCamera.dir * dt * 0.035);
    camera.position.copy(controls.target).add(off);
  }
  controls.update();
}

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const now = performance.now();
  if (playing) {
    T = Math.min(1, T + (dt * speed) / DURATION);
    if (T >= 1) setPlaying(false);
  }
  updateModel();
  updateScene(dt);
  updateDetail(reducedMotion ? 1 : 1 - Math.exp(-dt * 9));
  updateCamera(now, dt);
  pumpCallouts(now);
  refreshDuels(now);
  if (frameNo % 2 === 0) updateDuels(now);
  if (pointerInside && frameNo % 3 === 0) setHover(pick(pointerClient.x, pointerClient.y));
  if (frameNo % 2 === 0) {
    updateBoard();
    renderNational();
    updateTip();
    const v = Math.round(T * 1000);
    if (Number(scrub.value) !== v) scrub.value = v;
    scrub.style.setProperty("--fill", `${T * 100}%`);
    scrub.setAttribute("aria-valuetext", clockText(T));
    $("clock-time").textContent = clockText(T);
  }
  if (!textView.hidden && frameNo % 20 === 0) renderText();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (frameNo % 8 === 0) avoidLabelCollisions();
  frameNo++;
}

$("follow").checked = follow;
updateModel();
setMode(mode);
select(selected, { district: selectedDistrict });
renderer.setAnimationLoop(frame);

requestAnimationFrame(() => {
  $("loading").classList.add("is-done");
  if (introOn) {
    controls.enabled = false;
    introStart = performance.now();
    $("intro").classList.add("is-on");
  }
});
