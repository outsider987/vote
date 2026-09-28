import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { feature } from 'topojson-client';

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('zh-TW');
const parties = {
  '中國國民黨': { short: '國民黨', color: '#6798e9' },
  '民主進步黨': { short: '民進黨', color: '#58c99a' },
  '台灣民眾黨': { short: '民眾黨', color: '#6dd7dc' },
  '時代力量': { short: '時代力量', color: '#f2ca55' },
  '無黨籍及未經政黨推薦': { short: '無黨籍', color: '#b7c1cb' },
};
const order = ['中國國民黨', '民主進步黨', '無黨籍及未經政黨推薦', '台灣民眾黨', '時代力量'];
const offshore = ['09020', '09007', '10016'];
const Z = new THREE.Vector3(0, 0, 1);
const mapAngle = -.43;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchLayout = () => matchMedia('(max-width:700px)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const partyColor = p => parties[p]?.color || '#a9b5bd';
const partyShort = p => parties[p]?.short || p;
const hash = str => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const random = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const ease = u => u * u * (3 - 2 * u);
const project = ([lon, lat]) => new THREE.Vector2((lon - 121) * 11, (lat - 23.7) * 11);

let mayor, council, geo, countyByCode, councilByCode, races, state, progress = 0, mode = 'mayor';
let playing = true, speed = 1, focusCode = '66000', focusDistrict = 0, director = true, lastUpdate = 0, cutIndex = 0;
let scene, renderer, composer, camera, controls, ocean, mapRoot, focusMarker, mapObjects = new Map(), insetCameras = new Map();
let flight = null, nextCutAt = 0, lastEventAt = 0, burst = [], callQueue = [], callEnd = 0, boardPage = 0, boardSwitch = 0;
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), temp3 = new THREE.Vector3();
const mainOffset = new THREE.Vector3(11, -31, 52);
const formatPct = n => `${n.toFixed(1)}%`;

function buildRace(candidateRace, key, overallIndex) {
  const rng = random(hash(key));
  candidateRace._sim = {
    start: .025 + rng() * .19,
    end: .42 + rng() * .54,
    phase: candidateRace.candidates.map(() => [rng() * 6.283, rng() * 6.283, rng() * 6.283]),
    index: overallIndex,
  };
}

function raceState(race, t) {
  const sim = race._sim;
  const p = ease(clamp((t - sim.start) / (sim.end - sim.start)));
  const total = p >= 1 ? race.valid : Math.round(race.valid * p);
  if (p >= 1) return { p: 1, total: race.valid, votes: race.candidates.map(c => c.votes), leader: race.candidates.reduce((best, c, i) => c.votes > race.candidates[best].votes ? i : best, 0) };
  if (!total) return { p, total: 0, votes: race.candidates.map(() => 0), leader: -1 };
  const shares = race.candidates.map((c, i) => {
    const [a, b, d] = sim.phase[i];
    const wave = .7 * Math.sin(p * 12 + a) + .3 * Math.sin(p * 25 + b) + .2 * Math.sin(p * 5 + d);
    return Math.max(.0001, c.votes / race.valid + wave * .09 * (1 - p));
  });
  const sum = shares.reduce((a, b) => a + b, 0);
  const raw = shares.map(s => s / sum * total);
  const votes = raw.map(Math.floor);
  let remainder = total - votes.reduce((a, b) => a + b, 0);
  const fractions = raw.map((v, i) => [v - votes[i], i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < remainder; i++) votes[fractions[i][1]]++;
  return { p, total, votes, leader: votes.reduce((best, v, i) => v > votes[best] ? i : best, 0) };
}

function makeSnapshot(t) {
  const collection = mode === 'mayor' ? mayor.counties : races;
  const result = new Map(), seats = {}, countySeats = new Map();
  let counted = 0, allValid = 0, decided = 0;
  for (const race of collection) {
    const s = raceState(race, t);
    result.set(mode === 'mayor' ? race.code : race.id, s);
    counted += s.total; allValid += race.valid;
    if (s.p === 1) for (const c of race.candidates) if (c.elected) {
      seats[c.party] = (seats[c.party] || 0) + 1; decided++;
      if (mode === 'council') {
        const byParty = countySeats.get(race._county) || {};
        byParty[c.party] = (byParty[c.party] || 0) + 1;
        countySeats.set(race._county, byParty);
      }
    }
  }
  const county = new Map();
  for (const c of mayor.counties) {
    if (mode === 'mayor') {
      const s = result.get(c.code);
      county.set(c.code, { progress: s.p, leader: s.leader < 0 ? null : c.candidates[s.leader].party, name: s.leader < 0 ? '待開票' : c.candidates[s.leader].name, done: s.p === 1 });
    } else {
      const d = councilByCode.get(c.code).districts;
      const valid = d.reduce((sum, x) => sum + x.valid, 0);
      const cast = d.reduce((sum, x) => sum + result.get(x.id).total, 0);
      const byParty = countySeats.get(c.code) || {};
      const lead = Object.entries(byParty).sort((a, b) => b[1] - a[1])[0];
      county.set(c.code, { progress: valid ? cast / valid : 0, leader: lead?.[0] || null, name: lead ? `${partyShort(lead[0])} ${lead[1]} 席` : '尚無當選席次', done: d.every(x => result.get(x.id).p === 1) });
    }
  }
  return { result, seats, county, overall: allValid ? counted / allValid * 100 : 0, decided, totalSeats: mode === 'mayor' ? 22 : 910 };
}

function seaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'precision highp float; varying vec2 vUv; uniform float uTime; void main(){float wave=sin(vUv.y*255.+sin(vUv.x*50.+uTime*.12)*.8+uTime*.19); float shore=sin(vUv.x*138.-vUv.y*41.+uTime*.07); vec3 c=mix(vec3(.018,.053,.075),vec3(.025,.078,.094),vUv.y); c+=.006*wave+.003*shore; gl_FragColor=vec4(c,1.);}',
  });
}

function shapeFromPolygon(poly) {
  const outer = poly[0].map(project);
  const shape = new THREE.Shape(outer);
  for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(hole.map(project)));
  return { shape, outer };
}

function makeMap() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#061018');
  mapRoot = new THREE.Group(); mapRoot.rotation.z = mapAngle; scene.add(mapRoot);
  const ambient = new THREE.AmbientLight('#b9dbed', .72); ambient.layers.enable(1); ambient.layers.enable(2); ambient.layers.enable(3); scene.add(ambient);
  const key = new THREE.DirectionalLight('#d2f3ee', 1.85); key.position.set(-20, 22, 50); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -65; key.shadow.camera.right = 65; key.shadow.camera.top = 65; key.shadow.camera.bottom = -65; key.shadow.camera.near = 1; key.shadow.camera.far = 140; key.shadow.bias = -.0003; key.layers.enable(1); key.layers.enable(2); key.layers.enable(3); scene.add(key);
  const rim = new THREE.DirectionalLight('#3d8fae', .65); rim.position.set(20, -12, 23); rim.layers.enable(1); rim.layers.enable(2); rim.layers.enable(3); scene.add(rim);
  ocean = new THREE.Mesh(new THREE.PlaneGeometry(230, 230), seaMaterial()); ocean.position.z = -2.4; for (let i = 1; i <= 3; i++) ocean.layers.enable(i); scene.add(ocean);
  const gridPositions = [];
  for (let i = -60; i <= 60; i += 5) { gridPositions.push(-60, i, -2.32, 60, i, -2.32, i, -60, -2.32, i, 60, -2.32); }
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: '#5aa4b2', transparent: true, opacity: .075, depthWrite: false }));
  for (let i = 1; i <= 3; i++) grid.layers.enable(i); scene.add(grid);
  for (const f of geo) {
    const code = f.properties.COUNTYCODE;
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const layer = offshore.includes(code) ? offshore.indexOf(code) + 1 : 0;
    const top = new THREE.MeshStandardMaterial({ color: '#334c56', metalness: .25, roughness: .52, emissive: '#143b49', emissiveIntensity: .1 });
    const side = new THREE.MeshStandardMaterial({ color: '#1b343e', metalness: .33, roughness: .62 });
    const outlineMat = new THREE.LineBasicMaterial({ color: '#8aaeb6', transparent: true, opacity: .75, depthWrite: false });
    const group = new THREE.Group(); group.userData.code = code; mapRoot.add(group);
    const box = new THREE.Box2(); let mainBox = null, largestArea = 0;
    for (const poly of polygons) {
      const { shape, outer } = shapeFromPolygon(poly);
      outer.forEach(p => box.expandByPoint(p));
      const area = Math.abs(THREE.ShapeUtils.area(outer));
      if (area > largestArea) { largestArea = area; mainBox = new THREE.Box2().setFromPoints(outer); }
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.15, bevelEnabled: false, curveSegments: 1 }), [top, side]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.layers.set(layer); mesh.userData.code = code; group.add(mesh);
      const positions = [];
      for (const p of outer) positions.push(p.x, p.y, 2.19);
      const outlineGeo = new THREE.BufferGeometry(); outlineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const outline = new THREE.LineLoop(outlineGeo, outlineMat); outline.layers.set(layer); group.add(outline);
    }
    const center = box.getCenter(new THREE.Vector2());
    const displayCenter = new THREE.Vector3(center.x, center.y, 0).applyAxisAngle(Z, mapAngle);
    mapObjects.set(code, { group, top, side, outlineMat, center, displayCenter, layer, box, mainBox, callAt: 0 });
  }
  focusMarker = new THREE.Group();
  const markerColor = new THREE.Color('#dbfffa');
  const halo = new THREE.Mesh(new THREE.RingGeometry(.72, .82, 48), new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: .95, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.CircleGeometry(.17, 24), new THREE.MeshBasicMaterial({ color: markerColor, depthWrite: false }));
  focusMarker.add(halo, core); mapRoot.add(focusMarker);
}

function initRenderer() {
  const host = $('scene');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
  host.appendChild(renderer.domElement);
  camera = new THREE.OrthographicCamera(); camera.layers.set(0); setMainCamera();
  const initialTarget = touchLayout() ? new THREE.Vector3(4, -5, 0) : new THREE.Vector3();
  camera.position.copy(initialTarget).add(mainOffset); camera.lookAt(initialTarget);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .075; controls.enablePan = true; controls.minZoom = .65; controls.maxZoom = 3.2; controls.maxPolarAngle = Math.PI * .64; controls.target.copy(initialTarget); controls.update();
  controls.addEventListener('start', () => setDirector(false));
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .23, .14, 1.1)); composer.addPass(new OutputPass());
  for (const code of offshore) {
    const obj = mapObjects.get(code), cam = new THREE.OrthographicCamera(); cam.layers.set(obj.layer);
    const center = obj.mainBox.getCenter(new THREE.Vector2());
    const display = new THREE.Vector3(center.x, center.y, 0).applyAxisAngle(Z, mapAngle);
    obj.insetCenter = center; obj.insetDisplayCenter = display;
    const w = obj.mainBox.max.x - obj.mainBox.min.x, h = obj.mainBox.max.y - obj.mainBox.min.y;
    const factor = code === '09007' ? 5.2 : code === '09020' ? 2.1 : 2.5;
    cam.userData.span = Math.max(h * factor, w * factor / (150 / 106), 2.4);
    cam.position.copy(display).add(new THREE.Vector3(3, -4.5, 19)); cam.lookAt(display); insetCameras.set(code, cam);
  }
  addEventListener('resize', resize); resize();
  renderer.domElement.addEventListener('pointerdown', e => { renderer.domElement.dataset.down = `${e.clientX},${e.clientY}`; });
  renderer.domElement.addEventListener('pointerup', e => {
    const down = renderer.domElement.dataset.down?.split(',').map(Number); if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 7) return;
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects([...mapObjects.values()].filter(o => !o.layer).map(o => o.group), true).find(x => x.object.userData.code);
    if (hit) selectCounty(hit.object.userData.code, true);
  });
}

function setMainCamera() {
  const mobile = touchLayout(), span = mobile ? 90 : 49, aspect = innerWidth / innerHeight;
  camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2; camera.near = .1; camera.far = 260; camera.updateProjectionMatrix();
}

function resize() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); setMainCamera();
  for (const [code, cam] of insetCameras) {
    const el = document.querySelector(`.inset[data-code="${code}"]`), aspect = el.clientWidth / el.clientHeight, span = cam.userData.span;
    cam.left = -span * aspect / 2; cam.right = span * aspect / 2; cam.top = span / 2; cam.bottom = -span / 2; cam.near = .1; cam.far = 100; cam.updateProjectionMatrix();
  }
}

function renderInsets() {
  renderer.setScissorTest(true); renderer.autoClear = false;
  for (const [code, cam] of insetCameras) {
    const rect = document.querySelector(`.inset[data-code="${code}"]`).getBoundingClientRect();
    const x = Math.round(rect.left), y = Math.round(innerHeight - rect.bottom), w = Math.round(rect.width), h = Math.round(rect.height);
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.clear(true, true, true); renderer.render(scene, cam);
  }
  renderer.setScissorTest(false); renderer.autoClear = true;
  renderer.setViewport(0, 0, innerWidth, innerHeight);
}

function setDirector(enabled) {
  director = enabled; $('director').classList.toggle('active', enabled); $('director').setAttribute('aria-pressed', String(enabled));
  if (enabled) { nextCutAt = performance.now() + 800; controls.enabled = false; }
  else { flight = null; controls.enabled = true; }
}

function flyTo(code, dramatic = false) {
  if (!director || reduceMotion) return;
  if (code && !mapObjects.has(code)) return;
  const target = code && !offshore.includes(code) ? mapObjects.get(code).displayCenter : null;
  const mobile = touchLayout();
  const toTarget = target ? target.clone().multiplyScalar(mobile ? .36 : .48).add(mobile ? new THREE.Vector3(4, -5, 0) : new THREE.Vector3()) : new THREE.Vector3(mobile ? 4 : 0, mobile ? -5 : 0, 0);
  const offset = target && !mobile ? new THREE.Vector3(7, -16, dramatic ? 39 : 46) : mainOffset;
  const toPos = toTarget.clone().add(offset);
  const from = camera.position.clone(), mid = from.clone().lerp(toPos, .5); mid.z += dramatic ? 7 : 4;
  flight = { start: performance.now(), duration: dramatic ? 1650 : 1900, curve: new THREE.CatmullRomCurve3([from, mid, toPos]), fromTarget: controls.target.clone(), toTarget };
  if (code) { focusCode = code; focusDistrict = 0; drawFocus(); }
}

function updateMap(now) {
  if (!state) return;
  for (const c of mayor.counties) {
    const obj = mapObjects.get(c.code), info = state.county.get(c.code);
    if (!obj || !info) continue;
    const base = new THREE.Color(info.leader ? partyColor(info.leader) : '#41616c');
    const margin = mode === 'mayor' ? (() => { const s = state.result.get(c.code); if (s.leader < 0 || !s.total) return 0; const sorted = [...s.votes].sort((a, b) => b - a); return (sorted[0] - (sorted[1] || 0)) / s.total; })() : .18;
    const selected = c.code === focusCode;
    obj.top.color.copy(base).lerp(new THREE.Color('#183843'), info.leader ? clamp(.35 - margin * .8, .08, .37) : .55);
    obj.top.emissive.copy(base); obj.top.emissiveIntensity = info.leader ? (selected ? .27 : .13) : .025;
    obj.side.color.copy(base).multiplyScalar(.39);
    obj.outlineMat.color.copy(base); obj.outlineMat.opacity = selected ? 1 : info.leader ? .68 : .38;
    const elapsed = (now - obj.callAt) / 1000;
    const lift = !reduceMotion && elapsed >= 0 && elapsed < 1.75 ? (1 - ease(clamp(elapsed / 1.75))) * 1.8 : 0;
    obj.group.position.z = info.done ? .34 + lift : info.progress * .42;
  }
}

function stamp(code, party) {
  const obj = mapObjects.get(code); if (!obj) return;
  obj.callAt = performance.now();
  if (reduceMotion) return;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.29, 64), new THREE.MeshBasicMaterial({ color: partyColor(party), transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.copy(obj.insetDisplayCenter || obj.displayCenter); ring.position.z = 2.2; ring.layers.set(obj.layer); scene.add(ring);
  const rng = random(hash(code + 'stamp')), count = 32, positions = new Float32Array(count * 3), vectors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2, v = 2.4 + rng() * 5.2;
    vectors[i * 3] = Math.cos(a) * v; vectors[i * 3 + 1] = Math.sin(a) * v; vectors[i * 3 + 2] = 1.2 + rng() * 2;
  }
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dots = new THREE.Points(geom, new THREE.PointsMaterial({ color: partyColor(party), size: .24, transparent: true, opacity: .85, depthWrite: false }));
  dots.position.copy(obj.insetDisplayCenter || obj.displayCenter); dots.position.z = 1.6; dots.layers.set(obj.layer); scene.add(dots);
  burst.push({ ring, dots, vectors, start: performance.now() });
}

function updateBurst(now) {
  for (let i = burst.length - 1; i >= 0; i--) {
    const b = burst[i], t = (now - b.start) / 1400;
    if (t >= 1) { scene.remove(b.ring, b.dots); b.ring.geometry.dispose(); b.ring.material.dispose(); b.dots.geometry.dispose(); b.dots.material.dispose(); burst.splice(i, 1); continue; }
    b.ring.scale.setScalar(1 + t * 10); b.ring.material.opacity = (1 - t) * .65;
    const attr = b.dots.geometry.attributes.position;
    for (let j = 0; j < b.vectors.length; j += 3) { attr.array[j] = b.vectors[j] * t; attr.array[j + 1] = b.vectors[j + 1] * t; attr.array[j + 2] = b.vectors[j + 2] * t - 2.1 * t * t; }
    attr.needsUpdate = true; b.dots.material.opacity = (1 - t) * .8;
  }
}

function showNextCall(now) {
  if (now < callEnd || !callQueue.length) return;
  const event = callQueue.shift(), banner = $('call-banner');
  if (director) { flyTo(event.code, true); lastEventAt = now; nextCutAt = now + 6200; }
  banner.style.setProperty('--call-color', partyColor(event.party)); $('call-name').textContent = event.name;
  $('call-context').textContent = `${event.county} · ${partyShort(event.party)}`;
  banner.hidden = false; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); callEnd = now + 2500;
  setTimeout(() => { if (performance.now() >= callEnd - 50) { banner.hidden = true; banner.classList.remove('show'); } }, 2550);
}

function checkEvents(old, now) {
  if (!old || !playing) return;
  for (const c of mayor.counties) {
    const before = old.county.get(c.code), after = state.county.get(c.code);
    if (mode === 'mayor' && !before.done && after.done) {
      const winner = c.candidates.find(x => x.elected);
      callQueue.push({ code: c.code, name: winner.name, county: c.name, party: winner.party }); stamp(c.code, winner.party);
    } else if (mode === 'mayor' && before.leader && after.leader && before.leader !== after.leader && director && now - lastEventAt > 6000) {
      flyTo(c.code); lastEventAt = now; nextCutAt = now + 7000;
    }
  }
}

function avatar(candidate) {
  const box = document.createElement('span'); box.className = 'avatar'; box.style.setProperty('--party', partyColor(candidate.party));
  box.textContent = candidate.name[0] || '候';
  if (candidate.photo) { const img = new Image(); img.alt = ''; img.src = candidate.photo; img.onerror = () => img.remove(); box.appendChild(img); }
  return box;
}

function selectedRace() {
  if (mode === 'mayor') return mayor.counties.find(c => c.code === focusCode);
  const districts = councilByCode.get(focusCode).districts;
  focusDistrict = clamp(focusDistrict, 0, districts.length - 1);
  return districts[focusDistrict];
}

function focusHeading() {
  const county = countyByCode.get(focusCode), race = selectedRace(), s = state.result.get(mode === 'mayor' ? race.code : race.id);
  $('race-name').textContent = mode === 'mayor' ? county.name : `${county.name} · ${race.name}`;
  $('race-type').textContent = mode === 'mayor' ? '縣市長選舉' : `${race.type}議員選舉`;
  $('race-progress').textContent = `${Math.round(s.p * 100)}% 已開票`;
  $('race-status').textContent = s.p === 1 ? '當選確定' : s.total ? '開票中' : '等待開票';
  $('race-status').classList.toggle('done', s.p === 1);
  $('district-row').hidden = mode === 'mayor';
  if (mode === 'council') {
    const select = $('district-select'), districts = councilByCode.get(focusCode).districts;
    if (select.dataset.county !== focusCode) {
      select.replaceChildren(); districts.forEach((d, i) => { const opt = document.createElement('option'); opt.value = String(i); opt.textContent = `${d.name} · ${d.type} · ${d.seats} 席`; select.appendChild(opt); }); select.dataset.county = focusCode;
    }
    select.value = String(focusDistrict);
  }
}

function drawFocus() {
  if (!state) return;
  focusHeading();
  const race = selectedRace(), s = state.result.get(mode === 'mayor' ? race.code : race.id);
  const ranks = race.candidates.map((c, i) => i).sort((a, b) => s.votes[b] - s.votes[a] || race.candidates[a].no - race.candidates[b].no).slice(0, mode === 'mayor' ? 3 : 4);
  const host = $('candidate-strip'), key = `${mode}:${race.id || race.code}:${ranks.join(',')}:${s.p === 1}`;
  if (host.dataset.key !== key) {
    host.replaceChildren(); host.dataset.key = key;
    for (const i of ranks) {
      const c = race.candidates[i], card = document.createElement('div'); card.className = 'candidate-card'; card.style.setProperty('--party', partyColor(c.party));
      const info = document.createElement('div'); info.className = 'candidate-info';
      const name = document.createElement('b'); name.textContent = c.name;
      if (s.p === 1 && c.elected) { const badge = document.createElement('span'); badge.className = `badge${c.womenQuota ? ' quota' : ''}`; badge.textContent = c.womenQuota ? '婦女保障名額' : '當選'; name.appendChild(badge); }
      const party = document.createElement('small'); party.textContent = `${c.no} 號 · ${partyShort(c.party)}`; info.append(name, party);
      const votes = document.createElement('div'); votes.className = 'candidate-votes'; votes.appendChild(document.createTextNode('0')); votes.appendChild(document.createElement('small'));
      const bar = document.createElement('div'); bar.className = 'race-bar'; bar.appendChild(document.createElement('span'));
      card.append(avatar(c), info, votes, bar); host.appendChild(card);
    }
  }
  ranks.forEach((i, j) => {
    const card = host.children[j], votes = card.querySelector('.candidate-votes');
    votes.firstChild.textContent = fmt.format(s.votes[i]);
    votes.lastChild.textContent = `${s.p === 1 ? race.candidates[i].pct.toFixed(2) : s.total ? (s.votes[i] / s.total * 100).toFixed(1) : '0.0'}%`;
    card.querySelector('.race-bar span').style.width = `${s.total ? s.votes[i] / s.total * 100 : 0}%`;
  });
  document.querySelectorAll('.inset').forEach(el => el.classList.toggle('active', el.dataset.code === focusCode));
  const obj = mapObjects.get(focusCode);
  focusMarker.position.set((obj.insetCenter || obj.center).x, (obj.insetCenter || obj.center).y, 2.75);
  focusMarker.children.forEach(child => { child.layers.set(obj.layer); child.material.color.set(state.county.get(focusCode).leader ? partyColor(state.county.get(focusCode).leader) : '#dbfffa'); });
  $('map-tag-county').textContent = countyByCode.get(focusCode).name;
  $('map-tag-leader').textContent = state.county.get(focusCode).name;
  $('map-tag').style.setProperty('--party', state.county.get(focusCode).leader ? partyColor(state.county.get(focusCode).leader) : '#b7c1cb');
}

function drawSeats() {
  const host = $('seat-counts');
  const labels = mode === 'mayor' ? order.slice(0, 4) : [...order, '其他政黨'];
  document.querySelector('.scoreboard').classList.toggle('council', mode === 'council');
  if (host.dataset.mode !== mode) {
    host.replaceChildren(); for (const p of labels) {
      const item = document.createElement('div'); item.className = 'seat'; item.style.setProperty('--party', p === '其他政黨' ? '#d5a5af' : partyColor(p));
      const line = document.createElement('i'), n = document.createElement('b'), title = document.createElement('span');
      title.textContent = touchLayout() && mode === 'council' ? ({ '中國國民黨': '國民', '民主進步黨': '民進', '無黨籍及未經政黨推薦': '無黨', '台灣民眾黨': '民眾', '時代力量': '時力', '其他政黨': '其他' })[p] : p === '其他政黨' ? '其他' : partyShort(p);
      item.append(line, n, title); host.appendChild(item);
    } host.dataset.mode = mode;
  }
  labels.forEach((p, i) => { host.children[i].querySelector('b').textContent = p === '其他政黨' ? Object.entries(state.seats).filter(([key]) => !order.includes(key)).reduce((sum, [, n]) => sum + n, 0) : state.seats[p] || 0; });
  $('score-label').textContent = mode === 'mayor' ? '縣市長當選席次' : '議員當選席次';
  $('decided').innerHTML = `${String(state.decided).padStart(2, '0')} <small>/ ${state.totalSeats}</small>`;
  $('overall').textContent = formatPct(state.overall); $('overall-bar').style.width = `${state.overall}%`;
  $('clock').textContent = (() => { const minutes = 16 * 60 + Math.round(progress * 450); return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; })();
  $('timeline').value = String(Math.round(progress * 1000)); $('timeline').style.setProperty('--timeline-fill', `${progress * 100}%`);
  const icon = $('play-icon'); icon.innerHTML = playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 5 11 7-11 7z"/>';
  $('play').setAttribute('aria-label', playing ? '暫停重播' : progress >= 1 ? '重新播放' : '播放重播');
}

function buildBoard() {
  const host = $('board-list'), mobile = $('mobile-counties');
  const ordered = [...mayor.counties].sort((a, b) => a.code.localeCompare(b.code, 'en'));
  if (host.children.length === ordered.length) {
    ordered.forEach((c, i) => {
      const info = state.county.get(c.code), color = info.leader ? partyColor(info.leader) : '#8cabb4';
      const row = host.children[i], mr = mobile.children[i];
      row.style.setProperty('--party', color); row.children[1].textContent = info.name; row.children[2].textContent = info.done ? '開出' : `${Math.round(info.progress * 100)}%`;
      row.children[2].classList.toggle('done', info.done); row.classList.toggle('active', c.code === focusCode);
      mr.style.setProperty('--party', color); mr.children[1].textContent = info.name; mr.children[2].textContent = info.done ? '已開' : `${Math.round(info.progress * 100)}%`; mr.classList.toggle('active', c.code === focusCode);
    });
    return;
  }
  ordered.forEach(c => {
    const info = state.county.get(c.code), color = info.leader ? partyColor(info.leader) : '#8cabb4';
    const row = document.createElement('button'); row.type = 'button'; row.className = 'board-row'; row.style.setProperty('--party', color); row.dataset.code = c.code;
    const name = document.createElement('span'); name.className = 'county'; name.textContent = c.name;
    const leader = document.createElement('span'); leader.className = 'leader'; leader.textContent = info.name;
      const pct = document.createElement('b'); pct.textContent = info.done ? '開出' : `${Math.round(info.progress * 100)}%`; pct.classList.toggle('done', info.done);
    row.append(name, leader, pct); row.classList.toggle('active', c.code === focusCode); row.addEventListener('click', () => selectCounty(c.code, true)); host.appendChild(row);
    const mr = document.createElement('button'); mr.type = 'button'; mr.style.setProperty('--party', color); mr.dataset.code = c.code;
    const mn = document.createElement('b'); mn.textContent = c.name; const ml = document.createElement('span'); ml.textContent = info.name; const mp = document.createElement('strong'); mp.textContent = info.done ? '已開' : `${Math.round(info.progress * 100)}%`;
    mr.append(mn, ml, mp); mr.classList.toggle('active', c.code === focusCode); mr.addEventListener('click', () => { selectCounty(c.code, true); showMobileTab('focus'); }); mobile.appendChild(mr);
  });
  updateBoardPage();
}

function updateBoardPage() {
  $('board-page').textContent = `${String(boardPage + 1).padStart(2, '0')} / 02`;
  [...$('board-list').children].forEach((el, i) => { el.hidden = Math.floor(i / 11) !== boardPage; });
}

function textCandidate(c, votes, total, complete) {
  const row = document.createElement('div'); row.className = 'text-candidate'; row.style.setProperty('--party', partyColor(c.party));
  const info = document.createElement('div'), name = document.createElement('b'); name.textContent = `${c.no} 號　${c.name}`;
  if (complete && c.elected) { const badge = document.createElement('span'); badge.className = `badge${c.womenQuota ? ' quota' : ''}`; badge.textContent = c.womenQuota ? '婦女保障名額' : '當選'; name.appendChild(badge); }
  const party = document.createElement('small'); party.textContent = c.party; info.append(name, party);
  const number = document.createElement('strong'); number.textContent = fmt.format(votes); const pct = document.createElement('small'); pct.textContent = `${complete ? c.pct.toFixed(2) : total ? (votes / total * 100).toFixed(1) : '0.0'}%`; number.appendChild(pct);
  row.append(avatar(c), info, number); return row;
}

function drawText() {
  if ($('text-panel').hidden) return;
  const summary = $('text-summary'); summary.replaceChildren();
  const first = document.createElement('span'); first.innerHTML = `全國開票 <b>${formatPct(state.overall)}</b>`; summary.appendChild(first);
  const second = document.createElement('span'); second.innerHTML = `已開出 <b>${state.decided} / ${state.totalSeats} 席</b>`; summary.appendChild(second);
  for (const [p, n] of Object.entries(state.seats).sort((a, b) => b[1] - a[1])) { const e = document.createElement('span'); e.textContent = `${p} ${n} 席`; summary.appendChild(e); }
  const nav = $('text-counties'); nav.replaceChildren();
  for (const c of mayor.counties) {
    const info = state.county.get(c.code), row = document.createElement('button'); row.type = 'button'; row.style.setProperty('--party', info.leader ? partyColor(info.leader) : '#9dbac3'); row.classList.toggle('active', c.code === focusCode);
    const n = document.createElement('strong'); n.textContent = c.name; const lead = document.createElement('span'); lead.textContent = info.name; const pct = document.createElement('b'); pct.textContent = `${Math.round(info.progress * 100)}%`; row.append(n, lead, pct); row.addEventListener('click', () => { selectCounty(c.code, false); drawText(); }); nav.appendChild(row);
  }
  const county = countyByCode.get(focusCode), race = selectedRace(), s = state.result.get(mode === 'mayor' ? race.code : race.id);
  const head = $('text-detail-head'); head.replaceChildren(); const title = document.createElement('h3'); title.textContent = mode === 'mayor' ? `${county.name}縣市長` : `${county.name}議員 · ${race.name}`;
  const meta = document.createElement('p'); meta.textContent = `${formatPct(s.p * 100)} 已開票 · ${fmt.format(s.total)} 張有效票${mode === 'council' ? ` · ${race.seats} 席` : ''}`; head.append(title, meta);
  const district = $('text-district'); district.hidden = mode !== 'council'; district.replaceChildren();
  if (mode === 'council') councilByCode.get(focusCode).districts.forEach((d, i) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `${d.name} ${d.type}`; button.classList.toggle('active', i === focusDistrict); button.addEventListener('click', () => { focusDistrict = i; drawFocus(); drawText(); }); district.appendChild(button); });
  const list = $('text-candidates'); list.replaceChildren(); race.candidates.map((c, i) => [c, i]).sort((a, b) => s.votes[b[1]] - s.votes[a[1]]).forEach(([c, i]) => list.appendChild(textCandidate(c, s.votes[i], s.total, s.p === 1)));
}

function selectCounty(code, manual = false) {
  if (!countyByCode.has(code)) return;
  focusCode = code; focusDistrict = 0; $('district-select').dataset.county = '';
  if (manual) { setDirector(false); if (!offshore.includes(code)) { const target = mapObjects.get(code).displayCenter.clone().multiplyScalar(touchLayout() ? .45 : .32); controls.target.copy(target); controls.update(); } }
  drawFocus(); buildBoard(); drawText();
}

function setMode(next) {
  if (next === mode) return;
  mode = next; focusDistrict = 0; $('district-select').dataset.county = '';
  $('mayor-mode').classList.toggle('active', mode === 'mayor'); $('council-mode').classList.toggle('active', mode === 'council');
  $('mayor-mode').setAttribute('aria-pressed', String(mode === 'mayor')); $('council-mode').setAttribute('aria-pressed', String(mode === 'council'));
  state = makeSnapshot(progress); drawSeats(); drawFocus(); buildBoard(); drawText(); updateMap(performance.now());
}

function showMobileTab(tab) {
  const counties = tab === 'counties'; $('lower-third').classList.toggle('show-counties', counties); $('mobile-counties').hidden = !counties;
  $('focus-tab').classList.toggle('active', !counties); $('counties-tab').classList.toggle('active', counties);
  $('focus-tab').setAttribute('aria-pressed', String(!counties)); $('counties-tab').setAttribute('aria-pressed', String(counties));
}

function setupUI() {
  $('mayor-mode').addEventListener('click', () => setMode('mayor')); $('council-mode').addEventListener('click', () => setMode('council'));
  $('play').addEventListener('click', () => { if (progress >= 1) { progress = 0; state = makeSnapshot(0); callQueue = []; } playing = !playing; drawSeats(); });
  $('speed').addEventListener('click', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('speed').textContent = `${speed}×`; $('speed').setAttribute('aria-label', `播放速度 ${speed} 倍`); });
  $('timeline').addEventListener('input', e => { playing = false; callQueue = []; progress = Number(e.target.value) / 1000; state = makeSnapshot(progress); drawSeats(); drawFocus(); buildBoard(); drawText(); updateMap(performance.now()); });
  $('director').addEventListener('click', () => { setDirector(!director); if (director) flyTo(null); });
  $('district-select').addEventListener('change', e => { focusDistrict = Number(e.target.value); drawFocus(); drawText(); });
  document.querySelectorAll('.inset').forEach(el => el.addEventListener('click', () => selectCounty(el.dataset.code, true)));
  const openText = () => { playing = false; drawSeats(); $('text-panel').hidden = false; drawText(); $('close-text').focus(); };
  $('text-view').addEventListener('click', openText); $('all-candidates').addEventListener('click', openText);
  $('close-text').addEventListener('click', () => { $('text-panel').hidden = true; $('text-view').focus(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('text-panel').hidden) { $('text-panel').hidden = true; $('text-view').focus(); } });
  $('focus-tab').addEventListener('click', () => showMobileTab('focus')); $('counties-tab').addEventListener('click', () => showMobileTab('counties'));
  let touchY = null, sheetDragged = false;
  $('sheet-toggle').addEventListener('click', () => { if (sheetDragged) { sheetDragged = false; return; } const expanded = $('lower-third').classList.toggle('expanded'); $('sheet-toggle').setAttribute('aria-expanded', String(expanded)); });
  $('sheet-handle').addEventListener('pointerdown', e => { touchY = e.clientY; sheetDragged = false; e.target.setPointerCapture(e.pointerId); });
  $('sheet-handle').addEventListener('pointerup', e => { if (touchY == null) return; const dy = e.clientY - touchY; if (Math.abs(dy) > 45) { sheetDragged = true; const expanded = dy < 0; $('lower-third').classList.toggle('expanded', expanded); $('sheet-toggle').setAttribute('aria-expanded', String(expanded)); } touchY = null; });
}

function update(t, fromReplay = false, now = performance.now()) {
  const old = state; progress = clamp(t); state = makeSnapshot(progress);
  if (fromReplay) checkEvents(old, now);
  drawSeats(); drawFocus(); buildBoard(); drawText(); updateMap(now);
  if (progress >= 1) playing = false;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (playing && now - lastUpdate > 120) { update(progress + Math.min((now - lastUpdate) / 1000, 2) * speed / 95, true, now); lastUpdate = now; }
  if (director) {
    if (flight) {
      const u = clamp((now - flight.start) / flight.duration), v = ease(u);
      flight.curve.getPoint(v, temp3); camera.position.copy(temp3); controls.target.copy(flight.fromTarget).lerp(flight.toTarget, v); camera.lookAt(controls.target); if (u >= 1) flight = null;
    } else if (now > nextCutAt) {
      const choices = mayor.counties.filter(c => !offshore.includes(c.code) && state.county.get(c.code).progress > .02).sort((a, b) => state.county.get(b.code).progress - state.county.get(a.code).progress);
      if (choices.length && cutIndex % 3 !== 0) flyTo(choices[(cutIndex * 3) % Math.min(choices.length, 7)].code); else flyTo(null);
      cutIndex++;
      nextCutAt = now + 9000;
    }
  } else controls.update();
  if (now > boardSwitch) { boardPage = 1 - boardPage; updateBoardPage(); boardSwitch = now + 5600; }
  if (callEnd && now > callEnd) callEnd = 0;
  showNextCall(now); updateBurst(now);
  const marker = mapObjects.get(focusCode), tag = $('map-tag');
  if (marker.layer || touchLayout()) tag.hidden = true;
  else {
    temp3.copy(marker.displayCenter); temp3.z = 3.2; temp3.project(camera);
    const x = (temp3.x * .5 + .5) * innerWidth, y = (-temp3.y * .5 + .5) * innerHeight;
    tag.hidden = x < 185 || x > innerWidth - 285 || y < 155 || y > innerHeight - 285;
    tag.style.transform = `translate(${Math.round(x + 17)}px,${Math.round(y - 12)}px)`;
  }
  ocean.material.uniforms.uTime.value = reduceMotion ? 0 : now / 1000;
  composer.render(); renderInsets();
}

async function init() {
  try {
    const get = async path => { const response = await fetch(path); if (!response.ok) throw new Error(`無法載入 ${path}`); return response.json(); };
    [mayor, council, geo] = await Promise.all([get('../../data/mayor-2022.json'), get('../../data/council-2022.json'), get('../../data/taiwan-atlas-counties-10t.json')]);
    geo = feature(geo, geo.objects.counties).features;
    countyByCode = new Map(mayor.counties.map(c => [c.code, c])); councilByCode = new Map(council.counties.map(c => [c.code, c]));
    mayor.counties.forEach((c, i) => buildRace(c, c.code, i));
    races = council.counties.flatMap(c => c.districts.map((d, i) => { d._county = c.code; buildRace(d, d.id, i); return d; }));
    makeMap(); initRenderer(); setupUI();
    const url = new URL(location.href), initial = Number(url.searchParams.get('t'));
    if (url.searchParams.has('t') && Number.isFinite(initial)) { progress = clamp(initial); playing = false; focusCode = progress < .35 ? '63000' : progress < .8 ? '66000' : '64000'; }
    state = makeSnapshot(progress); drawSeats(); drawFocus(); buildBoard(); updateMap(performance.now());
    setDirector(true); if (url.searchParams.has('t')) nextCutAt = performance.now() + 100000;
    boardPage = 0; updateBoardPage(); boardSwitch = performance.now() + 5600;
    $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 750);
    lastUpdate = performance.now(); requestAnimationFrame(frame);
    window.__director = { setProgress: t => { playing = false; update(t); }, getState: () => ({ progress, mode, overall: state.overall, decided: state.decided, seats: state.seats }), select: selectCounty, setMode };
  } catch (error) {
    $('loading').querySelector('.loading-caption').textContent = '資料載入失敗，請重新整理頁面。';
    console.error(error);
  }
}

init();
