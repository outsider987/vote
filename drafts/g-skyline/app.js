import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('zh-TW');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const regions = [
  { name: '北部', codes: ['10017','63000','65000','68000','10002','10018','10004'] },
  { name: '中部', codes: ['10005','66000','10007','10008','10009'] },
  { name: '南部', codes: ['10020','10010','67000','64000','10013'] },
  { name: '東部', codes: ['10015','10014'] },
  { name: '離島', codes: ['10016','09020','09007'] }
];
const order = regions.flatMap(region => region.codes);
const palette = {
  '中國國民黨':'#66a9f4','民主進步黨':'#64d29b','台灣民眾黨':'#59d2d4',
  '時代力量':'#ead364','無黨籍及未經政黨推薦':'#b6bcc8','親民黨':'#f1a778',
  '台灣基進':'#ec8e70','綠黨':'#92c978','無黨團結聯盟':'#d19abc'
};
const short = {'中國國民黨':'國民黨','民主進步黨':'民進黨','台灣民眾黨':'民眾黨','無黨籍及未經政黨推薦':'無黨籍'};
const color = party => palette[party] || '#aab4c4';
const shortParty = party => short[party] || party;
const decodeName = name => name.replace(/@([0-9A-Fa-f]{4,6})@/g, (_, code) => String.fromCodePoint(parseInt(code,16)));
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const ease = x => x*x*(3-2*x);
function hash(value){let h=2166136261;for(const ch of value){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function random(seed){return () => {seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}

let mayor, council, counties, state;
let renderer, scene, camera, sky, stars, ambient, sunLight, fog, farBlocks, mayorGroup, councilGroup;
let stages=[], mayorTowers=[], councilTowers=[], towerMeshes=[], windowSets=[];
let selected=1, mode='mayor', districtIndex=0, playing=true, speed=1, progress=0;
let cameraX=0, targetX=0, lastFrame=0, lastUi=0, lastWindow=0, pointer=null, wheelTimer=0;
const raycaster = new THREE.Raycaster(), pointerNdc = new THREE.Vector2(), projector = new THREE.Vector3(), scratch = new THREE.Object3D();
const duskFog = new THREE.Color('#5c5261'), nightFog = new THREE.Color('#101b2b');
const farNight = new THREE.Color('#263551');
const starPositions=[];
let flagTower=null, simDelta=0;

function prepareRace(race, councilRace=false){
  const rnd=random(hash(race.id || race.code));
  race._start=.015+rnd()*.17;
  race._end=(councilRace?.39:.55)+rnd()*(councilRace?.57:.42);
  race._phases=race.candidates.map(() => ({a:rnd()*Math.PI*2,b:rnd()*Math.PI*2,f:14+rnd()*16}));
  race._live=new Array(race.candidates.length).fill(0);
  race._progress=0;
  race._counted=0;
}

function countRace(race,t){
  const p=t>=race._end?1:t<=race._start?0:ease((t-race._start)/(race._end-race._start));
  race._progress=p;
  if(p===1){
    race._counted=race.valid;
    race.candidates.forEach((candidate,i) => race._live[i]=candidate.votes);
  }else if(p===0){
    race._counted=0;
    race._live.fill(0);
  }else{
    const total=Math.round(race.valid*p), weights=[], fractions=[];
    let sum=0, used=0;
    race.candidates.forEach((candidate,i) => {
      const wave=race._phases[i];
      const wobble=(Math.sin(t*wave.f+wave.a)+.45*Math.sin(t*wave.f*1.87+wave.b))/1.45;
      const weight=Math.max(.00001,(candidate.votes/race.valid)*(1+.87*(1-p)*wobble));
      weights.push(weight);sum+=weight;
    });
    weights.forEach((weight,i) => {
      const exact=total*weight/sum;
      race._live[i]=Math.floor(exact);used+=race._live[i];
      fractions.push([exact-race._live[i],i]);
    });
    fractions.sort((a,b) => b[0]-a[0] || a[1]-b[1]);
    for(let i=0;i<total-used;i++)race._live[fractions[i][1]]++;
    race._counted=total;
  }
  let leader=0;
  for(let i=1;i<race._live.length;i++)if(race._live[i]>race._live[leader])leader=i;
  race._leader=leader;
}

function prepareData(m,c){
  const byMayor=new Map(m.counties.map(x=>[x.code,x]));
  const byCouncil=new Map(c.counties.map(x=>[x.code,x]));
  counties=order.map((code,i) => {
    const mayorRace=byMayor.get(code), councilCounty=byCouncil.get(code);
    if(!mayorRace || !councilCounty)throw new Error(`缺少 ${code} 選舉資料`);
    prepareRace(mayorRace);
    for(const district of councilCounty.districts)prepareRace(district,true);
    const partyFinal=new Map();
    for(const district of councilCounty.districts)for(const candidate of district.candidates)partyFinal.set(candidate.party,(partyFinal.get(candidate.party)||0)+candidate.votes);
    councilCounty._partyFinal=partyFinal;
    councilCounty._partyLive=new Map([...partyFinal].map(([party])=>[party,0]));
    councilCounty._maxParty=Math.max(...partyFinal.values());
    return {code,name:mayorRace.name,region:regions.find(r=>r.codes.includes(code)).name,mayor:mayorRace,council:councilCounty,index:i};
  });
  const electedMayors=counties.filter(x=>x.mayor.candidates.filter(c=>c.elected).length===1).length;
  const electedCouncil=counties.reduce((n,x)=>n+x.council.districts.reduce((a,d)=>a+d.candidates.filter(c=>c.elected).length,0),0);
  if(electedMayors!==22 || electedCouncil!==910)throw new Error('選舉席次資料檢查失敗');
}

function positionCounties(){
  let x=0;
  counties.forEach((county,i) => {if(i && county.region!==counties[i-1].region)x+=county.region==='離島'?10:4;county.x=x;x+=13.4});
}

function makeStage(county){
  const group=new THREE.Group();group.position.x=county.x;scene.add(group);
  const offshore=county.region==='離島';
  const base=new THREE.Mesh(new THREE.BoxGeometry(11.9,.65,14.2),new THREE.MeshStandardMaterial({color:offshore?'#153341':'#172333',metalness:.45,roughness:.55}));
  base.position.y=-.26;base.receiveShadow=true;group.add(base);
  const top=new THREE.Mesh(new THREE.BoxGeometry(11.7,.05,14),new THREE.MeshStandardMaterial({color:'#253244',metalness:.55,roughness:.46}));
  top.position.y=.085;group.add(top);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(11.8,.09,.07),new THREE.MeshBasicMaterial({color:'#8c817e'}));
  edge.position.set(0,.13,7.02);group.add(edge);
  const mark=new THREE.Mesh(new THREE.BoxGeometry(3.1,.03,.045),new THREE.MeshBasicMaterial({color:'#f8c891'}));
  mark.position.set(0,.19,7.01);mark.visible=false;group.add(mark);
  if(offshore)for(const z of [6.15,5.83,5.51]){
    const wave=new THREE.Mesh(new THREE.BoxGeometry(9.8,.025,.045),new THREE.MeshBasicMaterial({color:'#62adc5',transparent:true,opacity:.42}));
    wave.position.set(0,.14,z);group.add(wave);
  }
  for(const x of [-5.65,5.65]){
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:offshore?'#79c9da':'#eab989'}));
    lamp.position.set(x,.2,6.8);group.add(lamp);
  }
  base.userData.countyIndex=county.index;
  stages.push({group,mark,base,county});towerMeshes.push(base);
}

const boxGeo=new THREE.BoxGeometry(1,1,1);
const capGeo=new THREE.BoxGeometry(1,.18,1);
const coneGeo=new THREE.CylinderGeometry(.64,.035,24,18,1,true);
const ringGeo=new THREE.TorusGeometry(.71,.035,5,24);

function makeTower(county,party,label,finalVotes,rank,modeName){
  const col=[0,-2.25,2.25,-4.5,4.5][rank%5], row=Math.floor(rank/5), z=3.55-row*2.28;
  const parent=modeName==='mayor'?mayorGroup:councilGroup;
  const group=new THREE.Group();group.position.set(county.x+col,0,z);parent.add(group);
  const tint=new THREE.Color(color(party));
  const facade=tint.clone().lerp(new THREE.Color('#172437'),.72);
  const side=new THREE.MeshStandardMaterial({color:facade.clone().multiplyScalar(.5),metalness:.7,roughness:.46});
  const front=new THREE.MeshStandardMaterial({color:facade,metalness:.68,roughness:.42,emissive:tint.clone().multiplyScalar(.035)});
  const body=new THREE.Mesh(boxGeo,[side,side,front,side,front,side]);
  body.scale.set(1.66,1,1.56);body.castShadow=false;group.add(body);
  const trim=new THREE.Mesh(capGeo,new THREE.MeshStandardMaterial({color:tint,emissive:tint.clone().multiplyScalar(.28),metalness:.4,roughness:.3}));
  trim.scale.set(1.8,1,1.7);group.add(trim);
  const beam=new THREE.Mesh(coneGeo,new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.105,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  beam.position.y=12;beam.visible=false;group.add(beam);
  const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.85,depthWrite:false}));
  ring.rotation.x=Math.PI/2;ring.visible=false;group.add(ring);
  const fins=[];
  if(rank<3)for(const offset of [-.81,.81]){
    const fin=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:tint.clone().multiplyScalar(.52)}));
    fin.scale.set(.035,1,.05);fin.position.set(offset,.5,.82);group.add(fin);fins.push(fin);
  }
  body.userData={countyIndex:county.index,label,party,mode:modeName};
  towerMeshes.push(body);
  return {county,party,label,finalVotes,group,body,trim,beam,ring,fins,rank,mode:modeName,currentHeight:4.5,targetHeight:4.5,progress:0,wasCalled:false,flash:0,tint};
}

function makeTowers(){
  mayorGroup=new THREE.Group();councilGroup=new THREE.Group();scene.add(mayorGroup,councilGroup);
  for(const county of counties){
    const mayorOrder=county.mayor.candidates.map((candidate,i)=>({candidate,i})).sort((a,b)=>b.candidate.votes-a.candidate.votes);
    const mayorMax=mayorOrder[0].candidate.votes;
    mayorOrder.forEach(({candidate,i},rank)=>{
      const tower=makeTower(county,candidate.party,decodeName(candidate.name),candidate.votes,rank,'mayor');
      tower.race=county.mayor;tower.candidateIndex=i;tower.maxVotes=mayorMax;tower.winner=candidate.elected;
      mayorTowers.push(tower);
    });
    const parties=[...county.council._partyFinal].sort((a,b)=>b[1]-a[1]);
    parties.forEach(([party,votes],rank)=>{
      const tower=makeTower(county,party,shortParty(party),votes,rank,'council');
      tower.maxVotes=county.council._maxParty;
      councilTowers.push(tower);
    });
  }
  councilGroup.visible=false;
  makeWindows(mayorTowers,mayorGroup);
  makeWindows(councilTowers,councilGroup);
}

function makeWindows(towers,parent){
  const instances=[], rnd=random(hash(parent===mayorGroup?'mayor-windows':'council-windows'));
  for(const tower of towers){
    for(let row=0;row<20;row++)for(const column of [-.39,.39]){
      instances.push({tower,x:tower.group.position.x+column,y:.7+row*1.12,z:tower.group.position.z+.79,threshold:rnd(),twinkle:rnd()});
    }
  }
  const windows=new THREE.InstancedMesh(new THREE.PlaneGeometry(.27,.34),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide,toneMapped:false}),instances.length);
  windows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  windows.frustumCulled=false;parent.add(windows);
  const dim=new THREE.Color('#26364a');
  windowSets.push({windows,instances,dim,mode:parent===mayorGroup?'mayor':'council'});
  updateWindows(windowSets.at(-1));
}

function updateWindows(set){
  const {windows,instances,dim}=set;
  for(let i=0;i<instances.length;i++){
    const w=instances[i],tower=w.tower,visible=w.y<tower.currentHeight-.14;
    scratch.position.set(w.x,w.y,w.z);
    scratch.rotation.set(0,0,0);
    scratch.scale.setScalar(visible?1:.001);
    scratch.updateMatrix();windows.setMatrixAt(i,scratch.matrix);
    windows.setColorAt(i,visible && w.threshold<tower.progress*1.12 ? tower.tint : dim);
  }
  windows.instanceMatrix.needsUpdate=true;
  if(windows.instanceColor)windows.instanceColor.needsUpdate=true;
}

function makeScene(){
  scene=new THREE.Scene();scene.background=new THREE.Color('#0b1221');
  const holder=$('scene');
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(holder.clientWidth,holder.clientHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.14;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  holder.prepend(renderer.domElement);
  camera=new THREE.PerspectiveCamera(innerWidth<601?43:39,holder.clientWidth/holder.clientHeight,.1,20000);
  sky=new Sky();sky.scale.setScalar(10000);scene.add(sky);
  sky.material.uniforms.turbidity.value=8;
  sky.material.uniforms.rayleigh.value=2.35;
  sky.material.uniforms.mieCoefficient.value=.006;
  sky.material.uniforms.mieDirectionalG.value=.78;
  sky.material.uniforms.skylineNightMix={value:0};
  sky.material.uniforms.skylineLate={value:0};
  sky.material.fragmentShader=sky.material.fragmentShader.replace('uniform float showSunDisc;','uniform float showSunDisc;\n uniform float skylineNightMix;\n uniform float skylineLate;').replace('gl_FragColor = vec4( texColor, 1.0 );',`
    float horizon = smoothstep( 0.0, 1.0, clamp( normalize( vWorldPosition ).y * 1.7 + 0.39, 0.0, 1.0 ) );
    vec3 duskSky = mix( vec3( 0.30, 0.095, 0.105 ), vec3( 0.035, 0.055, 0.135 ), horizon );
    vec3 lateSky = mix( vec3( 0.025, 0.034, 0.068 ), vec3( 0.007, 0.014, 0.040 ), horizon );
    texColor = mix( texColor, mix( duskSky, lateSky, skylineLate ), skylineNightMix );
    gl_FragColor = vec4( texColor, 1.0 );`);
  sky.material.needsUpdate=true;
  ambient=new THREE.HemisphereLight('#c6d6ff','#3d3042',1.05);scene.add(ambient);
  sunLight=new THREE.DirectionalLight('#ffc69d',1.4);sunLight.position.set(-90,60,-40);scene.add(sunLight);
  fog=new THREE.FogExp2(duskFog,.004);scene.fog=fog;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,300),new THREE.MeshStandardMaterial({color:'#0c1725',metalness:.55,roughness:.48}));
  ground.rotation.x=-Math.PI/2;ground.position.set(150,-.64,0);scene.add(ground);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(1400,3),new THREE.MeshBasicMaterial({color:'#18283b',transparent:true,opacity:.8}));
  road.rotation.x=-Math.PI/2;road.position.set(150,-.625,10.6);scene.add(road);
  for(const z of [9.1,12.5,18.5,27]){
    const lane=new THREE.Mesh(new THREE.BoxGeometry(900,.012,.035),new THREE.MeshBasicMaterial({color:z===9.1?'#e5ba87':'#4e86a9',transparent:true,opacity:z===9.1?.37:.2}));
    lane.position.set(150,-.61,z);scene.add(lane);
  }
  const distantRnd=random(10928);
  farBlocks=new THREE.InstancedMesh(boxGeo,new THREE.MeshBasicMaterial({color:'#5c5260',transparent:true,opacity:.24,depthWrite:false}),165);
  for(let i=0;i<165;i++){
    const height=2+distantRnd()*7;
    scratch.position.set(-80+i*3.35+(distantRnd()-.5)*2,height/2-.4,-48-distantRnd()*16);
    scratch.scale.set(.9+distantRnd()*1.8,height,1.1+distantRnd()*1.8);
    scratch.rotation.set(0,0,0);scratch.updateMatrix();farBlocks.setMatrixAt(i,scratch.matrix);
  }
  farBlocks.instanceMatrix.needsUpdate=true;farBlocks.frustumCulled=false;scene.add(farBlocks);
  const starRnd=random(6262);
  for(let i=0;i<260;i++){starPositions.push((starRnd()-.5)*1000,60+starRnd()*300,-210-starRnd()*380)}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#e8e4d8',size:1.4,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);
  positionCounties();counties.forEach(makeStage);makeTowers();makeLabels();
  const initial=innerWidth<601?0:7;
  cameraX=targetX=counties[selected].x+initial;
  camera.position.set(cameraX+(innerWidth<601?3:8),innerWidth<601?12:12.5,innerWidth<601?47:55);
  camera.lookAt(cameraX,innerWidth<601?11:10.5,0);
  updateAtmosphere(0);
  addEventListener('resize',resize);
  holder.addEventListener('pointerdown',onPointerDown);
  holder.addEventListener('pointermove',onPointerMove);
  holder.addEventListener('pointerup',onPointerUp);
  holder.addEventListener('pointercancel',onPointerUp);
  holder.addEventListener('wheel',onWheel,{passive:false});
  resize();
}

function updateAtmosphere(t){
  const dusk=clamp(t/.65,0,1), night=ease(dusk);
  const elevation=7-16*ease(clamp(t/.75,0,1));
  const phi=THREE.MathUtils.degToRad(240);
  const theta=THREE.MathUtils.degToRad(90-elevation);
  sky.material.uniforms.sunPosition.value.setFromSphericalCoords(1,theta,phi);
  sky.material.uniforms.rayleigh.value=2.35-night*.8;
  sky.material.uniforms.turbidity.value=8+night*3;
  sky.material.uniforms.skylineNightMix.value=ease(clamp((t-.12)/.5,0,1));
  sky.material.uniforms.skylineLate.value=ease(clamp((t-.36)/.64,0,1));
  ambient.intensity=1.05-night*.57;
  sunLight.intensity=1.4-night*1.18;
  fog.color.copy(duskFog).lerp(nightFog,night);
  fog.density=.004+night*.001;
  farBlocks.material.color.copy(duskFog).lerp(farNight,night);
  farBlocks.material.opacity=.28+night*.08;
  stars.material.opacity=Math.max(0,(t-.26)/.48)*.88;
  renderer.toneMappingExposure=1.14-night*.16;
}

function makeLabels(){
  const host=$('countyLabels');
  for(const county of counties){
    const button=document.createElement('button');button.type='button';button.className='county-label';
    button.innerHTML=`<strong>${esc(county.name)}</strong><small>${county.region} · 已開票 0%</small>`;
    button.addEventListener('click',e=>{e.stopPropagation();selectCounty(county.index)});
    host.appendChild(button);county.labelButton=button;
  }
}

function updateLabels(){
  const rect=$('scene').getBoundingClientRect(),w=rect.width,h=rect.height;
  for(const county of counties){
    projector.set(county.x,.25,7.4).project(camera);
    const x=(projector.x+1)*w/2,y=(1-projector.y)*h/2;
    const show=projector.z<1 && x>-70 && x<w+70 && y>90 && y<h-10;
    county.labelButton.hidden=!show;
    if(show){county.labelButton.style.left=`${x}px`;county.labelButton.style.top=`${y}px`}
  }
}

function updateLeaderFlag(){
  const flag=$('leaderFlag');
  if(!flagTower || innerWidth<601){flag.style.display='none';return}
  const rect=$('scene').getBoundingClientRect();
  projector.set(flagTower.group.position.x,flagTower.currentHeight+1.4,flagTower.group.position.z).project(camera);
  const x=(projector.x+1)*rect.width/2,y=(1-projector.y)*rect.height/2;
  flag.style.display=projector.z<1 && x>90 && x<rect.width-90 && y>110 && y<rect.height-70?'block':'none';
  flag.style.left=`${x}px`;flag.style.top=`${y}px`;
}

function resize(){
  if(!renderer)return;
  const holder=$('scene'),w=holder.clientWidth,h=holder.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(w,h);
  camera.aspect=w/h;camera.fov=innerWidth<601?43:39;camera.updateProjectionMatrix();
  camera.position.y=innerWidth<601?12:12.5;
  camera.position.z=innerWidth<601?47:55;
  const offset=innerWidth<601?0:7;
  targetX=counties[selected].x+offset;
  if(reducedMotion.matches)cameraX=targetX;
  updateCamera();updateLabels();
}

function updateCamera(){
  camera.position.x=cameraX+(innerWidth<601?3:8);
  camera.lookAt(cameraX,innerWidth<601?11:10.5,0);
}

function nearestCounty(){
  const offset=innerWidth<601?0:7;
  let nearest=0,distance=Infinity;
  counties.forEach((county,i)=>{const d=Math.abs(county.x-(targetX-offset));if(d<distance){distance=d;nearest=i}});
  return nearest;
}

function selectCounty(index,move=true){
  selected=clamp(index,0,counties.length-1);districtIndex=0;
  if(move)targetX=counties[selected].x+(innerWidth<601?0:7);
  stages.forEach((stage,i)=>stage.mark.visible=i===selected);
  counties.forEach((county,i)=>county.labelButton.classList.toggle('active',i===selected));
  $('regionNav').querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.region===counties[selected].region));
  populateDistricts();renderDetail();
}

function raycast(clientX,clientY){
  const rect=renderer.domElement.getBoundingClientRect();
  pointerNdc.set((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1));
  raycaster.setFromCamera(pointerNdc,camera);
  const hit=raycaster.intersectObjects(towerMeshes,false).find(x=>x.object.userData.mode===mode || x.object.userData.mode===undefined);
  return hit?.object.userData;
}

function onPointerDown(e){
  if(e.target!==renderer.domElement)return;
  pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false};
  e.currentTarget.setPointerCapture(e.pointerId);
}
function onPointerMove(e){
  if(pointer){
    const dx=e.clientX-pointer.x;
    if(Math.abs(e.clientX-pointer.startX)>4)pointer.dragged=true;
    if(pointer.dragged){targetX=clamp(targetX-dx*(innerWidth<601?.055:.065),counties[0].x,counties.at(-1).x+(innerWidth<601?0:7));$('scene').classList.add('dragging')}
    pointer.x=e.clientX;pointer.y=e.clientY;$('towerTip').classList.remove('show');return;
  }
  if(e.pointerType==='touch')return;
  const hit=raycast(e.clientX,e.clientY),tip=$('towerTip');
  if(hit?.label){
    tip.innerHTML=`${esc(hit.label)}<small>${esc(shortParty(hit.party))}</small>`;
    tip.style.left=`${e.clientX-$('scene').getBoundingClientRect().left+13}px`;
    tip.style.top=`${e.clientY-$('scene').getBoundingClientRect().top-40}px`;
    tip.classList.add('show');
  }else tip.classList.remove('show');
}
function onPointerUp(e){
  if(!pointer)return;
  const wasDragged=pointer.dragged;pointer=null;$('scene').classList.remove('dragging');
  if(wasDragged)selectCounty(nearestCounty(),false);
  else{const hit=raycast(e.clientX,e.clientY);if(hit)selectCounty(hit.countyIndex)}
}
function onWheel(e){
  e.preventDefault();
  targetX=clamp(targetX+(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*.055,counties[0].x,counties.at(-1).x+7);
  clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>selectCounty(nearestCounty(),false),170);
}

function updateData(t){
  progress=clamp(t,0,1);
  for(const county of counties){
    countRace(county.mayor,progress);
    const live=county.council._partyLive;
    for(const party of live.keys())live.set(party,0);
    let total=0,counted=0;
    for(const district of county.council.districts){
      countRace(district,progress);
      total+=district.valid;counted+=district._counted;
      district.candidates.forEach((candidate,i)=>live.set(candidate.party,live.get(candidate.party)+district._live[i]));
    }
    county.council._progress=total?counted/total:0;
  }
  for(const tower of mayorTowers){
    const live=tower.race._live[tower.candidateIndex];
    tower.targetHeight=4.5+19*Math.pow(live/tower.maxVotes,.76);
    tower.progress=tower.race._progress;
    tower.called=tower.race._progress===1 && tower.winner;
  }
  for(const tower of councilTowers){
    const live=tower.county.council._partyLive.get(tower.party)||0;
    tower.targetHeight=4.5+19*Math.pow(live/tower.maxVotes,.76);
    tower.progress=tower.county.council._progress;
    tower.called=false;
  }
  updateAtmosphere(progress);
  $('timeline').value=Math.round(progress*1000);
  $('timeline').style.setProperty('--timeline-fill',`${progress*100}%`);
}

function updateTowers(dt){
  const smoothing=reducedMotion.matches?1:1-Math.exp(-dt*8);
  for(const tower of (mode==='mayor'?mayorTowers:councilTowers)){
    tower.currentHeight+= (tower.targetHeight-tower.currentHeight)*smoothing;
    const h=tower.currentHeight;
    tower.body.scale.y=h;tower.body.position.y=h/2;
    for(const fin of tower.fins){fin.scale.y=h;fin.position.y=h/2}
    tower.trim.position.y=h+.08;
    tower.beam.visible=tower.called;
    tower.ring.visible=tower.called;
    if(tower.called){
      tower.beam.position.y=h+12;
      tower.ring.position.y=h+.4;
      if(!tower.wasCalled && playing && progress<.999)tower.flash=1;
    }
    tower.wasCalled=tower.called;
    if(tower.flash>0){tower.flash=Math.max(0,tower.flash-dt*.65);tower.ring.scale.setScalar(1+(1-tower.flash)*1.8);tower.ring.material.opacity=.85*tower.flash}
    else{tower.ring.scale.setScalar(1);tower.ring.material.opacity=.8}
  }
}

function summary(){
  const races=mode==='mayor'?counties.map(c=>c.mayor):counties.flatMap(c=>c.council.districts);
  let valid=0,counted=0,decided=0;
  const seats=new Map();
  for(const race of races){
    valid+=race.valid;counted+=race._counted;
    if(race._progress===1)for(const candidate of race.candidates)if(candidate.elected){decided++;seats.set(candidate.party,(seats.get(candidate.party)||0)+1)}
  }
  return {progress:valid?counted/valid:0,decided,total:mode==='mayor'?22:910,seats};
}

function avatar(candidate,className){
  const name=decodeName(candidate.name);
  let photo=null;
  if(candidate.photo)try{const url=new URL(candidate.photo,location.href);if(['http:','https:'].includes(url.protocol))photo=url.href}catch{}
  return `<span class="${className}" style="--party:${color(candidate.party)}" data-initial="${esc(name[0])}">${photo?`<img src="${esc(photo)}" alt="${esc(name)}照片">`:esc(name[0])}</span>`;
}

function renderDetail(){
  const county=counties[selected],isMayor=mode==='mayor',race=isMayor?county.mayor:county.council.districts[districtIndex];
  const countyProgress=isMayor?race._progress:county.council._progress;
  $('detailRegion').textContent=county.region+(county.region==='離島'?' · 海上平台':'');
  $('detailCounty').textContent=county.name;
  $('detailStatus').textContent=race._progress===1?'開票完成':'模擬計票中';
  $('detailSub').textContent=isMayor?`縣市長選舉 · 已開票 ${Math.round(countyProgress*100)}%`:`議員 ${race.name} · ${race.seats} 席 · 已開票 ${Math.round(race._progress*100)}%`;
  $('districtChooser').hidden=isMayor;
  $('candidateHeading').textContent=isMayor?'候選人得票':'本選區候選人得票';
  $('countedVotes').textContent=`已計有效票 ${fmt.format(race._counted)}`;
  const leader=race.candidates[race._leader];
  if(race._counted===0){
    $('leader').innerHTML='<div class="leader-data"><div class="leader-label">開票尚未開始</div><div class="leader-name">等待計票</div><div class="leader-party">此區候選人票數將隨重播更新</div></div>';
  }else{
    const pct=race._progress===1?leader.pct:race._live[race._leader]/race._counted*100;
    $('leader').innerHTML=`${avatar(leader,'leader-avatar')}<div class="leader-data"><div class="leader-label">${race._progress===1 && leader.elected?'當選':'目前領先'}</div><div class="leader-name">${esc(decodeName(leader.name))}</div><div class="leader-party">${esc(shortParty(leader.party))}</div></div><div class="leader-votes"><strong>${fmt.format(race._live[race._leader])}</strong><small>${pct.toFixed(2)}%</small></div>`;
  }
  const ranked=race.candidates.map((candidate,i)=>({candidate,i,votes:race._live[i]})).sort((a,b)=>b.votes-a.votes||a.candidate.no-b.candidate.no);
  const list=$('candidateList'),scrollTop=list.scrollTop;
  list.innerHTML=ranked.map(({candidate,i,votes})=>{
    const pct=race._progress===1?candidate.pct:race._counted?votes/race._counted*100:0;
    const badge=race._progress===1 && candidate.elected ? `<span class="badge ${candidate.womenQuota?'quota':''}">${candidate.womenQuota?'婦女保障名額':'當選'}</span>`:'';
    return `<div class="candidate-row">${avatar(candidate,'candidate-avatar')}<div class="candidate-info"><strong>${candidate.no} 號 ${esc(decodeName(candidate.name))}${badge}</strong><small>${esc(shortParty(candidate.party))}</small></div><div class="candidate-stat"><strong>${fmt.format(votes)}</strong><small>${pct.toFixed(2)}%</small></div><div class="candidate-bar" style="--party:${color(candidate.party)}"><span style="transform:scaleX(${pct/100})"></span></div></div>`;
  }).join('');
  list.scrollTop=scrollTop;
  $('detailFootnote').textContent=isMayor?'塔高為本縣市候選人得票相對比例；開票完成後標示當選。':'議員塔高為本縣市各政黨已計票數相對比例；選區完成後確認當選席次。';
  flagTower=race._counted===0?null:isMayor
    ?mayorTowers.find(t=>t.county===county && t.candidateIndex===race._leader)
    :councilTowers.filter(t=>t.county===county).sort((a,b)=>(county.council._partyLive.get(b.party)||0)-(county.council._partyLive.get(a.party)||0))[0];
  if(flagTower){
    const flag=$('leaderFlag');flag.style.setProperty('--party',color(flagTower.party));
    flag.querySelector('small').textContent=isMayor?(race._progress===1?'當選':'目前領先'):'本縣市政黨計票最高';
    flag.querySelector('strong').textContent=flagTower.label;
  }
}

function populateDistricts(){
  const county=counties[selected],select=$('districtSelect');
  select.replaceChildren(...county.council.districts.map((district,i)=>{
    const option=document.createElement('option');option.value=String(i);
    option.textContent=`${district.name}${district.type==='區域'?'':` · ${district.type}`}（${district.seats} 席）`;
    return option;
  }));
  select.value=String(districtIndex);
}

function renderTally(){
  const data=summary();
  $('overallProgress').textContent=`${Math.round(data.progress*100)}%`;
  $('decidedCount').textContent=`${data.decided} / ${data.total}`;
  $('tallyLabel').textContent=mode==='mayor'?'縣市長席次':'議員已定席次';
  const parties=[...data.seats].sort((a,b)=>b[1]-a[1]);
  if(!parties.length)parties.push(['中國國民黨',0],['民主進步黨',0],['台灣民眾黨',0],['無黨籍及未經政黨推薦',0]);
  $('partyTally').innerHTML=parties.map(([party,n])=>`<div class="party-score" style="--party:${color(party)}"><i></i>${esc(shortParty(party))}<strong>${n}</strong></div>`).join('');
  const hour=16+Math.floor(progress*7),minute=Math.floor((progress*7%1)*60);
  const time=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  $('heroClock').textContent=time;$('currentTime').textContent=time;
  for(const county of counties){
    const p=mode==='mayor'?county.mayor._progress:county.council._progress;
    county.labelButton.querySelector('small').textContent=`${county.region} · 已開票 ${Math.round(p*100)}%`;
  }
}

function renderText(){
  const data=summary();
  $('textSummary').textContent=`${mode==='mayor'?'縣市長':'議員'}，模擬時間 ${$('heroClock').textContent}，全國已計票 ${Math.round(data.progress*100)}%，已定 ${data.decided}／${data.total} 席。`;
  $('textResults').className='text-grid';
  if(mode==='mayor'){
    $('textResults').innerHTML=counties.map(county=>{
      const race=county.mayor;
      return `<article class="text-county"><h3>${esc(county.name)}</h3><p>已開票 ${Math.round(race._progress*100)}% · 已計有效票 ${fmt.format(race._counted)}</p>${candidateTable(race)}</article>`;
    }).join('');
  }else{
    $('textResults').innerHTML=counties.map(county=>{
      const c=county.council;
      return `<article class="text-county"><h3>${esc(county.name)}</h3><p>${c.seats} 席 · 已開票 ${Math.round(c._progress*100)}%</p>${c.districts.map(d=>`<details><summary>${esc(d.name)} · ${esc(d.type)}<span>${d.seats} 席 / 已開票 ${Math.round(d._progress*100)}%</span></summary>${candidateTable(d)}</details>`).join('')}</article>`;
    }).join('');
  }
}

function candidateTable(race){
  const rows=race.candidates.map((candidate,i)=>({candidate,votes:race._live[i]})).sort((a,b)=>b.votes-a.votes||a.candidate.no-b.candidate.no);
  return `<table><thead><tr><th scope="col">候選人</th><th scope="col">政黨</th><th scope="col">得票</th><th scope="col">得票率</th><th scope="col">結果</th></tr></thead><tbody>${rows.map(({candidate,votes})=>`<tr><td>${candidate.no} 號 ${esc(decodeName(candidate.name))}</td><td>${esc(shortParty(candidate.party))}</td><td>${fmt.format(votes)}</td><td>${(race._progress===1?candidate.pct:race._counted?votes/race._counted*100:0).toFixed(2)}%</td><td>${race._progress===1 && candidate.elected?(candidate.womenQuota?'婦女保障名額':'當選'):'—'}</td></tr>`).join('')}</tbody></table>`;
}

function setMode(next){
  if(mode===next)return;
  mode=next;
  mayorGroup.visible=mode==='mayor';councilGroup.visible=mode==='council';
  $('mayorMode').classList.toggle('active',mode==='mayor');$('councilMode').classList.toggle('active',mode==='council');
  $('mayorMode').setAttribute('aria-pressed',mode==='mayor');$('councilMode').setAttribute('aria-pressed',mode==='council');
  $('sceneNote').innerHTML=mode==='mayor'?'每座塔代表一位候選人<br>塔高依各縣市最高票獨立換算':'每座塔代表一個政黨<br>塔高依各縣市已計票數獨立換算';
  districtIndex=0;populateDistricts();renderDetail();renderTally();
  if(!$('textView').hidden)renderText();
}

function bindUi(){
  document.addEventListener('error',event=>{
    if(event.target.matches?.('.leader-avatar img,.candidate-avatar img'))event.target.parentElement.textContent=event.target.parentElement.dataset.initial;
  },true);
  $('mayorMode').onclick=()=>setMode('mayor');$('councilMode').onclick=()=>setMode('council');
  $('prevCounty').onclick=()=>selectCounty(selected-1);$('nextCounty').onclick=()=>selectCounty(selected+1);
  $('districtSelect').onchange=e=>{districtIndex=Number(e.target.value);renderDetail()};
  $('playButton').onclick=()=>{if(progress>=1)updateData(0);playing=!playing;document.body.classList.toggle('paused',!playing);$('playButton').setAttribute('aria-label',playing?'暫停重播':'播放重播')};
  $('speedButton').onclick=()=>{speed=speed===1?2:speed===2?4:.5;const value=`${speed}×`;$('speedButton').textContent=value;$('speedButton').setAttribute('aria-label',`播放速度 ${speed} 倍`)};
  $('timeline').oninput=e=>{updateData(Number(e.target.value)/1000);renderDetail();renderTally();if(!$('textView').hidden)renderText();if(progress>=1){playing=false;document.body.classList.add('paused')}};
  $('textToggle').onclick=()=>toggleText(true);$('textClose').onclick=()=>toggleText(false);
  $('legendButton').onclick=()=>{const open=$('legend').hidden;$('legend').hidden=!open;$('legendButton').setAttribute('aria-expanded',String(open))};
  $('legend').innerHTML=['中國國民黨','民主進步黨','台灣民眾黨','時代力量','無黨籍及未經政黨推薦'].map(p=>`<div class="legend-item" style="--party:${color(p)}"><i></i>${esc(shortParty(p))}</div>`).join('')+'<p>塔高以各縣市最高得票為基準；不同縣市的塔高不可直接比較。燈窗隨計票亮起。</p>';
  const nav=$('regionNav');
  for(const region of regions){const button=document.createElement('button');button.type='button';button.textContent=region.name;button.dataset.region=region.name;button.onclick=()=>selectCounty(counties.findIndex(c=>c.region===region.name));nav.appendChild(button)}
  addEventListener('keydown',e=>{
    if(e.key==='Escape' && !$('textView').hidden){toggleText(false);return}
    if(e.target.closest('input,select,button') || !$('textView').hidden)return;
    if(e.key==='ArrowLeft'){selectCounty(selected-1);e.preventDefault()}
    if(e.key==='ArrowRight'){selectCounty(selected+1);e.preventDefault()}
  });
}

function toggleText(open){
  $('textView').hidden=!open;$('textToggle').setAttribute('aria-expanded',String(open));
  for(const child of $('app').children)if(child!==$('textView'))child.inert=open;
  if(open){playing=false;document.body.classList.add('paused');renderText();$('textClose').focus()}else $('textToggle').focus();
}

function frame(now){
  const dt=Math.min(.05,(now-lastFrame)/1000 || 0);lastFrame=now;
  if(playing && progress<1){
    simDelta+=dt;
    if(simDelta>.065){updateData(Math.min(1,progress+simDelta*speed/95));simDelta=0}
    if(progress>=1){playing=false;document.body.classList.add('paused')}
  }
  const follow=reducedMotion.matches?1:1-Math.exp(-dt*4.5);
  cameraX+=(targetX-cameraX)*follow;updateCamera();updateTowers(dt);
  if(now-lastWindow>120){for(const set of windowSets)if(set.mode===mode)updateWindows(set);lastWindow=now}
  if(now-lastUi>260){renderDetail();renderTally();lastUi=now}
  updateLabels();updateLeaderFlag();renderer.render(scene,camera);requestAnimationFrame(frame);
}

async function init(){
  try{
    const [m,c]=await Promise.all(['../../data/mayor-2022.json','../../data/council-2022.json'].map(async url=>{
      const response=await fetch(url);if(!response.ok)throw new Error('資料載入失敗');return response.json();
    }));
    mayor=m;council=c;prepareData(m,c);bindUi();makeScene();
    const jump=new URLSearchParams(location.search).get('t');
    if(jump!==null){progress=clamp(Number(jump)||0,0,1);playing=false;document.body.classList.add('paused')}
    updateData(progress);
    if(jump!==null){
      for(const tower of [...mayorTowers,...councilTowers])tower.currentHeight=tower.targetHeight;
      updateTowers(0);
      for(const set of windowSets)updateWindows(set);
    }
    selectCounty(selected);renderTally();
    const finish=()=>{$('intro').classList.add('done');document.body.classList.add('entered');if(jump===null && !reducedMotion.matches){playing=true;document.body.classList.remove('paused')}};
    document.body.classList.add('ready');
    if(jump!==null || reducedMotion.matches)finish();
    else{playing=false;document.body.classList.add('paused');setTimeout(finish,1450)}
    lastFrame=performance.now();requestAnimationFrame(frame);
    window.__skyline={setProgress(value){playing=false;document.body.classList.add('paused');updateData(value);renderDetail();renderTally()},select:selectCounty,setMode,getSnapshot(){return {progress,mode,selected:counties[selected].code,mayorVotes:counties.map(c=>c.mayor._live),councilDecided:summary().decided}}};
  }catch(error){
    $('loading').innerHTML='<b>資料載入失敗</b><small>請確認網路連線後重新整理頁面。</small>';
    $('loading').style.background='#0a1020';
    console.error(error);
  }
}
init();
