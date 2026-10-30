import * as GFX from 'madness-engine/gfx';
import { createAudio } from 'madness-engine/audio';
import { createInput } from 'madness-engine/input';
import { createStage } from 'madness-engine/stage';
import { createModel } from 'madness-engine/models/model';
import { toGround } from 'madness-engine/view';
import robot from 'madness-engine/characters/robot';
import punk from 'madness-engine/characters/punk';
import critic from 'madness-engine/characters/critic';
import security from 'madness-engine/characters/security';
import bouncer from 'madness-engine/characters/bouncer';
import { createEffects } from 'madness-engine/effects';
import { paintRoom } from 'madness-engine/textures/rooms/studio';
import { paintSky } from 'madness-engine/textures/skies/haze';
import { asphalt as paintAsphalt, concrete as paintConcrete, plate as paintPlate, grate as paintGrate, tiled } from 'madness-engine/textures/painters';
import './style.css';

// Temporary player cast: the engine's tin-can Robot Waiter. Replace this
// import when the final Sam sculpt is ready; gameplay is decoupled from the cast.
const host = document.querySelector('#game');
const stage = await createStage(host, {
  sky: paintSky(),
  room: paintRoom(),
  ui: [document.querySelector('#overlay')],
  label: 'ram-stealin-sam',
});
const { scene } = stage;
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
  combo: document.querySelector('#combo-count'),
  dash: document.querySelector('#dash-status'),
  timer: document.querySelector('#run-time'),
  radar: document.querySelector('#radar'),
};
const TARGET_RAM = 20;
const DATA_CENTER = { x: 0, z: -31.2 };
let started = false;
let won = false;
let toastTimer = 0;
let attackQueued = false;
let jumpQueued = false;
let dashQueued = false;

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
  if (started && !won && event.code === 'KeyR') dashQueued = true;
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
  event.preventDefault();
  attackQueued = true;
  wakeAudio();
});
document.querySelector('#dash-button').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  dashQueued = true;
  wakeAudio();
});
document.querySelector('#jump-button').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  jumpQueued = true;
  wakeAudio();
});
document.querySelector('#play-again').addEventListener('click', () => location.reload());

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
function addRing(x, z, radius, material, y = 0.025) {
  const mesh = new GFX.Mesh(new GFX.TorusGeometry(radius - 0.06, 0.06, 8, 48), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

// Connected industrial raid yard: broad combat floor, catwalks and ramps.
// No buildings. All playable decks use Madness Engine concrete, plate and
// grate painters; the collision surface is calculated from these same decks.
const asphaltTexture=paintAsphalt(GFX),concreteTexture=paintConcrete(GFX);
const plateTexture=paintPlate(GFX),grateTexture=paintGrate(GFX);
const surfaceMaterial=(paint,tint,roughness,metalness,rx=1,ry=rx)=>new GFX.MeshStandardMaterial({
 color:tint,map:tiled(GFX,paint.map,rx,ry),bumpMap:tiled(GFX,paint.bump,rx,ry),bumpScale:0.045,roughness,metalness
});
mats.ground=surfaceMaterial(asphaltTexture,'#69777b',0.96,0.02,18,18);
const floor=new GFX.Mesh(new GFX.PlaneGeometry(84,84),mats.ground);
floor.rotation.x=-Math.PI/2;floor.position.y=0;floor.receiveShadow=true;scene.add(floor);
const deckFinishes=[
 surfaceMaterial(concreteTexture,'#a7afb0',0.88,0.04,3,3),
 surfaceMaterial(plateTexture,'#a5b0b5',0.46,0.56,3,3),
 surfaceMaterial(grateTexture,'#8a999e',0.66,0.42,3,3)
];
// Edge-to-edge slabs form one continuous cross-shaped depot yard.
const platforms=[
 {id:'concourse',x:0,z:0,w:20,d:18,h:0.9,finish:0},
 {id:'west-lane',x:-15,z:0,w:10,d:28,h:0.9,finish:1},
 {id:'east-lane',x:15,z:0,w:10,d:28,h:0.9,finish:2},
 {id:'south-apron',x:0,z:13,w:20,d:8,h:0.9,finish:0},
 {id:'north-apron',x:0,z:-13,w:20,d:8,h:0.9,finish:1},
 {id:'north-overlook',x:0,z:-31,w:16,d:8,h:1.55,finish:2},
 {id:'west-catwalk',x:-35,z:0,w:10,d:20,h:1.35,finish:2},
 {id:'east-catwalk',x:35,z:0,w:10,d:20,h:1.35,finish:1}
];
for(const p of platforms){
 addBox(p.x,p.h/2,p.z,p.w,p.h,p.d,mats.dark,false);
 const top=new GFX.Mesh(new GFX.PlaneGeometry(p.w,p.d),deckFinishes[p.finish]);
 top.rotation.x=-Math.PI/2;top.position.set(p.x,p.h+0.014,p.z);top.receiveShadow=true;scene.add(top);
 const y=p.h+0.032,band=p.finish===2?mats.trim:mats.warning;
 addBox(p.x,y,p.z-p.d/2+0.035,p.w,0.035,0.07,band,false);
 addBox(p.x,y,p.z+p.d/2-0.035,p.w,0.035,0.07,band,false);
 addBox(p.x-p.w/2+0.035,y,p.z,0.07,0.035,p.d,band,false);
 addBox(p.x+p.w/2-0.035,y,p.z,0.07,0.035,p.d,band,false);
}
// Wide ramps connect the lower apron to the upper north deck and side walks.
const ramps=[
 {id:'south-entry',axis:'z',cross:0,width:10,lowAt:27,highAt:17,low:0.12,high:0.914},
 {id:'north-rise',axis:'z',cross:0,width:10,lowAt:-17,highAt:-27,low:0.914,high:1.564},
 {id:'west-rise',axis:'x',cross:0,width:10,lowAt:-20,highAt:-30,low:0.914,high:1.364},
 {id:'east-rise',axis:'x',cross:0,width:10,lowAt:20,highAt:30,low:0.914,high:1.364}
];
function addRamp(r,material){
 const h=r.width/2;
 const pos=r.axis==='z'
  ?[r.cross-h,r.low,r.lowAt,r.cross+h,r.low,r.lowAt,r.cross-h,r.high,r.highAt,r.cross+h,r.high,r.highAt]
  :[r.lowAt,r.low,r.cross-h,r.lowAt,r.low,r.cross+h,r.highAt,r.high,r.cross-h,r.highAt,r.high,r.cross+h];
 const length=Math.abs(r.highAt-r.lowAt),g=new GFX.BufferGeometry();
 g.setAttribute('position',new GFX.BufferAttribute(new Float32Array(pos),3));
 g.setAttribute('uv',new GFX.BufferAttribute(new Float32Array([0,0,r.width/3,0,0,length/3,r.width/3,length/3]),2));
 g.setIndex(r.axis==='z'?[0,1,2,1,3,2]:(r.highAt>r.lowAt?[0,1,2,1,3,2]:[0,2,1,2,3,1]));
 g.computeVertexNormals();const mesh=new GFX.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);
}
for(const r of ramps)addRamp(r,deckFinishes[1]);
function insideFootprint(x,z,o,margin=0){return Math.abs(x-o.x)<=o.w/2-margin&&Math.abs(z-o.z)<=o.d/2-margin;}
function insideRamp(x,z,r){
 if(r.axis==='z')return Math.abs(x-r.cross)<=r.width/2&&z>=Math.min(r.lowAt,r.highAt)-0.03&&z<=Math.max(r.lowAt,r.highAt)+0.03;
 return Math.abs(z-r.cross)<=r.width/2&&x>=Math.min(r.lowAt,r.highAt)-0.03&&x<=Math.max(r.lowAt,r.highAt)+0.03;
}
function rampHeightAt(x,z,r){
 const c=r.axis==='z'?z:x,t=Math.max(0,Math.min(1,(r.lowAt-c)/(r.lowAt-r.highAt)));
 return r.low+(r.high-r.low)*t;
}
function surfaceAt(x,z){
 let height=0.12;
 for(const p of platforms)if(insideFootprint(x,z,p))height=Math.max(height,p.h+0.014);
 for(const r of ramps)if(insideRamp(x,z,r))height=Math.max(height,rampHeightAt(x,z,r));
 return height;
}
function canMoveTo(x,z,feetY){
 if(x< -41||x>41||z< -41||z>41)return false;
 const onRamp=ramps.some(r=>insideRamp(x,z,r));
 for(const p of platforms)if(insideFootprint(x,z,p,0.035)&&feetY<p.h+0.014-0.12&&!onRamp)return false;
 return true;
}
// Painted service-bay lines and deck rings give each zone a distinct identity.
addRing(0,0,6.8,mats.trim,0.928);addRing(0,-31,5,mats.warning,1.59);
for(let i=-2;i<=2;i++){
 const x=-15+i*3;
 addBox(x,0.928,-7.7,0.055,0.012,10.5,mats.warning,false);
 addBox(x,0.928,7.7,0.055,0.012,10.5,mats.warning,false);
}
for(let z=-7;z<=7;z+=2){
 addBox(-15,0.928,z,0.06,0.012,0.7,mats.trim,false);
 addBox(15,0.928,z,0.06,0.012,0.7,mats.trim,false);
}
const terminalY=surfaceAt(DATA_CENTER.x,DATA_CENTER.z);
const deliveryPad=addCylinder(DATA_CENTER.x,terminalY+0.055,DATA_CENTER.z,3.1,0.11,mats.trim,56);
deliveryPad.material=new GFX.MeshStandardMaterial({color:'#a6ff52',emissive:'#4d9b1c',emissiveIntensity:0.85,transparent:true,opacity:0.66});
addRing(DATA_CENTER.x,DATA_CENTER.z,3.5,mats.trim,terminalY+0.12);
addCylinder(DATA_CENTER.x+4.1,terminalY+1.05,DATA_CENTER.z,0.13,2.1,mats.warning,20);
addCylinder(DATA_CENTER.x+4.1,terminalY+2.15,DATA_CENTER.z,0.24,0.22,mats.trim,20);
const effects=createEffects(GFX,scene,{ground:{heightAt:surfaceAt}});
const sparkGeometry=new GFX.BoxGeometry(0.075,0.13,0.055);
function sparkBurst(x,y,z,count=16,material=mats.ram){
 effects.burst({at:[x,y,z],count,speed:3.3,up:2.4,life:0.55,lifeSpread:0.35,
  mesh:()=>new GFX.Mesh(sparkGeometry,material),scale:[0.55,1.25],bounce:0.18});
}
for(const [x,z] of [[-18,-11],[18,-11],[-18,11],[18,11],[-7,4],[7,4]]){
 addCylinder(x,surfaceAt(x,z)+0.28,z,0.13,0.56,mats.warning,12);
 addCylinder(x,surfaceAt(x,z)+0.58,z,0.19,0.1,mats.trim,12);
}
// The player's model is deliberately replaceable: this cast member is a stand-in.
const sam = createModel(GFX, robot, { detail: 0.86 });
scene.add(sam.group);
sam.group.scale.setScalar(0.98);
const START = { x: 0, z: 13 };
const player={x:START.x,z:START.z,y:surfaceAt(START.x,START.z),vy:0,yaw:Math.PI,
 health:100,ram:0,delivered:0,score:0,kills:0,invulnerable:0,attackCooldown:0,grounded:true,
 combo:0,comboTimer:0,dashCooldown:0,dashTime:0,dashX:0,dashZ:1};
sam.group.position.set(player.x, player.y, player.z);

// Glowing RAM-stick pickups: two green DIMMs and a central contact strip.
const ramItems=[];
const ramGeometry=new GFX.BoxGeometry(0.13,0.76,0.22),ramContacts=new GFX.BoxGeometry(0.14,0.08,0.24);
function spawnRam(x,z,amount=1){
 const group=new GFX.Group();
 for(let i=0;i<amount;i++){
  const stick=new GFX.Mesh(ramGeometry,mats.ram);
  stick.position.set((i-(amount-1)/2)*0.23,0.06,0);stick.rotation.z=(i-(amount-1)/2)*0.12;
  const contact=new GFX.Mesh(ramContacts,mats.ramDark);contact.position.set(stick.position.x,-0.34,0);
  group.add(stick,contact);
 }
 group.position.set(x,surfaceAt(x,z)+0.92,z);scene.add(group);
 ramItems.push({group,x,z,amount,phase:Math.random()*Math.PI*2,active:true});
}
[
 [-7,5],[7,5],[-15,9],[15,9],[-16,-7],[16,-7],[-7,-7],[7,-7],
 [0,7],[0,-7],[-24,-6],[24,6],[-24,6],[24,-6],[-6,-31],[6,-31],
 [-3,-33],[3,-33],[-6,16],[6,16],[-14,0],[14,0]
].forEach(([x,z],i)=>spawnRam(x,z,i%5===0?2:1));
const medItems=[];
function spawnMedkit(x,z){
 const group=new GFX.Group(),base=new GFX.Mesh(new GFX.BoxGeometry(0.42,0.18,0.42),mats.dark);
 const barA=new GFX.Mesh(new GFX.BoxGeometry(0.1,0.24,0.12),mats.trim);
 const barB=new GFX.Mesh(new GFX.BoxGeometry(0.28,0.1,0.12),mats.trim);
 barA.position.y=0.15;barB.position.y=0.15;group.add(base,barA,barB);
 group.position.set(x,surfaceAt(x,z)+0.38,z);scene.add(group);
 medItems.push({x,z,group,phase:Math.random()*Math.PI*2,active:true});
}
[[-18,0],[18,0],[0,20],[0,-31]].forEach(([x,z])=>spawnMedkit(x,z));

// Rushers pressure quickly; guards hold lanes; heavies hit hard and take a combo.
const cast=[punk,critic,security,bouncer,security,punk,critic,security,bouncer];
const enemySpots=[[-15,9],[15,9],[-15,-7],[15,-7],[-5,-13],[5,-13],[-5,-31],[5,-31],[0,3]];
const enemies=enemySpots.map(([x,z],i)=>{
 const model=createModel(GFX,cast[i%cast.length],{detail:0.68});
 scene.add(model.group);model.group.scale.setScalar(i%4===3?1.02:0.9);
 const role=i%4,hp=role===3?4:role===2?3:2;
 const hpBack=addBox(x,surfaceAt(x,z)+1.8,z,1.05,0.075,0.06,mats.dark,false);
 const hpFill=addBox(x,surfaceAt(x,z)+1.8,z,0.96,0.045,0.07,mats.trim,false);
 hpBack.visible=false;hpFill.visible=false;
 const enemy={
  model,x,z,homeX:x,homeZ:z,kind:role===0?'RUSHER':role===3?'HEAVY':'GUARD',
  hp,maxHp:hp,speed:role===0?3.55:role===3?1.65:2.45,
  damage:role===3?19:role===2?15:11,range:role===3?1.65:1.42,
  drop:role===3?5:3,active:true,stun:0,respawn:0,attackTimer:0,windup:0,
  phase:i*1.7,hpBack,hpFill
 };
 model.group.position.set(x,surfaceAt(x,z),z);return enemy;
});
let elapsed=0,runTime=0,swingTime=0;
stage.target.set(player.x,player.y+1.2,player.z);stage.view.zoomBy(1.12);
function formatTime(seconds){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;}
const radarCtx=ui.radar?.getContext('2d');
function drawRadar(){
 if(!radarCtx)return;
 const c=radarCtx,w=c.canvas.width,h=c.canvas.height;
 c.clearRect(0,0,w,h);c.fillStyle='#071118';c.fillRect(0,0,w,h);
 const px=x=>(x+42)*w/84,pz=z=>(z+42)*h/84;
 c.strokeStyle='rgba(166,255,82,.12)';c.lineWidth=1;
 for(let i=0;i<=4;i++){const q=i*w/4;c.beginPath();c.moveTo(q,0);c.lineTo(q,h);c.stroke();c.beginPath();c.moveTo(0,q);c.lineTo(w,q);c.stroke();}
 for(const p of platforms){
  c.fillStyle=p.h>1.4?'#41616a':p.h>1.2?'#394e57':'#263b43';
  c.fillRect(px(p.x-p.w/2),pz(p.z-p.d/2),p.w*w/84,p.d*h/84);
  c.strokeStyle='rgba(166,255,82,.45)';c.strokeRect(px(p.x-p.w/2),pz(p.z-p.d/2),p.w*w/84,p.d*h/84);
 }
 c.strokeStyle='#b58b42';c.lineWidth=3;
 for(const r of ramps){c.beginPath();if(r.axis==='z'){c.moveTo(px(r.cross),pz(r.lowAt));c.lineTo(px(r.cross),pz(r.highAt));}else{c.moveTo(px(r.lowAt),pz(r.cross));c.lineTo(px(r.highAt),pz(r.cross));}c.stroke();}
 const tx=px(DATA_CENTER.x),tz=pz(DATA_CENTER.z);c.strokeStyle='#a6ff52';c.lineWidth=1.5;c.beginPath();c.arc(tx,tz,7,0,Math.PI*2);c.stroke();
 for(const item of ramItems)if(item.active){c.fillStyle='#a6ff52';c.fillRect(px(item.x)-1,pz(item.z)-1,2.5,2.5);}
 for(const e of enemies)if(e.active){c.fillStyle='#ff655c';c.beginPath();c.arc(px(e.x),pz(e.z),2.7,0,Math.PI*2);c.fill();}
 c.fillStyle='#fff';c.beginPath();c.arc(px(player.x),pz(player.z),3.5,0,Math.PI*2);c.fill();
 c.strokeStyle='#fff';c.lineWidth=1;c.beginPath();c.arc(px(player.x),pz(player.z),6.2,0,Math.PI*2);c.stroke();
}
function updateHud(){
 ui.ram.textContent=String(player.ram).padStart(2,'0');
 ui.delivered.textContent=`${String(player.delivered).padStart(2,'0')} / ${TARGET_RAM}`;
 ui.health.style.width=`${Math.max(0,player.health)}%`;
 ui.health.style.background=player.health<35?'#ff655c':'#a6ff52';
 ui.objective.textContent=player.delivered>=TARGET_RAM?'Target secured. Clear the yard.':`Collect RAM and bank ${TARGET_RAM-player.delivered} more at the north terminal.`;
 ui.status.textContent=player.ram>0?`Carrying ${player.ram} RAM. Bank it before security takes you down.`:'Raid the rivals or strip the marked decks for RAM.';
 ui.score.textContent=String(player.score).padStart(5,'0');
 ui.combo.textContent=player.combo>1?`x${player.combo}`:'—';
 ui.dash.textContent=player.dashCooldown>0?`${player.dashCooldown.toFixed(1)}s`:'READY';
 ui.timer.textContent=formatTime(runTime);drawRadar();
}
updateHud();

function attack(){
 if(player.attackCooldown>0||!started||won)return;
 player.combo=player.comboTimer>0?(player.combo%3)+1:1;
 player.comboTimer=1.15;player.attackCooldown=player.combo===3?0.62:0.4;swingTime=0.56;
 tone(210+player.combo*35,0.12,0.16);
 const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw),reach=player.combo===3?3.75:3.2;
 let hits=0;
 for(const enemy of enemies){
  if(!enemy.active)continue;
  const dx=enemy.x-player.x,dz=enemy.z-player.z,distance=Math.hypot(dx,dz);
  const dot=distance>0.001?(dx*fx+dz*fz)/distance:1;
  if(distance>reach||dot<0.18||Math.abs(surfaceAt(enemy.x,enemy.z)-player.y)>1.35)continue;
  enemy.hp-=player.combo===3?2:1;enemy.stun=player.combo===3?0.8:0.48;enemy.windup=0;
  const shove=player.combo===3?1.25:0.62,px=enemy.x+fx*shove,pz=enemy.z+fz*shove;
  if(canMoveTo(px,enemy.z,surfaceAt(enemy.x,enemy.z)))enemy.x=px;
  if(canMoveTo(enemy.x,pz,surfaceAt(enemy.x,enemy.z)))enemy.z=pz;
  effects.ring(enemy.x,surfaceAt(enemy.x,enemy.z),enemy.z,{colour:player.combo===3?'#a6ff52':'#f2ae45',reach:1.35,life:0.28});
  sparkBurst(enemy.x,surfaceAt(enemy.x,enemy.z)+0.75,enemy.z,9);hits++;
  if(enemy.hp<=0){
   enemy.active=false;enemy.model.group.visible=false;enemy.hpBack.visible=false;enemy.hpFill.visible=false;enemy.respawn=10;
   player.kills++;player.score+=250+player.combo*75;
   for(let i=0;i<enemy.drop;i++)spawnRam(enemy.x+(i-(enemy.drop-1)/2)*0.28,enemy.z+0.28,1);
   showToast(`${enemy.kind} DOWN  +${enemy.drop} RAM`);tone(530,0.18,0.2);
  }else{player.score+=35;showToast(player.combo===3?'BREAKING STRIKE':'CLEAN HIT');}
 }
 if(hits){
  player.combo=Math.min(9,player.combo+(hits>1?1:0));
  effects.ring(player.x,player.y,player.z,{colour:'#a6ff52',reach:2.3,life:0.3});
  stage.shake=Math.max(stage.shake,player.combo===3?0.2:0.1);updateHud();
 }else showToast('OUT OF RANGE — CLOSE THE GAP');
}
function dash(){
 if(player.dashCooldown>0||!started||won)return;
 player.dashCooldown=2.35;player.dashTime=0.2;
 player.dashX=Math.sin(player.yaw);player.dashZ=Math.cos(player.yaw);
 player.invulnerable=Math.max(player.invulnerable,0.32);
 effects.ring(player.x,player.y,player.z,{colour:'#2ad0ff',reach:3,life:0.34});
 sparkBurst(player.x,player.y+0.45,player.z,7,mats.trim);
 stage.shake=Math.max(stage.shake,0.06);tone(410,0.08,0.08);
}
function deliverRam(){
 if(player.ram<=0||won)return;
 const amount=player.ram;player.ram=0;player.delivered+=amount;player.score+=amount*70;
 showToast(`BANKED ${amount} RAM — ${player.delivered}/${TARGET_RAM}`);
 effects.ring(DATA_CENTER.x,terminalY,DATA_CENTER.z,{colour:'#a6ff52',reach:4.2,life:0.65});
 sparkBurst(DATA_CENTER.x,terminalY+0.5,DATA_CENTER.z,28);
 tone(720,0.22,0.18);updateHud();
 if(player.delivered>=TARGET_RAM){
  won=true;ui.winCopy.textContent=`${player.delivered} RAM banked • ${player.kills} rivals dropped • score ${player.score} • ${formatTime(runTime)}`;
  ui.win.hidden=false;
 }
}
function hurtPlayer(enemy,distance){
 if(player.invulnerable>0)return;
 player.health=Math.max(0,player.health-enemy.damage);player.invulnerable=0.82;player.combo=0;
 const dx=player.x-enemy.x,dz=player.z-enemy.z,d=Math.max(0.01,distance);
 const px=player.x+dx/d*0.72,pz=player.z+dz/d*0.72;
 if(canMoveTo(px,player.z,player.y))player.x=px;
 if(canMoveTo(player.x,pz,player.y))player.z=pz;
 showToast('HIT — BREAK CONTACT');tone(115,0.18,0.18);
 stage.shake=Math.max(stage.shake,0.18);updateHud();
 if(player.health<=0)respawnPlayer();
}
function respawnPlayer(){
 const lost=Math.floor(player.ram/2);
 for(let i=0;i<lost;i++)spawnRam(player.x+Math.cos(i*2.4)*0.65,player.z+Math.sin(i*2.4)*0.65,1);
 player.ram-=lost;player.x=START.x;player.z=START.z;player.y=surfaceAt(START.x,START.z);
 player.vy=0;player.grounded=true;player.health=65;player.invulnerable=2.1;player.combo=0;
 jumpQueued=false;attackQueued=false;dashQueued=false;
 showToast(lost?`SHUTTLE RESPAWN — LOST ${lost} RAM`:'SHUTTLE RESPAWN — BACK IN THE YARD');updateHud();
}
stage.run((rawDt)=>{
 const dt=Math.min(rawDt,0.05);elapsed+=dt;input.take();
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show');}
 if(!started||won){
  effects.update(dt);stage.shake=Math.max(0,stage.shake-dt*0.55);
  const look=input.view(dt);stage.view.turn(look.turn,look.tilt);stage.view.zoomBy(look.zoom);stage.view.step(dt);return;
 }
 runTime+=dt;
 player.attackCooldown=Math.max(0,player.attackCooldown-dt);player.invulnerable=Math.max(0,player.invulnerable-dt);
 player.dashCooldown=Math.max(0,player.dashCooldown-dt);player.comboTimer=Math.max(0,player.comboTimer-dt);
 if(player.comboTimer<=0)player.combo=0;
 if(player.dashTime>0)player.dashTime=Math.max(0,player.dashTime-dt);
 if(swingTime>0)swingTime=Math.max(0,swingTime-dt);
 const look=input.view(dt);stage.view.turn(look.turn,look.tilt);stage.view.zoomBy(look.zoom);stage.view.step(dt);
 if(dashQueued)dash();dashQueued=false;
 let [mx,mz]=toGround(input.stick(),stage.view.yaw);
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),dashing=player.dashTime>0;
 if(dashing){mx=player.dashX;mz=player.dashZ;}
 const magnitude=Math.min(1,Math.hypot(mx,mz)),speed=dashing?17.5:sprint?9.6:6.9;
 if(magnitude>0.08){
  const nx=player.x+mx*speed*dt,nz=player.z+mz*speed*dt;
  if(canMoveTo(nx,player.z,player.y))player.x=nx;
  if(canMoveTo(player.x,nz,player.y))player.z=nz;
  player.yaw=Math.atan2(mx,mz);
 }
 player.x=Math.max(-41,Math.min(41,player.x));player.z=Math.max(-41,Math.min(41,player.z));
 const rise=surfaceAt(player.x,player.z)-player.y;
 if(player.grounded&&player.vy<=0&&rise>0&&rise<0.24)player.y+=rise;
 const previousY=player.y;
 if(player.grounded&&jumpQueued){player.vy=10.6;player.grounded=false;tone(340,0.08,0.06);}
 jumpQueued=false;player.vy-=23*dt;player.y+=player.vy*dt;
 const support=surfaceAt(player.x,player.z);
 if(player.vy<=0&&previousY>=support-0.1&&player.y<=support){player.y=support;player.vy=0;player.grounded=true;}
 else player.grounded=false;
 if(player.y< -4)respawnPlayer();
 if(attackQueued)attack();attackQueued=false;
 sam.group.position.set(player.x,player.y,player.z);sam.group.rotation.y=player.yaw;
 sam.group.rotation.z=player.invulnerable>0?Math.sin(elapsed*28)*0.08:0;
 sam.pose({clip:swingTime>0?'attack':magnitude>0.1?'walk':'idle',t:swingTime>0?0.56-swingTime:elapsed,time:elapsed,speed:dashing?2.1:sprint?1.35:1});

 for(const item of ramItems){
  if(!item.active)continue;
  const groundY=surfaceAt(item.x,item.z);
  item.group.position.y=groundY+0.92+Math.sin(elapsed*2.5+item.phase)*0.12;
  item.group.rotation.y=elapsed*1.2;item.group.rotation.z=Math.sin(elapsed*1.7+item.phase)*0.08;
  if(Math.hypot(item.x-player.x,item.z-player.z)<1.25&&Math.abs(item.group.position.y-(player.y+0.9))<1.65){
   item.active=false;scene.remove(item.group);player.ram+=item.amount;player.score+=item.amount*25;
   effects.ring(item.x,groundY,item.z,{colour:'#a6ff52',reach:1.8,life:0.38});
   tone(650+player.ram*8,0.08,0.13);showToast(`RAM ACQUIRED  +${item.amount}`);updateHud();
  }
 }
 for(const item of medItems){
  if(!item.active)continue;
  item.group.position.y=surfaceAt(item.x,item.z)+0.38+Math.sin(elapsed*2.1+item.phase)*0.08;
  item.group.rotation.y=elapsed*0.75;
  if(player.health<98&&Math.hypot(item.x-player.x,item.z-player.z)<1.3){
   item.active=false;scene.remove(item.group);player.health=Math.min(100,player.health+28);player.score+=40;
   effects.ring(item.x,surfaceAt(item.x,item.z),item.z,{colour:'#a6ff52',reach:1.9,life:0.42});
   showToast('PATCH KIT  +28 HEALTH');tone(780,0.12,0.12);updateHud();
  }
 }
 for(const enemy of enemies){
  if(!enemy.active){
   enemy.respawn-=dt;
   if(enemy.respawn<=0){enemy.active=true;enemy.model.group.visible=true;enemy.hp=enemy.maxHp;enemy.x=enemy.homeX;enemy.z=enemy.homeZ;enemy.windup=0;enemy.attackTimer=0;}
   else continue;
  }
  enemy.stun=Math.max(0,enemy.stun-dt);enemy.attackTimer=Math.max(0,enemy.attackTimer-dt);
  const dx=player.x-enemy.x,dz=player.z-enemy.z,distance=Math.hypot(dx,dz),wasWinding=enemy.windup>0;
  if(wasWinding){enemy.windup=Math.max(0,enemy.windup-dt);if(enemy.windup===0&&distance<enemy.range+0.3&&enemy.stun<=0)hurtPlayer(enemy,distance);}
  let vx=0,vz=0;
  if(enemy.stun<=0&&enemy.windup<=0){
   if(distance<12&&distance>enemy.range*0.82){vx=dx/Math.max(0.01,distance);vz=dz/Math.max(0.01,distance);}
   else if(distance>=12){
    const a=elapsed*0.42+enemy.phase,tx=enemy.homeX+Math.cos(a)*1.7,tz=enemy.homeZ+Math.sin(a)*1.7;
    const txd=tx-enemy.x,tzd=tz-enemy.z,td=Math.hypot(txd,tzd);
    if(td>0.12){vx=txd/td;vz=tzd/td;}
   }
   const nx=enemy.x+vx*enemy.speed*dt,nz=enemy.z+vz*enemy.speed*dt,ey=surfaceAt(enemy.x,enemy.z);
   if(canMoveTo(nx,enemy.z,ey)&&Math.abs(surfaceAt(nx,enemy.z)-ey)<0.24)enemy.x=nx;
   if(canMoveTo(enemy.x,nz,ey)&&Math.abs(surfaceAt(enemy.x,nz)-ey)<0.24)enemy.z=nz;
  }
  const enemyY=surfaceAt(enemy.x,enemy.z);
  enemy.model.group.position.set(enemy.x,enemyY,enemy.z);enemy.model.group.rotation.z=enemy.windup>0?-0.08:0;
  if(Math.abs(vx)+Math.abs(vz)>0.01)enemy.model.group.rotation.y=Math.atan2(vx,vz);
  enemy.model.pose({clip:enemy.stun>0?'hit':enemy.windup>0?'attack':Math.abs(vx)+Math.abs(vz)>0.01?'walk':'idle',t:elapsed+enemy.phase,time:elapsed});
  const showBar=enemy.hp<enemy.maxHp&&Math.hypot(enemy.x-player.x,enemy.z-player.z)<10;
  enemy.hpBack.visible=showBar;enemy.hpFill.visible=showBar;
  if(showBar){
   const f=Math.max(0,enemy.hp/enemy.maxHp),by=enemyY+1.72;
   enemy.hpBack.position.set(enemy.x,by,enemy.z);enemy.hpFill.scale.x=f;
   enemy.hpFill.position.set(enemy.x-(1-f)*0.48,by,enemy.z+0.04);
  }
  if(!wasWinding&&enemy.windup===0&&distance<enemy.range&&enemy.attackTimer<=0&&enemy.stun<=0){enemy.windup=0.42;enemy.attackTimer=1.3;}
 }
 if(player.grounded&&player.ram>0&&Math.hypot(player.x-DATA_CENTER.x,player.z-DATA_CENTER.z)<3&&Math.abs(player.y-terminalY)<0.24)deliverRam();
 const follow=1-Math.exp(-5.2*dt);
 stage.target.x+=(player.x-stage.target.x)*follow;stage.target.y+=(player.y+1.15-stage.target.y)*follow;stage.target.z+=(player.z-stage.target.z)*follow;
 stage.shake=Math.max(0,stage.shake-dt*0.55);effects.update(dt);updateHud();
});
globalThis.ramStealinSam = {
  player,
  stage,
  enemies,
  get ramPickups() { return ramItems.filter((item) => item.active).length; },
  get medkits() { return medItems.filter((item) => item.active).length; },
  deliverRam,
};
