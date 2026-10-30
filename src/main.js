import * as GFX from 'madness-engine/gfx';
import { createAudio } from 'madness-engine/audio';
import { createInput } from 'madness-engine/input';
import { createStage, LIGHTS, domeU } from 'madness-engine/stage';
import { createModel, createStatic } from 'madness-engine/models/model';
import { streetlamp as engineStreetlamp } from 'madness-engine/scenery/street';
import { toGround } from 'madness-engine/view';
import robot from 'madness-engine/characters/robot';
import punk from 'madness-engine/characters/punk';
import critic from 'madness-engine/characters/critic';
import neighbour from 'madness-engine/characters/neighbour';
import vendor from 'madness-engine/characters/vendor';
import cop from 'madness-engine/characters/cop';
import security from 'madness-engine/characters/security';
import { createEffects } from 'madness-engine/effects';
import { createBuildings, FOOTPRINTS } from 'madness-engine/buildings';
import { Batch } from 'madness-engine/mesher';
import { wallMaterial, surfaceMaterial } from 'madness-engine/textures/town/textures';
import { tiled as tileTownTexture } from 'madness-engine/textures/town/paint';
import { SURFACES } from 'madness-engine/textures/town/surfaces';
import { paintRoom } from 'madness-engine/textures/rooms/town';
import { paintSky } from 'madness-engine/textures/skies/town';
import './style.css';

// Temporary player cast: the engine's tin-can Robot Waiter. Replace this
// import when the final Sam sculpt is ready; gameplay is decoupled from the cast.
const host = document.querySelector('#game');
const stage = await createStage(host, {
  sky: paintSky(domeU),
  lights: LIGHTS,
  shadows: true,
  shadowSize: 2048,
  fixtures: 24,
  room: paintRoom(),
  ui: [document.querySelector('#overlay')],
  label: 'ram-stealin-sam',
});
const { scene } = stage;
const streetLampFixtures = stage.fixtureLights;
let streetLampLightIndex = 0;
const input = createInput(host, {
  // Pointer movement is measured from Sam's projected screen position.
  anchor() {
    const projected = new GFX.Vector3(player.x, player.y + 0.9, player.z).project(stage.camera);
    const rect = host.getBoundingClientRect();
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
    return {
      x: rect.left + (projected.x + 1) * 0.5 * rect.width,
      y: rect.top + (1 - projected.y) * 0.5 * rect.height,
    };
  },
  // Keyboard actions are handled below; avoid the engine's default Space=start queue.
  presses: {},
});

const ui = {
  ram: document.querySelector('#ram-count'),
  delivered: document.querySelector('#delivered-count'),
  health: document.querySelector('#health-fill'),
  objective: document.querySelector('#objective'),
  status: document.querySelector('#status'),
  toast: document.querySelector('#toast'),
  start: document.querySelector('#start-screen'),
  win: document.querySelector('#win-screen'),
  winCopy: document.querySelector('#win-copy'),
  score: document.querySelector('#score-count'),
  raids: document.querySelector('#raid-count'),
  radar: document.querySelector('#radar'),
  level: document.querySelector('#level-label'),
  levelName: document.querySelector('#level-name'),
};
const LEVELS = [
  { name: 'HILLSIDE HOMES', kind: 'HOME', target: 16, threat: 1.0 },
  { name: 'MAIN STREET HEAT', kind: 'BUSINESS', target: 24, threat: 1.25 },
  { name: 'FULL BLOCK TAKEOVER', kind: 'ALL', target: 36, threat: 1.55 },
];
const TOTAL_TARGET_RAM = LEVELS.reduce((sum, level) => sum + level.target, 0);
const GETAWAY = { x: 0, z: 30.7 };
let started = false;
let won = false;
let toastTimer = 0;
let attackQueued = false;
let jumpQueued = false;
let raidQueued = false;
let primaryPointer = null;

const audio = createAudio({ storageKey: 'ram-stealin-sam.muted', glue: true });
function wakeAudio() {
  audio.wake();
}
function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  toastTimer = 1.55;
}
function tone(freq, length = 0.11, gain = 0.12) {
  audio.tone({ freq, to: Math.max(60, freq * 0.62), length, gain, type: 'square' });
}

const keys = new Set();
addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  wakeAudio();
  if (event.repeat) return;
  if (event.target instanceof HTMLButtonElement && event.code === 'Space') return;
  keys.add(event.code);
  if (started && !won && event.code === 'Space') jumpQueued = true;
  if (started && !won && event.code === 'KeyF') attackQueued = true;
  if (started && !won && event.code === 'KeyE') raidQueued = true;
  if (event.code === 'KeyM') {
    const nowMuted = audio.toggleMute();
    showToast(nowMuted ? 'AUDIO MUTED' : 'AUDIO ON');
  }
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', wakeAudio, { once: true });
document.querySelector('#start-button').addEventListener('click', () => {
  started = true;
  ui.start.style.display = 'none';
  wakeAudio();
});
document.querySelector('#attack-button').addEventListener('pointerdown', (event) => {
  event.preventDefault();attackQueued=true;
  const nearby=townsfolk.filter(person=>person.hp>0)
   .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];
  if(nearby)player.yaw=Math.atan2(nearby.x-player.x,nearby.z-player.z);
  wakeAudio();
});
document.querySelector('#jump-button').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  jumpQueued = true;
  wakeAudio();
});
document.querySelector('#raid-button').addEventListener('pointerdown', (event) => {
  event.preventDefault(); raidQueued = true; wakeAudio();
});
document.querySelector('#play-again').addEventListener('click', () => location.reload());

function handlePrimaryClick(){
 if(!started||won)return;
 if(nearestProperty()){
  raidQueued=true;
 }else{
  let target=null,best=3.3;
  for(const person of townsfolk){
   if(person.hp<=0)continue;
   const distance=Math.hypot(person.x-player.x,person.z-player.z);
   if(distance<best){best=distance;target=person;}
  }
  if(target)player.yaw=Math.atan2(target.x-player.x,target.z-player.z);
  attackQueued=true;
 }
 wakeAudio();
}
host.addEventListener('pointerdown',(event)=>{
 if(event.pointerType!=='mouse'||event.button!==0)return;
 primaryPointer={id:event.pointerId,x:event.clientX,y:event.clientY,
  startedAt:performance.now(),dragged:false};
});
host.addEventListener('pointermove',(event)=>{
 if(!primaryPointer||primaryPointer.id!==event.pointerId)return;
 if(Math.hypot(event.clientX-primaryPointer.x,event.clientY-primaryPointer.y)>9)primaryPointer.dragged=true;
});
host.addEventListener('pointerup',(event)=>{
 if(!primaryPointer||primaryPointer.id!==event.pointerId)return;
 const clicked=!primaryPointer.dragged&&performance.now()-primaryPointer.startedAt<650
  &&Math.hypot(event.clientX-primaryPointer.x,event.clientY-primaryPointer.y)<9;
 primaryPointer=null;
 if(clicked)handlePrimaryClick();
});
host.addEventListener('pointercancel',(event)=>{
 if(primaryPointer&&primaryPointer.id===event.pointerId)primaryPointer=null;
});


const mats = {
  ground: new GFX.MeshStandardMaterial({ color: '#263b3a', roughness: 0.94 }),
  concrete: new GFX.MeshStandardMaterial({ color: '#46545a', roughness: 0.82 }),
  dark: new GFX.MeshStandardMaterial({ color: '#15252c', roughness: 0.72 }),
  trim: new GFX.MeshStandardMaterial({ color: '#a6ff52', roughness: 0.4, emissive: '#4e9821', emissiveIntensity: 0.38 }),
  glass: new GFX.MeshStandardMaterial({ color: '#285d67', roughness: 0.22, metalness: 0.38, emissive: '#0b3b48', emissiveIntensity: 0.35 }),
  ram: new GFX.MeshStandardMaterial({ color: '#a6ff52', roughness: 0.28, metalness: 0.5, emissive: '#4b9c17', emissiveIntensity: 0.9 }),
  ramDark: new GFX.MeshStandardMaterial({ color: '#426d3b', roughness: 0.35, metalness: 0.55 }),
  warning: new GFX.MeshStandardMaterial({ color: '#f2ae45', roughness: 0.55, emissive: '#8b4511', emissiveIntensity: 0.3 }),
};

function addBox(x, y, z, w, h, d, material, shadow = true) {
  const mesh = new GFX.Mesh(new GFX.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
function addCylinder(x, y, z, radius, height, material, segments = 24) {
  const mesh = new GFX.Mesh(new GFX.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
function addRing(x, z, radius, material) {
  const mesh = new GFX.Mesh(new GFX.TorusGeometry(radius - 0.06, 0.06, 8, 48), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.025, z);
  scene.add(mesh);
  return mesh;
}

// CALIFORNIA TOWN ----------------------------------------------------------
mats.roadWhite = new GFX.MeshStandardMaterial({color:'#e8e5da',roughness:0.9});
const townSurfaceCache=new Map();
function townSurface(name,width,depth,tint){
 const key=[name,width,depth,tint||''].join(':');
 if(townSurfaceCache.has(key))return townSurfaceCache.get(key);
 const base=surfaceMaterial(GFX,name);
 const material=new GFX.MeshPhysicalMaterial({
  name:'town-surface-'+name,
  color:tint||SURFACES[name]?.top||'#ffffff',
  vertexColors:false,
  map:tileTownTexture(GFX,base.map,width,depth),
  bumpMap:tileTownTexture(GFX,base.bumpMap,width,depth),
  bumpScale:base.bumpScale,
  roughness:base.roughness,
  metalness:base.metalness,
  clearcoat:base.clearcoat,
  clearcoatRoughness:base.clearcoatRoughness,
 });
 townSurfaceCache.set(key,material);
 return material;
}
const groundMat=townSurface('lawn',84,84,'#e0e7d0');
const streetMat=townSurface('road',78,6.2);
const streetVerticalMat=townSurface('road',6.2,78);
const walkMat=townSurface('sidewalk',78,1.25);
const walkVerticalMat=townSurface('sidewalk',1.25,78);
const driveMat=townSurface('forecourt',16,8.5);
function addSurface(w,d,x,z,material,y=0.02) {
  const mesh = new GFX.Mesh(new GFX.PlaneGeometry(w,d), material);
  mesh.rotation.x = -Math.PI/2;
  mesh.position.set(x,y,z); mesh.receiveShadow = true; scene.add(mesh);
}
function addLamp(x,z,yaw=0) {
  // The pole, arm and sodium cobra-head are the engine's sculpted streetlamp.
  const mesh = createStatic(GFX, engineStreetlamp);
  mesh.position.set(x,0,z);
  mesh.rotation.y = yaw;
  scene.add(mesh);

  // Honour the light socket defined by the same engine asset. The stage owns
  // a fixed pool of real point lights; no duplicate homemade lamp geometry.
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  for (const [lx,ly,lz,colour,reach] of engineStreetlamp.lights || []) {
    const light = streetLampFixtures[streetLampLightIndex++];
    if (!light) continue;
    light.position.set(
      x + lx*c + lz*sn,
      ly,
      z - lx*sn + lz*c
    );
    light.color.set(colour);
    light.intensity = 5.5;
    light.distance = reach;
    light.decay = 1.1;
    light.castShadow = false;
    light.visible = true;
  }
}
function addRoadStripe(x,z,w,d,material=mats.roadWhite) {
  addBox(x,0.058,z,w,0.018,d,material,false);
}
const ground = new GFX.Mesh(new GFX.PlaneGeometry(84,84),groundMat);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const horizontalRoads=[-14,0,14,28], verticalRoads=[-28,0,28];
for(const z of horizontalRoads){
  addSurface(78,6.2,0,z,streetMat,0.018);
  addSurface(78,1.25,0,z-3.72,walkMat,0.035);
  addSurface(78,1.25,0,z+3.72,walkMat,0.035);
  for(let x=-36;x<=36;x+=5.2)addRoadStripe(x,z,2.1,0.075);
}
for(const x of verticalRoads){
  addSurface(6.2,78,x,0,streetVerticalMat,0.019);
  addSurface(1.25,78,x-3.72,0,walkVerticalMat,0.036);
  addSurface(1.25,78,x+3.72,0,walkVerticalMat,0.036);
  for(let z=-36;z<=36;z+=5.2)addRoadStripe(x,z,0.075,2.1);
}
for(const x of verticalRoads)for(const z of horizontalRoads){
  for(let i=-3;i<=3;i++){
    addBox(x+i*0.43,0.061,z-2.05,0.22,0.018,1,mats.roadWhite,false);
    addBox(x+i*0.43,0.061,z+2.05,0.22,0.018,1,mats.roadWhite,false);
  }
  addLamp(x-4.3,z-4.2,0);addLamp(x+4.3,z+4.2,Math.PI);
}
for(const z of [-21,-7,7,21])for(const x of [-24,-16,-8,8,16,24]){
  addSurface(5.6,5.3,x,z,townSurface('lawn',5.6,5.3,'#dbe5c7'),0.012);
}
addSurface(16,8.5,0,34,driveMat,0.025);
for(let x=-5.5;x<=5.5;x+=2.75)addRoadStripe(x,33.8,0.075,4.4);

const buildingLibrary=createBuildings();
const buildingMaterials=new Map();
function buildingMaterial(name){
 if(buildingMaterials.has(name))return buildingMaterials.get(name);
 let material;
 if(name==='glass'){
  material=new GFX.MeshPhysicalMaterial({
   vertexColors:true,color:'#d7e9ee',roughness:0.16,metalness:0.28,
   clearcoat:0.95,clearcoatRoughness:0.08,envMapIntensity:1.1,
  });
 }else if(name==='glow'){
  material=new GFX.MeshBasicMaterial({vertexColors:true,toneMapped:false});
 }else if(name==='tile'){
  material=surfaceMaterial(GFX,'roof');
 }else if(name==='slate'){
  material=surfaceMaterial(GFX,'flatroof');
 }else if(name==='plain'){
  material=surfaceMaterial(GFX,'concrete');
 }else{
  const textureByPart={
   plaster:'stucco',stone:'stone',trim:'timber',rubble:'cliff',
   wood:'timber',metal:'hull',cloth:'canvas',bark:'timber',
   thatch:'canvas',hedge:'hedge',timber:'timber',rock:'stone',
   siding:'clapboard',brick:'brick',
  };
  material=wallMaterial(GFX,textureByPart[name]||'stone');
 }
 buildingMaterials.set(name,material);
 return material;
}
const BUILDING_SCALE=1.8, cityBatch=new Batch(), parkBatch=new Batch();
parkBatch.stamp(buildingLibrary.modelFor('park',{variant:3}).parts,0,0,-35,0,2);
for(const [name,acc] of parkBatch.accs){
  const mesh=new GFX.Mesh(acc.geometry(GFX),buildingMaterial(name));
  mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
}
const properties=[];
const rows=[
 {z:-21,yaw:0,kind:'HOME',entries:[
  ['bungalow','Luna Bungalow',4],['ranchhouse','Casa Sol',4],['beachhouse','Pacific View',4],
  ['dingbat','Starburst Apartments',5],['aptblock','Palm Court',5],['beachhouse','Seabreeze House',4]]},
 {z:-7,yaw:0,kind:'BUSINESS',entries:[
  ['boutique','Marlow Boutique',5],['stripmall','Sunset Shops',6],['boutique','Cove Coffee',5],
  ['stripmall','Pacific Market',6],['officetower','Westline Offices',7],['techpark','Silicon Surf Labs',7]]},
 {z:7,yaw:Math.PI,kind:'BUSINESS',entries:[
  ['stripmall','Taco Patio',6],['boutique','Boardwalk Records',5],['clinic','Palm Medical',5],
  ['warehouse','Coastal Storage',6],['officetower','Sunset Realty',7],['library','Oceanview Library',4]]},
 {z:21,yaw:Math.PI,kind:'HOME',entries:[
  ['ranchhouse','Juniper House',4],['bungalow','Cypress Cottage',4],['beachhouse','The Blue Door',4],
  ['dingbat','Marina Flats',5],['aptblock','Palm Terrace',5],['ranchhouse','Mission House',4]]},
];
const lotXs=[-24,-16,-8,8,16,24];let propertyIndex=0;
for(const row of rows)row.entries.forEach(([type,label,loot],i)=>{
  const x=lotXs[i],z=row.z,yaw=row.yaw;
  cityBatch.stamp(buildingLibrary.modelFor(type,{level:type==='aptblock'?3:2,variant:propertyIndex%8}).parts,x,0,z,yaw,BUILDING_SCALE);
  const fp=FOOTPRINTS[type]??[2,2],halfW=fp[0]*0.45*BUILDING_SCALE,halfD=fp[1]*0.42*BUILDING_SCALE;
  const front=fp[1]*0.38*BUILDING_SCALE+0.78,fx=Math.sin(yaw),fz=Math.cos(yaw);
  properties.push({id:propertyIndex++,type,label,kind:row.kind,baseLoot:loot,loot,x,z,yaw,halfW,halfD,
    doorX:x+fx*front,doorZ:z+fz*front,raided:false});
});
for(const [name,acc] of cityBatch.accs){
  const mesh=new GFX.Mesh(acc.geometry(GFX),buildingMaterial(name));
  mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
}
function surfaceAt(){return 0.04;}
function insideBuilding(x,z,b,margin=0){
  const dx=x-b.x,dz=z-b.z;
  const lx=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw);
  const lz=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw);
  return Math.abs(lx)<b.halfW-margin&&Math.abs(lz)<b.halfD-margin;
}
function canMoveTo(x,z){
  if(x< -40||x>40||z< -40||z>40)return false;
  for(const b of properties)if(insideBuilding(x,z,b,-0.06))return false;
  if(Math.abs(x)<1.55&&z>32&&z<36.7)return false;
  return true;
}

// Shared half-metre navigation field; it follows the actual building collision.
const NAV_MIN=-40,NAV_STEP=0.5,NAV_SIZE=161,NAV_COUNT=NAV_SIZE*NAV_SIZE;
const navWalkable=new Uint8Array(NAV_COUNT);
const navDistance=new Int16Array(NAV_COUNT);
const navQueue=new Int32Array(NAV_COUNT);
const NAV_DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
let navGoal=-1;
function navIndex(ix,iz){return iz*NAV_SIZE+ix;}
function navCell(x,z){
 const ix=Math.max(0,Math.min(NAV_SIZE-1,Math.round((x-NAV_MIN)/NAV_STEP)));
 const iz=Math.max(0,Math.min(NAV_SIZE-1,Math.round((z-NAV_MIN)/NAV_STEP)));
 return {ix,iz,index:navIndex(ix,iz)};
}
function navPosition(ix,iz){
 return {x:NAV_MIN+ix*NAV_STEP,z:NAV_MIN+iz*NAV_STEP,index:navIndex(ix,iz)};
}
for(let iz=0;iz<NAV_SIZE;iz++)for(let ix=0;ix<NAV_SIZE;ix++){
 const p=navPosition(ix,iz);navWalkable[p.index]=canMoveTo(p.x,p.z)?1:0;
}
function nearestWalkableCell(x,z){
 const origin=navCell(x,z);
 for(let radius=0;radius<=18;radius++){
  let best=null,bestScore=Infinity;
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
   if(radius>0&&Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
   const ix=origin.ix+dx,iz=origin.iz+dz;
   if(ix<0||ix>=NAV_SIZE||iz<0||iz>=NAV_SIZE)continue;
   const index=navIndex(ix,iz);if(!navWalkable[index])continue;
   const score=dx*dx+dz*dz;
   if(score<bestScore){bestScore=score;best=navPosition(ix,iz);}
  }
  if(best)return best;
 }
 return null;
}
function rebuildNavigation(goalX,goalZ){
 const goal=nearestWalkableCell(goalX,goalZ);if(!goal||goal.index===navGoal)return;
 navGoal=goal.index;navDistance.fill(-1);
 let head=0,tail=0;navQueue[tail++]=goal.index;navDistance[goal.index]=0;
 while(head<tail){
  const index=navQueue[head++],ix=index%NAV_SIZE,iz=Math.floor(index/NAV_SIZE);
  const nextDistance=navDistance[index]+1;
  for(const [dx,dz] of NAV_DIRECTIONS){
   const nx=ix+dx,nz=iz+dz;
   if(nx<0||nx>=NAV_SIZE||nz<0||nz>=NAV_SIZE)continue;
   const next=navIndex(nx,nz);
   if(!navWalkable[next]||navDistance[next]!==-1)continue;
   navDistance[next]=nextDistance;navQueue[tail++]=next;
  }
 }
}
function nextNavigationWaypoint(x,z){
 const cell=nearestWalkableCell(x,z);if(!cell)return null;
 const distance=navDistance[cell.index];if(distance<0)return null;
 if(distance===0)return {x:player.x,z:player.z};
 let best=null,bestDistance=distance;
 for(const [dx,dz] of NAV_DIRECTIONS){
  const ix=cell.ix+dx,iz=cell.iz+dz;
  if(ix<0||ix>=NAV_SIZE||iz<0||iz>=NAV_SIZE)continue;
  const index=navIndex(ix,iz),d=navDistance[index];
  if(d>=0&&d<bestDistance){bestDistance=d;best=navPosition(ix,iz);}
 }
 return best;
}
function segmentIsClear(x0,z0,x1,z1){
 const distance=Math.hypot(x1-x0,z1-z0),steps=Math.max(1,Math.ceil(distance/0.2));
 for(let i=1;i<=steps;i++){
  const t=i/steps;if(!canMoveTo(x0+(x1-x0)*t,z0+(z1-z0)*t))return false;
 }
 return true;
}
function moveTownsperson(person,targetX,targetZ,speed,dt){
 const dx=targetX-person.x,dz=targetZ-person.z,distance=Math.hypot(dx,dz);
 if(distance<0.12)return false;
 const travel=Math.min(distance,speed*dt),steps=Math.max(1,Math.ceil(travel/0.12)),step=travel/steps;
 let moved=false;
 for(let i=0;i<steps;i++){
  const angle=Math.atan2(dx,dz);
  const nx=person.x+Math.sin(angle)*step,nz=person.z+Math.cos(angle)*step;
  if(canMoveTo(nx,nz)){person.x=nx;person.z=nz;moved=true;continue;}
  const xOnly=person.x+Math.sin(angle)*step,zOnly=person.z+Math.cos(angle)*step;
  if(canMoveTo(xOnly,person.z)){person.x=xOnly;moved=true;}
  else if(canMoveTo(person.x,zOnly)){person.z=zOnly;moved=true;}
  else break;
 }
 return moved;
}
function chooseWanderTarget(person){
 for(let attempt=0;attempt<18;attempt++){
  const angle=Math.random()*Math.PI*2,radius=1+Math.random()*3.5;
  const x=person.homeX+Math.cos(angle)*radius,z=person.homeZ+Math.sin(angle)*radius;
  if(canMoveTo(x,z)&&segmentIsClear(person.x,person.z,x,z)){
   person.wanderX=x;person.wanderZ=z;person.wanderTimer=2.2+Math.random()*2.5;return;
  }
 }
 const safe=nearestWalkableCell(person.x,person.z);
 person.wanderX=safe?safe.x:person.homeX;person.wanderZ=safe?safe.z:person.homeZ;
 person.wanderTimer=1.2;
}
addBox(0,0.65,35,2.8,1.25,4.2,mats.dark);
addBox(0,1.35,35,2.45,0.32,2.35,mats.dark);
addBox(0,1.34,33.72,2.08,0.48,0.05,mats.glass,false);
addBox(0,1.34,36.18,2.08,0.48,0.05,mats.glass,false);
addBox(0,1.52,34.96,2.15,0.12,0.22,mats.trim,false);
for(const x of [-1.34,1.34])for(const z of [33.75,36.2]){
  const wheel=new GFX.Mesh(new GFX.CylinderGeometry(0.35,0.35,0.2,16),mats.dark);
  wheel.rotation.z=Math.PI/2;wheel.position.set(x,0.36,z);scene.add(wheel);
}
const deliveryPad=addCylinder(GETAWAY.x,0.07,GETAWAY.z,2.45,0.12,mats.trim,48);
deliveryPad.material=new GFX.MeshStandardMaterial({color:'#a6ff52',emissive:'#4d9b1c',
  emissiveIntensity:0.7,transparent:true,opacity:0.62});
addRing(GETAWAY.x,GETAWAY.z,2.85,mats.trim);
const effects=createEffects(GFX,scene,{ground:{heightAt:surfaceAt}});
const sparkGeometry=new GFX.BoxGeometry(0.075,0.13,0.055);
function sparkBurst(x,y,z,count=14,material=mats.ram){
  effects.burst({at:[x,y,z],count,speed:3.2,up:2.3,life:0.55,lifeSpread:0.35,
    mesh:()=>new GFX.Mesh(sparkGeometry,material),scale:[0.55,1.2],bounce:0.16});
}
// The player's model is deliberately replaceable: this cast member is a stand-in.
const sam = createModel(GFX, robot, { detail: 0.86 });
scene.add(sam.group);
sam.group.scale.setScalar(0.98);
const START = { x: -3.5, z: 32 };
const player={x:START.x,z:START.z,y:surfaceAt(START.x,START.z),vy:0,yaw:Math.PI,
 health:100,ram:0,delivered:0,level:1,levelDelivered:0,levelLootReleased:0,
 score:0,raids:0,kills:0,invulnerable:0,attackCooldown:0,grounded:true,combo:0,comboTimer:0};
sam.group.position.set(player.x, player.y, player.z);


const ramItems=[];
const ramGeometry=new GFX.BoxGeometry(0.13,0.76,0.22),ramContacts=new GFX.BoxGeometry(0.14,0.08,0.24);
function spawnRam(x,z,amount=1){
 const group=new GFX.Group();
 for(let i=0;i<amount;i++){
  const stick=new GFX.Mesh(ramGeometry,mats.ram);stick.position.set((i-(amount-1)/2)*0.23,0.06,0);
  stick.rotation.z=(i-(amount-1)/2)*0.12;
  const contact=new GFX.Mesh(ramContacts,mats.ramDark);contact.position.set(stick.position.x,-0.34,0);
  group.add(stick,contact);
 }
 group.position.set(x,surfaceAt(x,z)+0.92,z);scene.add(group);
 ramItems.push({group,x,z,amount,phase:Math.random()*Math.PI*2,active:true});
}
const medItems=[];
function spawnMedkit(x,z){
 const group=new GFX.Group(),base=new GFX.Mesh(new GFX.BoxGeometry(0.42,0.18,0.42),mats.dark);
 const plusA=new GFX.Mesh(new GFX.BoxGeometry(0.1,0.24,0.12),mats.trim);
 const plusB=new GFX.Mesh(new GFX.BoxGeometry(0.28,0.1,0.12),mats.trim);
 plusA.position.y=0.15;plusB.position.y=0.15;group.add(base,plusA,plusB);
 group.position.set(x,surfaceAt(x,z)+0.38,z);scene.add(group);
 medItems.push({x,z,group,phase:Math.random()*Math.PI*2,active:true});
}
[[-30,-4],[30,4],[-12,28],[12,-28]].forEach(([x,z])=>spawnMedkit(x,z));
const citizenCast=[neighbour,vendor,neighbour,critic,cop,vendor,security,neighbour,cop,punk,vendor,security,neighbour,cop];
const citizenSpots=[[-28,-3],[-28,10],[28,-10],[28,3],[-12,-3],[12,3],[-12,14],[12,-14],[-6,28],[6,-28],[-28,20],[28,-20],[-6,3],[6,-3]];
const townsfolk=citizenSpots.map(([spawnX,spawnZ],i)=>{
 const safeSpawn=nearestWalkableCell(spawnX,spawnZ);
 const x=safeSpawn?safeSpawn.x:spawnX,z=safeSpawn?safeSpawn.z:spawnZ;
 const model=createModel(GFX,citizenCast[i%citizenCast.length],{detail:0.72});scene.add(model.group);
 model.group.scale.setScalar(i%5===4?0.96:0.9);
 const isCop=i%5===4||i===8||i===13,isVendor=i%4===1,hp=isCop?3:2;
 const isSecurity=!isCop&&citizenCast[i%citizenCast.length]===security;
 const baseSpeed=isCop?3:isVendor?2.2:2.55,baseDamage=isCop?16:isSecurity?14:isVendor?10:12;
 const person={model,x,z,homeX:x,homeZ:z,hp,maxHp:hp,baseHp:hp,
  kind:isCop?'COP':isSecurity?'SECURITY':isVendor?'VENDOR':'NEIGHBOUR',
  speed:baseSpeed,baseSpeed,damage:baseDamage,baseDamage,
  aggro:false,stun:0,windup:0,attackTimer:0,respawn:0,phase:i*1.31,
  wanderX:x,wanderZ:z,wanderTimer:Math.random()*1.5};
 model.group.position.set(x,surfaceAt(x,z),z);return person;
});
function alertTownfolk(property){
 const candidates=townsfolk.filter(p=>p.hp>0&&!p.aggro)
  .map(person=>({person,distance:Math.hypot(person.x-property.doorX,person.z-property.doorZ)}))
  .sort((a,b)=>a.distance-b.distance);
 candidates.slice(0,player.raids<2?3:6).forEach(({person,distance})=>{if(distance<22)person.aggro=true;});
 if(player.raids>=2)townsfolk.filter(p=>p.kind==='COP').forEach(p=>{p.aggro=true;});
}
let elapsed=0,swingTime=0,raidPrompt=null;
stage.target.set(player.x,player.y+1.2,player.z);stage.view.zoomBy(1.12);
function activeProperty(property){
 const kind=LEVELS[player.level-1].kind;
 return kind==='ALL'||property.kind===kind;
}
function nearestProperty(){
 const level=LEVELS[player.level-1];
 if(player.levelLootReleased>=level.target-player.levelDelivered)return null;
 let nearest=null,best=3.35;
 for(const p of properties){
  if(p.raided||!activeProperty(p))continue;
  const distance=Math.hypot(player.x-p.doorX,player.z-p.doorZ);
  if(distance<best){best=distance;nearest=p;}
 }
 return nearest;
}
const radarCtx=ui.radar?.getContext('2d');
function drawRadar(){
 if(!radarCtx)return;
 const c=radarCtx,w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);
 c.fillStyle='#101a20';c.fillRect(0,0,w,h);
 const px=x=>(x+42)*w/84,pz=z=>(z+42)*h/84;
 c.strokeStyle='#3a4b50';c.lineWidth=6;
 for(const z of horizontalRoads){c.beginPath();c.moveTo(px(-39),pz(z));c.lineTo(px(39),pz(z));c.stroke();}
 for(const x of verticalRoads){c.beginPath();c.moveTo(px(x),pz(-39));c.lineTo(px(x),pz(39));c.stroke();}
 for(const p of properties){
  c.fillStyle=p.raided?'#5b6465':!activeProperty(p)?'#354346':p.kind==='HOME'?'#e0b879':'#62c5d1';
  c.fillRect(px(p.x)-3,pz(p.z)-3,6,6);
 }
 for(const person of townsfolk)if(person.hp>0){
  c.fillStyle=person.aggro?'#ff5c57':'#a6b8b4';c.beginPath();c.arc(px(person.x),pz(person.z),person.aggro?2.8:1.7,0,Math.PI*2);c.fill();
 }
 for(const item of ramItems)if(item.active){c.fillStyle='#a6ff52';c.fillRect(px(item.x)-1,pz(item.z)-1,2.5,2.5);}
 c.fillStyle='#a6ff52';c.fillRect(px(GETAWAY.x)-3,pz(GETAWAY.z)-3,6,6);
 c.fillStyle='#fff';c.beginPath();c.arc(px(player.x),pz(player.z),3.4,0,Math.PI*2);c.fill();
}
function updateHud(){
 const level=LEVELS[player.level-1];
 ui.ram.textContent=String(player.ram).padStart(2,'0');
 ui.delivered.textContent=String(player.delivered).padStart(2,'0')+' / '+TOTAL_TARGET_RAM;
 ui.level.textContent='0'+player.level+' / 03';
 ui.levelName.textContent='LEVEL 0'+player.level+' / '+level.name;
 ui.health.style.width=Math.max(0,player.health)+'%';
 ui.health.style.background=player.health<35?'#ff655c':'#a6ff52';
 ui.score.textContent=String(player.score).padStart(5,'0');
 ui.raids.textContent=player.raids+' / '+properties.length;
 raidPrompt=nearestProperty();
 if(raidPrompt){
  ui.objective.textContent='LEFT CLICK / E TO RAID: '+raidPrompt.label.toUpperCase();
  ui.status.textContent=raidPrompt.kind==='HOME'
   ?'Residence stash: '+raidPrompt.loot+' RAM • neighbours will respond.'
   :'Business stash: '+raidPrompt.loot+' RAM • alarms draw a stronger response.';
 }else if(player.levelLootReleased>=level.target-player.levelDelivered){
  ui.objective.textContent='COLLECT THE LOOSE RAM AND RETURN TO THE VAN';
  ui.status.textContent='Level '+player.level+' stash: '+(player.levelDelivered+player.ram)+' / '+level.target+' RAM.';
 }else if(player.ram>0){
  ui.objective.textContent='RETURN TO THE VAN AND FENCE THE STASH';
  ui.status.textContent='Level '+player.level+' stash: '+(player.levelDelivered+player.ram)+' / '+level.target+' RAM.';
 }else{
  ui.objective.textContent='CLEAR '+level.name+': FENCE '+level.target+' RAM';
  ui.status.textContent='Find a highlighted home or business. Left-click its entrance to raid it.';
 }
 drawRadar();
}
updateHud();
function raidProperty(){
 const property=nearestProperty();
 if(!property){showToast('GET CLOSER TO AN UNRAIDED FRONT DOOR');return;}
 const level=LEVELS[player.level-1];
 const remaining=Math.max(0,level.target-player.levelDelivered-player.levelLootReleased);
 const stash=Math.min(property.loot,remaining);
 if(stash<=0){showToast('ALL LEVEL RAM FOUND — RETURN TO THE VAN');return;}
 property.raided=true;player.raids++;player.score+=stash*45;player.levelLootReleased+=stash;
 const sideX=Math.cos(property.yaw),sideZ=-Math.sin(property.yaw);
 for(let i=0;i<stash;i++){
  const lane=(i%3)-1,row=Math.floor(i/3);
  spawnRam(property.doorX+sideX*lane*0.56+Math.sin(row*1.9)*0.16,
   property.doorZ+sideZ*lane*0.56+(row%2)*0.38,1);
 }
 effects.ring(property.doorX,0,property.doorZ,{colour:'#a6ff52',reach:2.8,life:0.55});
 sparkBurst(property.doorX,0.6,property.doorZ,22);alertTownfolk(property);
 showToast(property.kind+' RAIDED: '+property.label.toUpperCase()+'  +'+stash+' RAM');
 tone(560,0.18,0.2);updateHud();
}

function attack(){
 if(player.attackCooldown>0||!started||won)return;
 player.combo=player.comboTimer>0?(player.combo%3)+1:1;player.comboTimer=1;
 player.attackCooldown=player.combo===3?0.62:0.38;swingTime=0.58;
 tone(205+player.combo*42,0.1,0.16);
 const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw),reach=player.combo===3?3.1:2.55;
 let hits=0;
 for(const person of townsfolk){
  if(person.hp<=0)continue;
  const dx=person.x-player.x,dz=person.z-player.z,distance=Math.hypot(dx,dz);
  const dot=distance>0.001?(dx*fx+dz*fz)/distance:1;
  if(distance>reach||dot<0.1)continue;
  person.hp-=player.combo===3?2:1;person.stun=player.combo===3?0.85:0.5;person.windup=0;person.aggro=true;
  const shove=player.combo===3?1.05:0.55,px=person.x+fx*shove,pz=person.z+fz*shove;
  if(canMoveTo(px,person.z))person.x=px;if(canMoveTo(person.x,pz))person.z=pz;
  effects.ring(person.x,0,person.z,{colour:player.combo===3?'#a6ff52':'#ffbd65',reach:1.2,life:0.26});
  sparkBurst(person.x,0.78,person.z,8);hits++;
  if(person.hp<=0){
   person.model.group.visible=false;person.respawn=14;player.kills++;player.score+=person.kind==='COP'?320:240;
   showToast(person.kind+' KNOCKED OUT  +SCORE');tone(520,0.17,0.2);
  }else showToast(player.combo===3?'HARD HIT — THEY STAGGER':'HIT — KEEP PRESSING');
 }
 if(!hits)showToast('NO ONE IN REACH — GET CLOSER');
 else{effects.ring(player.x,player.y,player.z,{colour:'#a6ff52',reach:1.9,life:0.3});stage.shake=Math.max(stage.shake,player.combo===3?0.17:0.09);}
 updateHud();
}
function hurtPlayer(person,distance){
 if(player.invulnerable>0)return;
 player.health=Math.max(0,player.health-person.damage);player.invulnerable=0.9;player.combo=0;
 const dx=player.x-person.x,dz=player.z-person.z,d=Math.max(0.01,distance);
 const px=player.x+dx/d*0.62,pz=player.z+dz/d*0.62;
 if(canMoveTo(px,player.z))player.x=px;if(canMoveTo(player.x,pz))player.z=pz;
 showToast(person.kind==='COP'?'POLICE BATON — BREAK CONTACT':'TOWNSFOLK FIGHT BACK');
 tone(110,0.16,0.18);stage.shake=Math.max(stage.shake,0.18);updateHud();
 if(player.health<=0)respawnPlayer();
}
function advanceLevel(){
 player.level++;
 player.levelDelivered=0;
 player.levelLootReleased=0;
 if(player.level===3){
  for(const property of properties){
   property.raided=false;
   property.loot=Math.ceil(property.baseLoot*1.35);
  }
 }
 const level=LEVELS[player.level-1];
 for(const person of townsfolk){
  const enforcement=person.kind==='COP'||person.kind==='SECURITY';
  person.maxHp=Math.ceil(person.baseHp*(1+0.25*(player.level-1)));
  person.hp=person.maxHp;
  person.speed=person.baseSpeed*level.threat;
  person.damage=Math.round(person.baseDamage*(1+0.18*(player.level-1)));
  person.aggro=player.level===3||(player.level===2&&enforcement);
  person.stun=0;person.windup=0;person.attackTimer=0;person.respawn=0;
  person.x=person.homeX;person.z=person.homeZ;
  person.model.group.visible=true;person.wanderTimer=0;
 }
 navGoal=-1;
 player.health=Math.min(100,player.health+25);
 player.invulnerable=1.8;
 showToast('LEVEL 0'+player.level+' — '+level.name);
 updateHud();
}

function deliverRam(){
 if(player.ram<=0||won)return;
 const level=LEVELS[player.level-1];
 const amount=Math.min(player.ram,level.target-player.levelDelivered);
 if(amount<=0)return;
 player.ram-=amount;
 player.levelDelivered+=amount;
 player.delivered+=amount;
 player.score+=amount*80;
 showToast('STASH FENCED: '+amount+' RAM — '+player.levelDelivered+'/'+level.target);
 effects.ring(GETAWAY.x,0,GETAWAY.z,{colour:'#a6ff52',reach:3.8,life:0.6});
 sparkBurst(GETAWAY.x,0.55,GETAWAY.z,26);tone(720,0.2,0.18);
 if(player.levelDelivered>=level.target){
  if(player.level===LEVELS.length){
   won=true;
   ui.winCopy.textContent=player.delivered+' RAM fenced • all three levels cleared • '+player.raids+' property raids • '+player.kills+' townsfolk knockouts • score '+player.score;
   ui.win.hidden=false;
  }else advanceLevel();
 }
 updateHud();
}
function respawnPlayer(){
 const lost=Math.floor(player.ram/2);
 for(let i=0;i<lost;i++)spawnRam(player.x+Math.cos(i*2.4)*0.65,player.z+Math.sin(i*2.4)*0.65,1);
 player.ram-=lost;player.x=START.x;player.z=START.z;player.y=surfaceAt(START.x,START.z);
 player.vy=0;player.grounded=true;player.health=65;player.invulnerable=2;player.combo=0;
 jumpQueued=false;attackQueued=false;raidQueued=false;
 showToast(lost?'GETAWAY RESPAWN — LOST '+lost+' RAM':'GETAWAY RESPAWN — BACK ON THE STREET');
 updateHud();
}

stage.run((rawDt)=>{
 const dt=Math.min(rawDt,0.05);elapsed+=dt;input.take();
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}
 if(!started||won){
  effects.update(dt);const look=input.view(dt);
  stage.view.turn(look.turn,look.tilt);stage.view.zoomBy(look.zoom);stage.view.step(dt);return;
 }
 const look=input.view(dt);stage.view.turn(look.turn,look.tilt);stage.view.zoomBy(look.zoom);stage.view.step(dt);
 player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);
 player.comboTimer=Math.max(0,player.comboTimer-dt);if(player.comboTimer<=0)player.combo=0;
 if(swingTime>0)swingTime=Math.max(0,swingTime-dt);
 const [mx,mz]=toGround(input.stick(),stage.view.yaw),magnitude=Math.min(1,Math.hypot(mx,mz));
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=sprint?8.8:6;
 if(magnitude>0.08){
  const nx=player.x+mx*speed*dt,nz=player.z+mz*speed*dt;
  if(canMoveTo(nx,player.z))player.x=nx;if(canMoveTo(player.x,nz))player.z=nz;
  player.yaw=Math.atan2(mx,mz);
 }
 player.x=Math.max(-40,Math.min(40,player.x));player.z=Math.max(-40,Math.min(40,player.z));
 const previousY=player.y;
 if(player.grounded&&jumpQueued){player.vy=9.2;player.grounded=false;tone(340,0.08,0.06);}
 jumpQueued=false;player.vy-=23*dt;player.y+=player.vy*dt;
 const support=surfaceAt(player.x,player.z);
 if(player.vy<=0&&previousY>=support-0.06&&player.y<=support){player.y=support;player.vy=0;player.grounded=true;}
 else player.grounded=false;
 if(player.y< -7)respawnPlayer();
 if(raidQueued)raidProperty();raidQueued=false;
 if(attackQueued)attack();attackQueued=false;
 sam.group.position.set(player.x,player.y,player.z);sam.group.rotation.y=player.yaw;
 sam.group.rotation.z=player.invulnerable>0?Math.sin(elapsed*26)*0.07:0;
 sam.pose({clip:swingTime>0?'attack':magnitude>0.1?'walk':'idle',t:swingTime>0?0.58-swingTime:elapsed,time:elapsed,speed:sprint?1.35:1});
 for(const item of ramItems){
  if(!item.active)continue;
  item.group.position.y=surfaceAt(item.x,item.z)+0.92+Math.sin(elapsed*2.45+item.phase)*0.12;
  item.group.rotation.y=elapsed*1.25;item.group.rotation.z=Math.sin(elapsed*1.7+item.phase)*0.08;
  if(Math.hypot(item.x-player.x,item.z-player.z)<1.18&&Math.abs(item.group.position.y-(player.y+0.9))<1.75){
   item.active=false;scene.remove(item.group);player.ram+=item.amount;player.score+=item.amount*25;
   effects.ring(item.x,0,item.z,{colour:'#a6ff52',reach:1.65,life:0.34});
   tone(640+player.ram*9,0.08,0.12);showToast('RAM PICKED UP  +'+item.amount);updateHud();
  }
 }
 for(const item of medItems){
  if(!item.active)continue;
  item.group.position.y=surfaceAt(item.x,item.z)+0.38+Math.sin(elapsed*2+item.phase)*0.08;item.group.rotation.y=elapsed*0.8;
  if(player.health<98&&Math.hypot(item.x-player.x,item.z-player.z)<1.25){
   item.active=false;scene.remove(item.group);player.health=Math.min(100,player.health+28);player.score+=35;
   effects.ring(item.x,0,item.z,{colour:'#a6ff52',reach:1.8,life:0.4});showToast('FIRST AID  +28 HEALTH');updateHud();
  }
 }
  if(townsfolk.some(person=>person.aggro&&person.hp>0))rebuildNavigation(player.x,player.z);
  for(const person of townsfolk){
    if(person.hp<=0){
      person.respawn-=dt;
      if(person.respawn<=0){
        person.hp=person.maxHp;person.stun=0;person.windup=0;person.x=person.homeX;person.z=person.homeZ;
        person.model.group.visible=true;person.wanderTimer=0;
      }else continue;
    }
    person.stun=Math.max(0,person.stun-dt);
    person.attackTimer=Math.max(0,person.attackTimer-dt);
    const dx=player.x-person.x,dz=player.z-person.z,distance=Math.hypot(dx,dz);
    const wasWinding=person.windup>0;
    if(wasWinding){
      person.windup=Math.max(0,person.windup-dt);
      if(person.windup===0&&distance<1.8&&person.stun<=0)hurtPlayer(person,distance);
    }
    let moving=false;
    if(person.stun<=0&&person.windup<=0){
      if(person.aggro&&distance>1.25){
        const waypoint=nextNavigationWaypoint(person.x,person.z);
        moving=moveTownsperson(person,waypoint?waypoint.x:player.x,waypoint?waypoint.z:player.z,person.speed,dt);
      }else if(!person.aggro){
        person.wanderTimer-=dt;
        const wanderDistance=Math.hypot(person.wanderX-person.x,person.wanderZ-person.z);
        if(person.wanderTimer<=0||wanderDistance<0.18)chooseWanderTarget(person);
        moving=moveTownsperson(person,person.wanderX,person.wanderZ,person.speed*0.42,dt);
        if(!moving&&wanderDistance>0.25)person.wanderTimer=0;
      }
    }
    person.x=Math.max(-39,Math.min(39,person.x));
    person.z=Math.max(-39,Math.min(39,person.z));
    person.model.group.position.set(person.x,surfaceAt(person.x,person.z),person.z);
    if(moving)person.model.group.rotation.y=Math.atan2(player.x-person.x,player.z-person.z);
    person.model.pose({
      clip:person.stun>0?'hit':person.windup>0?'attack':moving?'walk':'idle',
      t:elapsed+person.phase,time:elapsed,
    });
    if(!wasWinding&&person.aggro&&person.windup<=0&&distance<1.45&&person.attackTimer<=0&&person.stun<=0){
      person.windup=0.42;person.attackTimer=1.35;
      effects.ring(person.x,0,person.z,{colour:'#ff6159',reach:1.25,life:0.36});
    }
  }
 if(player.grounded&&player.ram>0&&Math.hypot(player.x-GETAWAY.x,player.z-GETAWAY.z)<2.9)deliverRam();
 const k=1-Math.exp(-5*dt);
 stage.target.x+=(player.x-stage.target.x)*k;stage.target.y+=(player.y+1.15-stage.target.y)*k;stage.target.z+=(player.z-stage.target.z)*k;
 stage.shake=Math.max(0,stage.shake-dt*0.6);effects.update(dt);updateHud();
});
globalThis.ramStealinSam = {
  player,
  stage,
  townsfolk,
  get ramPickups() { return ramItems.filter((item) => item.active).length; },
  get raidableProperties() { return properties.filter((item) => !item.raided).length; },
  get townsfolk() { return townsfolk.filter((item) => item.hp > 0).length; },
  deliverRam,
};
