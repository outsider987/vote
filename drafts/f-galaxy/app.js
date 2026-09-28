import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { feature } from 'topojson-client';

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('zh-TW');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 900px)');
const PARTY_COLORS = {
  '中國國民黨':'#758cff', '民主進步黨':'#60dca1', '台灣民眾黨':'#5ecbd9',
  '時代力量':'#e9c45c', '無黨籍及未經政黨推薦':'#d4d5d4', '無黨團結聯盟':'#d18bb6',
  '台灣團結聯盟':'#c7ae7d', '親民黨':'#eea574', '台灣基進':'#e58479',
  '勞動黨':'#e87379', '綠黨':'#88ce82', '新黨':'#e9d478', '社會民主黨':'#de8ba1',
  '正神名黨':'#b9a8d2'
};
const SUMMARY_PARTIES = [
  ['中國國民黨','國民黨'],['民主進步黨','民進黨'],['無黨籍及未經政黨推薦','無黨籍'],
  ['台灣民眾黨','民眾黨'],['時代力量','時代力量'],['other','其他']
];
const COUNTY_ORDER = ['臺北市','新北市','基隆市','桃園市','新竹市','新竹縣','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','臺南市','高雄市','屏東縣','臺東縣','花蓮縣','宜蘭縣','澎湖縣','金門縣','連江縣'];
const neutral = new THREE.Color('#35435a');
const tmpColor = new THREE.Color();
const dummy = new THREE.Object3D();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const projected = new THREE.Vector3();
const partyThreeColors = new Map();
let mayorData, councilData, countyFeatures, counties, mayorRaces, councilRaces, councilSeats, mayorSeats;
let renderer, composer, scene, camera, controls, councilMesh, mayorMesh, stemMesh, quotaMesh, quotaCandidates, selectionHalo, bloom, mapRenderer, mapScene, mapCamera, mapGroups = new Map();
let progress = 0, playing = false, speed = 1, lastUpdate = 0, lastFrame = performance.now(), textMode = false, textKind = 'mayor';
let selected = null, hovered = null, countyFilter = 'all', partyFilter = 'all', emphasis = 'council', cardKey = '', cardOpen = false;
let tallyMayor = {}, tallyCouncil = {}, decidedMayor = 0, decidedCouncil = 0, overall = 0;
let lastPick = 0;

function hash(value) {
  let h = 2166136261;
  for (let i=0;i<value.length;i++) h = Math.imul(h ^ value.charCodeAt(i),16777619);
  return h >>> 0;
}
function random(seed) {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x,1664525)+1013904223)>>>0) / 4294967296);
}
function clamp(value,lo=0,hi=1) { return Math.min(hi,Math.max(lo,value)); }
function color(party) { return PARTY_COLORS[party] || councilData?.partyColors?.[party] || '#a6afbd'; }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function photoURL(candidate) {
  if (!candidate.photo) return null;
  try { const url = new URL(candidate.photo,location.href); return ['https:','http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

function makeRace(data,county,kind,id) {
  const rng = random(hash(id));
  const start = rng()*.155;
  const finish = (kind === 'mayor' ? .24 : .14) + Math.pow(rng(),.84)*(kind === 'mayor' ? .76 : .86);
  return {
    id,county,kind,data,start,finish,progress:0,total:0,
    votes:new Array(data.candidates.length).fill(0),
    order:data.candidates.map((_,i)=>i),
    phases:data.candidates.map(()=>rng()*Math.PI*2),
    phases2:data.candidates.map(()=>rng()*Math.PI*2),
    frequencies:data.candidates.map(()=>7+rng()*5),
    seats:[], leader:-1
  };
}

function prepareData() {
  const mayorByCode = new Map(mayorData.counties.map(c=>[c.code,c]));
  const councilByCode = new Map(councilData.counties.map(c=>[c.code,c]));
  counties = COUNTY_ORDER.map(name=>{
    const mayor = mayorData.counties.find(c=>c.name===name);
    return {name,code:mayor.code,mayor, council:councilByCode.get(mayor.code),startAngle:0,endAngle:0,midAngle:0};
  });
  mayorRaces = counties.map(county=>makeRace(mayorByCode.get(county.code),county,'mayor',county.code+'-mayor'));
  councilRaces = counties.flatMap(county=>county.council.districts.map(d=>makeRace(d,county,'council',d.id)));
  quotaCandidates=councilRaces.flatMap(r=>r.data.candidates.flatMap((candidate,index)=>candidate.womenQuota&&candidate.elected?[{race:r,index}]:[]));
  const totalSeats = councilRaces.reduce((sum,r)=>sum+r.data.seats,0);
  if (totalSeats !== 910 || mayorRaces.length !== 22) throw new Error('席次資料不完整');
  councilSeats = [];
  mayorSeats = [];
  const totalWeight = counties.reduce((sum,c)=>sum+.54/22+.46*c.council.seats/910,0);
  let angle = -Math.PI/2;
  for (const county of counties) {
    const width = Math.PI*2*(.54/22+.46*county.council.seats/910)/totalWeight;
    county.startAngle=angle; county.endAngle=angle+width; county.midAngle=angle+width/2;
    angle += width;
    const countyRaces = councilRaces.filter(r=>r.county===county);
    const entries = countyRaces.flatMap(r=>Array.from({length:r.data.seats},(_,rank)=>({race:r,rank})));
    const rng = random(hash(county.code+'-layout'));
    entries.forEach((entry,i)=>{
      const u=(i+.55)/entries.length;
      const radius=Math.sqrt(4.5*4.5+u*(12.05*12.05-4.5*4.5));
      const a=county.startAngle+.045+(county.endAngle-county.startAngle-.09)*((i*.61803398875+rng()*.035)%1);
      const z=.18+.34*Math.sin(a*3+radius*.72)+.12*rng();
      const seat={...entry,county,pos:new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,z),intensity:0,target:0,party:'',candidateIndex:-1,scale:.16,angle:a};
      entry.race.seats.push(seat); councilSeats.push(seat);
    });
    const race=mayorRaces.find(r=>r.county===county);
    const seat={race,rank:0,county,pos:new THREE.Vector3(Math.cos(county.midAngle)*3.12,Math.sin(county.midAngle)*3.12,.72),intensity:0,target:0,party:'',candidateIndex:-1,scale:.34};
    race.seats.push(seat); mayorSeats.push(seat);
  }
}

function raceProgress(race,t) {
  if (t>=1) return 1;
  const x=clamp((t-race.start)/(race.finish-race.start));
  return Math.pow(x,1.16);
}
function updateRace(race,t) {
  const p=race.progress=raceProgress(race,t);
  const {candidates,valid}=race.data;
  if (p===1) {
    race.total=valid;
    candidates.forEach((c,i)=>{race.votes[i]=c.votes;});
    race.order.sort((a,b)=>race.votes[b]-race.votes[a] || a-b);
    race.leader=race.order[0];
    const elected=race.order.filter(i=>candidates[i].elected);
    race.seats.forEach((seat,rank)=>{seat.candidateIndex=elected[rank];seat.party=candidates[seat.candidateIndex].party;});
    return;
  }
  if (p===0) {
    race.total=0;race.votes.fill(0);race.leader=-1;
    race.seats.forEach(seat=>{seat.candidateIndex=-1;seat.party='';});
    return;
  }
  const total=race.total=Math.round(valid*p);
  let weightSum=0;
  const weights=[];
  for (let i=0;i<candidates.length;i++) {
    const wave=Math.sin(p*race.frequencies[i]+race.phases[i])+.48*Math.sin(p*19.1+race.phases2[i]);
    const weight=Math.max(.0001,candidates[i].votes/valid + wave*.065*Math.pow(1-p,1.12));
    weights.push(weight);weightSum+=weight;
  }
  let assigned=0;
  for (let i=0;i<candidates.length-1;i++) { const votes=Math.floor(total*weights[i]/weightSum);race.votes[i]=votes;assigned+=votes; }
  race.votes[candidates.length-1]=total-assigned;
  race.order.sort((a,b)=>race.votes[b]-race.votes[a] || a-b);
  race.leader=race.order[0];
  race.seats.forEach((seat,rank)=>{seat.candidateIndex=race.order[rank];seat.party=candidates[seat.candidateIndex]?.party || '';});
}

function updateSnapshot(t) {
  progress=clamp(t); tallyMayor={};tallyCouncil={};decidedMayor=0;decidedCouncil=0;
  let weighted=0,validTotal=0;
  for (const race of [...mayorRaces,...councilRaces]) {
    updateRace(race,progress);
    weighted+=race.progress*race.data.valid;validTotal+=race.data.valid;
    if (race.progress===1) {
      const tally=race.kind==='mayor'?tallyMayor:tallyCouncil;
      race.seats.forEach(seat=>{tally[seat.party]=(tally[seat.party]||0)+1;});
      if (race.kind==='mayor') decidedMayor++; else decidedCouncil+=race.data.seats;
    }
  }
  overall=validTotal?weighted/validTotal:0;
  for (const seat of councilSeats) seat.target=seatTarget(seat);
  for (const seat of mayorSeats) seat.target=seatTarget(seat);
  drawUI();
}
function seatTarget(seat) {
  if (seat.race.progress!==1) return 0;
  const countyMatch=countyFilter==='all'||seat.county.code===countyFilter;
  const partyMatch=partyFilter==='all'||seat.party===partyFilter;
  const typeMatch=seat.race.kind===emphasis;
  return countyMatch&&partyMatch ? (typeMatch?1:.48) : .11;
}

function makeScene() {
  const holder=$('scene');
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#080d18',.017);
  camera=new THREE.PerspectiveCamera(43,1,.1,120);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(holder.clientWidth,holder.clientHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
  holder.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#dce8ff','#162238',2.1));
  const light=new THREE.DirectionalLight('#fff0d6',2.7);light.position.set(-8,-9,18);scene.add(light);
  const fill=new THREE.DirectionalLight('#7aa3e4',1.5);fill.position.set(9,12,7);scene.add(fill);
  makeGuides();makeStars();
  const geometry=new THREE.OctahedronGeometry(1,0);
  const material=new THREE.MeshPhongMaterial({color:'#ffffff',shininess:88,specular:'#a8bbd4',flatShading:true});
  councilMesh=new THREE.InstancedMesh(geometry,material,councilSeats.length);
  mayorMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material,mayorSeats.length);
  stemMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshPhongMaterial({color:'#ffffff',transparent:true,opacity:.48,depthWrite:false}),councilSeats.length);
  quotaMesh=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.13,6,24),new THREE.MeshBasicMaterial({color:'#f2d492',transparent:true,opacity:.86,depthWrite:false}),quotaCandidates.length);
  councilMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mayorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  councilMesh.frustumCulled=false;mayorMesh.frustumCulled=false;stemMesh.frustumCulled=false;
  scene.add(stemMesh,councilMesh,mayorMesh,quotaMesh);
  for (let group=0;group<2;group++) {
    const mesh=group?mayorMesh:councilMesh,seats=group?mayorSeats:councilSeats;
    seats.forEach((seat,i)=>{
      dummy.position.copy(seat.pos);dummy.scale.setScalar(seat.scale*.76);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i,neutral);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  }
  councilSeats.forEach((seat,i)=>{
    dummy.position.copy(seat.pos);dummy.rotation.set(Math.PI/2,0,0);dummy.scale.set(.001,.001,.001);dummy.updateMatrix();stemMesh.setMatrixAt(i,dummy.matrix);stemMesh.setColorAt(i,neutral);
  });
  dummy.rotation.set(0,0,0);stemMesh.instanceMatrix.needsUpdate=true;stemMesh.instanceColor.needsUpdate=true;
  quotaCandidates.forEach((_,i)=>{dummy.scale.setScalar(.001);dummy.updateMatrix();quotaMesh.setMatrixAt(i,dummy.matrix);});quotaMesh.instanceMatrix.needsUpdate=true;
  selectionHalo=new THREE.Mesh(new THREE.TorusGeometry(1,.035,8,48),new THREE.MeshBasicMaterial({color:'#f2dfab',transparent:true,opacity:.75,depthWrite:false}));
  selectionHalo.visible=false;scene.add(selectionHalo);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.07;
  controls.minDistance=20;controls.maxDistance=75;controls.maxPolarAngle=Math.PI*.72;controls.minPolarAngle=.35;
  controls.autoRotate=!reduceMotion;controls.autoRotateSpeed=.11;
  controls.addEventListener('start',()=>{controls.autoRotate=false;});
  controls.addEventListener('end',()=>{if(!reduceMotion) setTimeout(()=>{if(!textMode) controls.autoRotate=true;},2500);});
  const gl=renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  if(!mobile.matches&&!reduceMotion&&!/SwiftShader/i.test(gpu)){
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    bloom=new UnrealBloomPass(new THREE.Vector2(holder.clientWidth,holder.clientHeight),.19,.18,.94);
    composer.addPass(bloom);composer.addPass(new OutputPass());
  }
  window.addEventListener('resize',resizeScene);
  resizeScene();
  holder.addEventListener('pointermove',onSceneMove);
  holder.addEventListener('pointerleave',()=>{hovered=null;$('seat-tooltip').hidden=true;updateMapHighlight();});
  holder.addEventListener('click',onSceneClick);
  requestAnimationFrame(frame);
}

function makeGuides() {
  const vertices=[];
  const arc=(r,z,start,end,segments)=>{
    for(let i=0;i<segments;i++) {
      const a=start+(end-start)*i/segments,b=start+(end-start)*(i+1)/segments;
      vertices.push(Math.cos(a)*r,Math.sin(a)*r,z,Math.cos(b)*r,Math.sin(b)*r,z);
    }
  };
  [3.12,4.42,7.4,10.1,12.12].forEach(r=>arc(r,-.28,0,Math.PI*2,160));
  for (const county of counties) {
    const a=county.startAngle;
    vertices.push(Math.cos(a)*4.05,Math.sin(a)*4.05,-.28,Math.cos(a)*12.42,Math.sin(a)*12.42,-.28);
    const mid=county.midAngle;
    vertices.push(Math.cos(mid)*3.4,Math.sin(mid)*3.4,-.28,Math.cos(mid)*4.12,Math.sin(mid)*4.12,-.28);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  scene.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#7c8dab',transparent:true,opacity:.22,depthWrite:false})));
  const inner=new THREE.Mesh(new THREE.RingGeometry(1.18,1.3,96),new THREE.MeshBasicMaterial({color:'#b9aa85',transparent:true,opacity:.26,side:THREE.DoubleSide}));inner.position.z=-.32;scene.add(inner);
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.56,1),new THREE.MeshPhongMaterial({color:'#d7cba9',shininess:100,transparent:true,opacity:.78}));core.position.z=.2;scene.add(core);
}
function makeStars() {
  const rng=random(260928),positions=[];
  for(let i=0;i<450;i++) {
    const a=rng()*Math.PI*2,r=13+rng()*17;
    positions.push(Math.cos(a)*r,Math.sin(a)*r,-2-rng()*9);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({color:'#8ca3c4',size:.055,transparent:true,opacity:.6,sizeAttenuation:true,depthWrite:false})));
}
function resizeScene() {
  if(!renderer)return;
  const w=$('scene').clientWidth,h=$('scene').clientHeight;
  renderer.setSize(w,h);if(composer){composer.setSize(w,h);bloom.setSize(w,h);}
  camera.aspect=w/h;
  if(mobile.matches){camera.position.set(0,-40,48);camera.fov=43;}
  else {camera.position.set(0,-25,28);camera.fov=43;}
  camera.updateProjectionMatrix();controls.target.set(0,0,0);controls.update();
  resizeMap();
}
function animateSeats(delta) {
  const step=reduceMotion?1:Math.min(1,delta*5.4);
  for (let group=0;group<2;group++) {
    const mesh=group?mayorMesh:councilMesh,seats=group?mayorSeats:councilSeats;
    let dirty=false;
    for(let i=0;i<seats.length;i++) {
      const seat=seats[i],difference=seat.target-seat.intensity;
      if(Math.abs(difference)<.001) continue;
      seat.intensity+=difference*step;
      if(Math.abs(seat.target-seat.intensity)<.001)seat.intensity=seat.target;
      const base=seat.race.kind==='mayor'?(emphasis==='mayor'?seat.scale*1.23:seat.scale):seat.scale;
      const lift=seat.race.kind==='mayor'?seat.intensity*.72:seat.intensity*1.25;
      dummy.position.copy(seat.pos);dummy.position.z+=lift;dummy.scale.setScalar(base*(.76+seat.intensity*.37));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      let partyColor=partyThreeColors.get(seat.party);
      if(!partyColor){partyColor=new THREE.Color(seat.party?color(seat.party):'#9caabc');partyThreeColors.set(seat.party,partyColor);}
      tmpColor.copy(neutral).lerp(partyColor,seat.intensity);
      mesh.setColorAt(i,tmpColor);dirty=true;
      if(mesh===councilMesh){
        const height=Math.max(.001,seat.pos.z+lift+.27);
        dummy.rotation.set(Math.PI/2,0,0);dummy.position.set(seat.pos.x,seat.pos.y,(seat.pos.z+lift-.27)/2);
        dummy.scale.set(.045*seat.intensity,height,.045*seat.intensity);dummy.updateMatrix();stemMesh.setMatrixAt(i,dummy.matrix);
        tmpColor.copy(neutral).lerp(partyColor,seat.intensity*.7);stemMesh.setColorAt(i,tmpColor);
        dummy.rotation.set(0,0,0);
      }
    }
    if(dirty){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
    if(dirty&&mesh===councilMesh){stemMesh.instanceMatrix.needsUpdate=true;stemMesh.instanceColor.needsUpdate=true;}
  }
  if(selected?.seat&&cardOpen){const seat=selected.seat;selectionHalo.visible=true;selectionHalo.position.copy(seat.pos);selectionHalo.position.z+=(seat.race.kind==='mayor'?seat.intensity*.72:seat.intensity*1.25);selectionHalo.scale.setScalar(seat.race.kind==='mayor'?.65:.37);}else selectionHalo.visible=false;
  for(let i=0;i<quotaCandidates.length;i++) {
    const {race,index}=quotaCandidates[i];
    let seat=null;
    if(race.progress===1)for(const current of race.seats)if(current.candidateIndex===index){seat=current;break;}
    if(seat){dummy.position.copy(seat.pos);dummy.position.z+=seat.intensity*1.25+.04;}
    else dummy.position.set(0,0,-10);
    dummy.scale.setScalar(seat?Math.max(.001,seat.intensity*.3):.001);dummy.updateMatrix();quotaMesh.setMatrixAt(i,dummy.matrix);
  }quotaMesh.instanceMatrix.needsUpdate=true;
}
function frame() {
  const now=performance.now(),delta=Math.min((now-lastFrame)/1000,.1);lastFrame=now;
  if(playing&&progress<1&&now-lastUpdate>75) {
    updateSnapshot(progress+Math.min((now-lastUpdate)/1000,.5)/42*speed);
    lastUpdate=now;
    if(progress>=1){playing=false;drawUI();}
  }
  animateSeats(delta);controls.update();if(composer)composer.render();else renderer.render(scene,camera);
  if(mapRenderer){mapRenderer.render(mapScene,mapCamera);}
  requestAnimationFrame(frame);
}

function pointerSeat(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects([mayorMesh,councilMesh],false);
  if(hits.length) return hits[0].object===mayorMesh?mayorSeats[hits[0].instanceId]:councilSeats[hits[0].instanceId];
  if(event.pointerType==='touch' || mobile.matches) {
    let closest=null,distance=24*24;
    const x=event.clientX-rect.left,y=event.clientY-rect.top;
    for(const seat of [...mayorSeats,...councilSeats]) {
      projected.copy(seat.pos).project(camera);
      const dx=(projected.x+1)*rect.width/2-x,dy=(1-projected.y)*rect.height/2-y,d=dx*dx+dy*dy;
      if(d<distance){distance=d;closest=seat;}
    }
    return closest;
  }
  return null;
}
function onSceneMove(event) {
  if(event.pointerType==='touch')return;
  const now=performance.now();if(now-lastPick<25)return;lastPick=now;
  const seat=pointerSeat(event);
  if(seat!==hovered){hovered=seat;updateMapHighlight();}
  renderer.domElement.style.cursor=seat?'pointer':'grab';
  const tip=$('seat-tooltip');tip.hidden=!seat;
  if(seat) {
    const race=seat.race,c=race.data.candidates[seat.candidateIndex];
    tip.replaceChildren();
    const title=document.createElement('strong');title.textContent=race.kind==='mayor'?`${seat.county.name}長`:`${seat.county.name} · ${race.data.name}`;
    const info=document.createElement('span');info.textContent=c?`${c.name} · ${c.party}`:'尚未開票';
    const small=document.createElement('small');small.textContent=race.progress===1?(c?.womenQuota?'婦女保障當選':'已定席'):`計票 ${Math.round(race.progress*100)}%`;
    tip.append(title,info,small);
    tip.style.left=Math.min(event.clientX,innerWidth-245)+'px';tip.style.top=Math.max(80,event.clientY)+'px';
  }
}
function onSceneClick(event) {
  const seat=pointerSeat(event);
  if(seat){selected={seat,race:seat.race,candidateIndex:null};cardOpen=true;drawCard();updateMapHighlight();}
}

function makeMap() {
  const holder=$('map-canvas');mapScene=new THREE.Scene();mapScene.background=new THREE.Color('#101a2a');
  mapScene.add(new THREE.HemisphereLight('#e5efff','#172638',2.1));
  const sun=new THREE.DirectionalLight('#f7e4bb',2.4);sun.position.set(-30,-40,75);mapScene.add(sun);
  mapCamera=new THREE.OrthographicCamera(-105,105,98,-98,.1,500);
  mapCamera.position.set(-14,-90,164);mapCamera.lookAt(-14,3,0);
  mapRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  mapRenderer.setPixelRatio(Math.min(devicePixelRatio,2));mapRenderer.outputColorSpace=THREE.SRGBColorSpace;
  mapRenderer.setSize(holder.clientWidth,holder.clientHeight);holder.appendChild(mapRenderer.domElement);
  for(const f of countyFeatures) {
    const code=f.properties.COUNTYCODE,polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    const group=new THREE.Group();group.userData.code=code;
    for(const polygon of polygons) {
      const ring=polygon[0],shape=new THREE.Shape();
      ring.forEach(([lon,lat],i)=>{const x=(lon-120.75)*36,y=(lat-23.73)*36;i?shape.lineTo(x,y):shape.moveTo(x,y);});
      for(const hole of polygon.slice(1)) {
        const path=new THREE.Path();hole.forEach(([lon,lat],i)=>{const x=(lon-120.75)*36,y=(lat-23.73)*36;i?path.lineTo(x,y):path.moveTo(x,y);});shape.holes.push(path);
      }
      const geo=new THREE.ExtrudeGeometry(shape,{depth:1.8,bevelEnabled:true,bevelThickness:.42,bevelSize:.24,bevelSegments:1,steps:1});
      const material=new THREE.MeshPhongMaterial({color:'#647e9a',shininess:48,flatShading:true,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(geo,material);mesh.userData.code=code;group.add(mesh);
    }
    if(code==='09020'||code==='09007') {
      const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3()),width=bounds.max.x-bounds.min.x;
      const factor=Math.min(4.5,Math.max(1,6/Math.max(width,.1)));
      group.scale.setScalar(factor);group.position.set(center.x*(1-factor),center.y*(1-factor),0);
    }
    mapScene.add(group);mapGroups.set(code,group);
  }
  holder.addEventListener('pointermove',event=>{holder.style.cursor=mapHit(event)?'pointer':'default';});
  holder.addEventListener('click',event=>{const code=mapHit(event);if(code)selectCounty(code);});
  document.querySelectorAll('.map-island').forEach(button=>button.addEventListener('click',()=>selectCounty(button.dataset.code)));
  resizeMap();updateMapHighlight();
}
function mapHit(event) {
  const rect=mapRenderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,mapCamera);
  const hits=raycaster.intersectObjects([...mapGroups.values()],true);
  return hits[0]?.object.userData.code || null;
}
function resizeMap() {
  if(!mapRenderer)return;
  const holder=$('map-canvas'),w=holder.clientWidth,h=holder.clientHeight;
  mapRenderer.setSize(w,h);
  const halfH=98;mapCamera.left=-halfH*w/h;mapCamera.right=halfH*w/h;mapCamera.top=halfH;mapCamera.bottom=-halfH;mapCamera.updateProjectionMatrix();
}
function updateMapHighlight() {
  if(!mapScene)return;
  const code=hovered?.county.code || selected?.race.county.code || (countyFilter==='all'?null:countyFilter);
  for(const [key,group] of mapGroups) {
    const active=key===code;
    group.children.forEach(mesh=>{mesh.material.color.set(active?'#e7c881':'#647e9a');mesh.material.emissive.set(active?'#65502b':'#081321');mesh.material.emissiveIntensity=active?.31:.08;});
  }
  const county=counties.find(c=>c.code===code);
  $('map-name').textContent=county?.name || '全臺';
  document.querySelectorAll('.map-island').forEach(button=>button.classList.toggle('active',button.dataset.code===code));
}
function selectCounty(code) {
  countyFilter=code;$('county-filter').value=code;
  const county=counties.find(c=>c.code===code);
  const race=mayorRaces.find(r=>r.county===county);
  if(race){selected={seat:race.seats[0],race,candidateIndex:null};cardOpen=true;}
  refreshTargets();drawUI();updateMapHighlight();
}
function refreshTargets() {for(const seat of councilSeats)seat.target=seatTarget(seat);for(const seat of mayorSeats)seat.target=seatTarget(seat);}

function renderTally(container,tally) {
  container.replaceChildren();
  for(const [party,label] of SUMMARY_PARTIES) {
    const n=party==='other'?Object.entries(tally).reduce((sum,[name,count])=>sum+(SUMMARY_PARTIES.some(([key])=>key===name)?0:count),0):(tally[party]||0);
    const cell=document.createElement('div');cell.className='party-cell';cell.style.setProperty('--party',party==='other'?'#a9a7bb':color(party));
    cell.innerHTML=`<i></i><span>${label}</span><strong>${n}</strong>`;container.appendChild(cell);
  }
}
function progressLabel() { return decidedMayor===22&&decidedCouncil===910?100:Math.min(99,Math.floor(overall*100)); }
function drawUI() {
  $('overall-progress').textContent=progressLabel();
  $('counting-status').textContent=progress===0?'尚未開始':mobile.matches?`已定席 ${decidedCouncil} / 910 位議員`:`已定席 ${decidedMayor} 位縣市長・${decidedCouncil} 位議員`;
  $('mayor-decided').innerHTML=`${decidedMayor} <small>/ 22</small>`;
  $('council-decided').innerHTML=`${decidedCouncil} <small>/ 910</small>`;
  renderTally($('mayor-tally'),tallyMayor);renderTally($('council-tally'),tallyCouncil);
  $('timeline').value=Math.round(progress*1000);$('timeline').style.setProperty('--fill',`${progress*100}%`);
  $('timeline-value').textContent=`${Math.round(progress*100)}%`;
  $('play-label').textContent=playing?'暫停':progress>=1?'重播':'播放';
  $('play').setAttribute('aria-label',playing?'暫停重播':progress>=1?'重新播放':'播放重播');
  $('play-icon').innerHTML=playing?'<rect x="7" y="5" width="3" height="14" rx=".5" fill="currentColor"/><rect x="14" y="5" width="3" height="14" rx=".5" fill="currentColor"/>':'<path d="m8 5 11 7-11 7V5Z" fill="currentColor"/>';
  const focus=selected?.race || mayorRaces.find(r=>r.county.name==='臺北市');
  const lead=focus?.data.candidates[focus.leader];
  $('mobile-race').textContent=focus?(focus.kind==='mayor'?`${focus.county.name}長`:`${focus.county.name} · ${focus.data.name}`):'臺北市長';
  $('mobile-name').textContent=lead?.name || '待開票';
  $('mobile-share').textContent=lead?`${focus.progress===1?lead.pct.toFixed(2):(focus.votes[focus.leader]/focus.total*100).toFixed(1)}% · ${focus.progress===1?'已定席':'目前領先'}`:'';
  drawCard();
}
function makeAvatar(candidate) {
  const avatar=document.createElement('span');avatar.className='avatar';avatar.style.setProperty('--party',color(candidate.party));avatar.textContent=candidate.name[0]||'候';
  const src=photoURL(candidate);
  if(src){const img=document.createElement('img');img.alt=`${candidate.name}照片`;img.src=src;img.onerror=()=>img.remove();avatar.appendChild(img);}
  return avatar;
}
function drawCard() {
  const card=$('candidate-card');card.classList.toggle('open',cardOpen&&!!selected);
  if(!selected||!cardOpen)return;
  const {race}=selected,candidateIndex=selected.candidateIndex ?? selected.seat?.candidateIndex ?? -1;
  $('card-race').textContent=race.kind==='mayor'?`${race.county.name}長`:`${race.county.name}議員 · ${race.data.name}`;
  const candidate=race.data.candidates[candidateIndex];
  const key=race.id+'-'+candidateIndex;
  if(cardKey!==key) {
    cardKey=key;const body=$('card-body');body.replaceChildren();
    if(!candidate){body.innerHTML='<p class="card-lead">尚未開票。請播放重播或移動時間軸查看計票結果。</p>';return;}
    const person=document.createElement('div');person.className='card-person';person.appendChild(makeAvatar(candidate));
    const title=document.createElement('div');title.style.minWidth='0';
    const name=document.createElement('h2');name.textContent=candidate.name;
    const party=document.createElement('div');party.className='card-party';party.style.setProperty('--party',color(candidate.party));party.innerHTML='<i></i>';party.append(document.createTextNode(candidate.party));
    title.append(name,party);person.appendChild(title);
    const badges=document.createElement('div');badges.className='card-badges';badges.id='card-badges';
    const votes=document.createElement('div');votes.className='card-votes';votes.innerHTML='<strong id="card-vote-number">0</strong><span>票</span><em id="card-share">0%</em>';
    const meta=document.createElement('div');meta.className='card-meta';meta.innerHTML='<div><span>選區</span><strong id="card-district"></strong></div><div><span>應選名額</span><strong id="card-seats"></strong></div><div><span>計票進度</span><strong id="card-progress"></strong></div><div><span>候選人號次</span><strong id="card-number"></strong></div>';
    const lead=document.createElement('div');lead.className='card-lead';lead.id='card-lead';
    body.append(person,badges,votes,meta,lead);
  }
  if(!candidate)return;
  const current=race.votes[candidateIndex],share=race.total?current/race.total*100:0;
  $('card-vote-number').textContent=fmt.format(current);
  $('card-share').textContent=`${race.progress===1?candidate.pct.toFixed(2):share.toFixed(1)}%`;
  $('card-district').textContent=race.kind==='mayor'?race.county.name:race.data.name;
  $('card-seats').textContent=race.kind==='mayor'?'1 席':`${race.data.seats} 席`;
  $('card-progress').textContent=`${Math.round(race.progress*100)}%`;
  $('card-number').textContent=`${candidate.no} 號`;
  const badges=$('card-badges');badges.replaceChildren();
  const badge=document.createElement('span');badge.className='badge';
  if(race.progress===1&&candidate.elected){badge.classList.add(candidate.womenQuota?'quota':'elected');badge.textContent=candidate.womenQuota?'婦女保障當選':'當選';}
  else if(race.progress===1){badge.textContent='未當選';}
  else if(race.kind==='mayor'&&race.leader===candidateIndex){badge.classList.add('lead');badge.textContent='目前領先';}
  else badge.textContent='計票中';
  badges.appendChild(badge);
  const leader=race.data.candidates[race.leader];
  $('card-lead').textContent=leader?`本選區目前最高票：${leader.name}（${fmt.format(race.votes[race.leader])} 票）`:'尚未開票';
}

function fullTallyHTML(tally,total) {
  const parties=Object.keys(tally).sort((a,b)=>tally[b]-tally[a]||a.localeCompare(b,'zh-TW'));
  return parties.length?parties.map(p=>`<p style="--party:${escapeHTML(color(p))}"><i></i>${escapeHTML(p)}　${fmt.format(tally[p])} 席</p>`).join(''):'<p>尚無已定席次</p>';
}
function showTextView(kind=textKind) {
  textMode=true;playing=false;textKind=kind;drawUI();$('text-view').hidden=false;$('view-toggle').setAttribute('aria-pressed','true');
  $('text-progress').textContent=`模擬計票進度 ${progressLabel()}%。選區完成計票後才標示當選。`;
  $('text-mayor').classList.toggle('active',kind==='mayor');$('text-council').classList.toggle('active',kind==='council');
  $('text-mayor').setAttribute('aria-pressed',String(kind==='mayor'));$('text-council').setAttribute('aria-pressed',String(kind==='council'));
  $('text-tallies').innerHTML=`<section><h3>縣市長　${decidedMayor} / 22</h3>${fullTallyHTML(tallyMayor,22)}</section><section><h3>議員　${decidedCouncil} / 910</h3>${fullTallyHTML(tallyCouncil,910)}</section>`;
  renderTextList();$('text-view').scrollTop=0;
}
function renderCandidates(race) {
  const candidates=race.data.candidates;
  return race.order.map(i=>{
    const c=candidates[i],votes=race.votes[i],pct=race.total?votes/race.total*100:0;
    const badge=race.progress===1?(c.elected?(c.womenQuota?'婦女保障當選':'當選'):''):'';
    return `<div class="text-candidate"><div><span class="name">${escapeHTML(c.name)}</span><div class="party" style="--party:${escapeHTML(color(c.party))}"><i></i>${escapeHTML(c.party)}</div></div><span class="votes">${fmt.format(votes)} 票 · ${race.progress===1?c.pct.toFixed(2):pct.toFixed(1)}%</span><span class="status">${badge}</span><button type="button" data-race="${escapeHTML(race.id)}" data-candidate="${i}" aria-label="查看${escapeHTML(c.name)}詳情">詳情</button></div>`;
  }).join('');
}
function renderTextList() {
  const list=$('text-list');
  if(textKind==='mayor') {
    list.innerHTML=mayorRaces.map(r=>`<details><summary><strong>${escapeHTML(r.county.name)}長</strong><small>計票 ${Math.round(r.progress*100)}% · ${r.progress===1?'已定席':'計票中'}</small></summary><div class="text-candidates">${renderCandidates(r)}</div></details>`).join('');
  } else {
    list.innerHTML=counties.map(c=>{
      const races=councilRaces.filter(r=>r.county===c),done=races.reduce((sum,r)=>sum+(r.progress===1?r.data.seats:0),0);
      return `<details><summary><strong>${escapeHTML(c.name)}</strong><small>已定 ${done} / ${c.council.seats} 席 · ${races.length} 個選區</small></summary><div class="districts">${races.map(r=>`<details><summary><strong>${escapeHTML(r.data.name)}</strong><small>${escapeHTML(r.data.type)} · 應選 ${r.data.seats} 席 · 計票 ${Math.round(r.progress*100)}%</small></summary><div class="text-candidates">${renderCandidates(r)}</div></details>`).join('')}</div></details>`;
    }).join('');
  }
}

function bindUI() {
  for(const county of counties){const option=document.createElement('option');option.value=county.code;option.textContent=county.name;$('county-filter').appendChild(option);}
  const parties=[...new Set([...mayorRaces,...councilRaces].flatMap(r=>r.data.candidates.filter(c=>c.elected).map(c=>c.party)))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
  for(const party of parties){const option=document.createElement('option');option.value=party;option.textContent=party;$('party-filter').appendChild(option);}
  $('county-filter').addEventListener('change',event=>{countyFilter=event.target.value;refreshTargets();updateMapHighlight();});
  $('party-filter').addEventListener('change',event=>{partyFilter=event.target.value;refreshTargets();});
  for(const kind of ['mayor','council'])$(''+kind+'-emphasis').addEventListener('click',()=>{
    emphasis=kind;for(const type of ['mayor','council']){$(type+'-emphasis').classList.toggle('active',type===kind);$(type+'-emphasis').setAttribute('aria-pressed',String(type===kind));}
    refreshTargets();
  });
  $('play').addEventListener('click',()=>{if(progress>=1)updateSnapshot(0);playing=!playing;lastUpdate=performance.now();drawUI();});
  $('timeline').addEventListener('input',event=>{playing=false;updateSnapshot(Number(event.target.value)/1000);});
  $('speed').addEventListener('click',()=>{speed=speed===1?2:speed===2?4:1;$('speed').textContent=`${speed}×`;$('speed').setAttribute('aria-label',`播放速度 ${speed} 倍`);});
  $('card-close').addEventListener('click',()=>{cardOpen=false;drawCard();});
  $('view-toggle').addEventListener('click',()=>showTextView());
  $('visual-toggle').addEventListener('click',()=>{textMode=false;$('text-view').hidden=true;$('view-toggle').setAttribute('aria-pressed','false');$('view-toggle').focus();});
  $('text-mayor').addEventListener('click',()=>showTextView('mayor'));
  $('text-council').addEventListener('click',()=>showTextView('council'));
  $('text-list').addEventListener('click',event=>{
    const button=event.target.closest('button[data-race]');if(!button)return;
    const race=[...mayorRaces,...councilRaces].find(r=>r.id===button.dataset.race);
    selected={race,seat:null,candidateIndex:Number(button.dataset.candidate)};cardOpen=true;cardKey='';
    textMode=false;$('text-view').hidden=true;$('view-toggle').setAttribute('aria-pressed','false');drawCard();updateMapHighlight();
  });
  const pop=document.createElement('div');pop.className='party-popover';pop.hidden=true;pop.id='party-popover';$('app').appendChild(pop);
  $('all-parties').addEventListener('click',()=>{
    pop.hidden=!pop.hidden;
    if(!pop.hidden){
      const names=[...new Set([...Object.keys(tallyMayor),...Object.keys(tallyCouncil)])].sort((a,b)=>(tallyCouncil[b]||0)-(tallyCouncil[a]||0));
      pop.innerHTML=`<h3>各政黨已定席次</h3><div class="party-pop-row"><span>政黨</span><span>縣市長</span><span>議員</span></div>${names.map(p=>`<div class="party-pop-row" style="--party:${escapeHTML(color(p))}"><span><i></i>${escapeHTML(p)}</span><span>${tallyMayor[p]||0}</span><span>${tallyCouncil[p]||0}</span></div>`).join('')}`;
    }
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){pop.hidden=true;if(mobile.matches){cardOpen=false;drawCard();}}});
}

async function load() {
  try {
    const paths=['../../data/mayor-2022.json','../../data/council-2022.json','../../data/taiwan-atlas-counties-10t.json'];
    const [m,c,t]=await Promise.all(paths.map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error('資料載入失敗');return response.json();}));
    mayorData=m;councilData=c;countyFeatures=feature(t,t.objects.counties).features;
    prepareData();makeScene();makeMap();bindUI();
    const parameter=new URLSearchParams(location.search).get('t');
    const jump=parameter!==null?Number(parameter):0;
    if(parameter!==null&&!Number.isFinite(jump))throw new Error('重播進度參數無效');
    const taipei=mayorRaces.find(r=>r.county.name==='臺北市');selected={race:taipei,seat:taipei.seats[0],candidateIndex:null};
    cardOpen=!mobile.matches;updateSnapshot(clamp(jump));updateMapHighlight();
    window.__galaxy={setProgress(value){playing=false;updateSnapshot(value);},getState(){return {progress,overall,decidedMayor,decidedCouncil,tallyMayor:{...tallyMayor},tallyCouncil:{...tallyCouncil}};},selectCounty};
    const delay=reduceMotion?0:1050;
    setTimeout(()=>{
      $('loading').classList.add('done');$('app').classList.add('ready');
      if(parameter===null&&!reduceMotion){playing=true;lastUpdate=performance.now();drawUI();}
    },delay);
  } catch(error) {
    $('loading-message').textContent='資料載入失敗，請重新整理頁面。';
    $('loading').classList.add('failed');
    console.error(error);
  }
}
load();
