import * as GFX from 'madness-engine/gfx';
import { createAudio } from 'madness-engine/audio';
import { createInput } from 'madness-engine/input';
import { createStage } from 'madness-engine/stage';
import { createModel } from 'madness-engine/models/model';
import { toGround } from 'madness-engine/view';
import agent from 'madness-engine/characters/agent';
import punk from 'madness-engine/characters/punk';
import critic from 'madness-engine/characters/critic';
import { paintRoom } from 'madness-engine/textures/rooms/studio';
import { paintSky } from 'madness-engine/textures/skies/haze';
import './style.css';

// The Agent is a temporary cast choice for Sam. Swap this import when the
// final Sam sculpt is ready; movement, combat and progression are independent.
const host = document.querySelector('#game');
const stage = await createStage(host, {
  sky: paintSky(),
  room: paintRoom(),
  ui: [document.querySelector('#overlay')],
  label: 'ram-stealin-sam',
});
const { scene } = stage;
const input = createInput(host);

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
};
const TARGET_RAM = 20;
const DATA_CENTER = { x: 14, z: -8 };
let started = false;
let won = false;
let toastTimer = 0;
let attackQueued = false;
let jumpQueued = false;
let muted = false;

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
  keys.add(event.code);
  if (event.code === 'Space') jumpQueued = true;
  if (event.code === 'KeyE' || event.code === 'KeyF') attackQueued = true;
  if (event.code === 'KeyM') {
    audio.toggleMute();
    muted = !muted;
    showToast(muted ? 'AUDIO MUTED' : 'AUDIO ON');
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
function addRing(x, z, radius, material) {
  const mesh = new GFX.Mesh(new GFX.RingGeometry(radius - 0.12, radius, 48), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.025, z);
  scene.add(mesh);
  return mesh;
}

// A broad city plaza with raised rooftops, server platforms and jump routes.
const floor = new GFX.Mesh(new GFX.PlaneGeometry(48, 48), mats.ground);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.14;
floor.receiveShadow = true;
scene.add(floor);
const platforms = [
  { x: -9, z: 5, w: 6, d: 6, h: 2.0 },
  { x: -1, z: -3, w: 6, d: 6, h: 3.0 },
  { x: 8, z: 3, w: 7, d: 7, h: 1.55 },
  { x: -10, z: -9, w: 7, d: 7, h: 1.25 },
  { x: 2, z: 11, w: 8, d: 4, h: 1.8 },
  { x: 9, z: -12, w: 5, d: 5, h: 2.25 },
];
for (const p of platforms) {
  addBox(p.x, p.h / 2, p.z, p.w, p.h, p.d, mats.concrete);
  addBox(p.x, p.h + 0.045, p.z, p.w + 0.08, 0.09, p.d + 0.08, mats.dark, false);
  addBox(p.x, p.h + 0.1, p.z - p.d / 2 + 0.08, p.w - 0.2, 0.045, 0.07, mats.trim, false);
}
function surfaceAt(x, z) {
  let height = 0;
  for (const p of platforms) {
    if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) height = Math.max(height, p.h + 0.09);
  }
  return height;
}

// Distant office blocks and a towering glass data center.
for (const [x, z, w, d, h] of [
  [-20, -15, 5, 7, 9], [-19, 1, 6, 6, 7], [-20, 17, 7, 6, 11],
  [20, 16, 5, 7, 10], [20, -1, 6, 6, 8], [3, -21, 7, 4, 7],
  [-7, 21, 8, 4, 6], [19, -20, 5, 5, 12],
]) {
  addBox(x, h / 2, z, w, h, d, mats.dark);
  for (let y = 1.5; y < h - 0.5; y += 1.6) {
    for (let col = -1; col <= 1; col++) {
      addBox(x + col * (w / 3), y, z + d / 2 + 0.025, 0.58, 0.76, 0.05, mats.glass, false);
    }
  }
}
addBox(DATA_CENTER.x, 4.2, DATA_CENTER.z, 6.8, 8.4, 6.8, mats.dark);
addBox(DATA_CENTER.x, 8.5, DATA_CENTER.z, 7.1, 0.22, 7.1, mats.trim);
for (let y = 1.2; y < 8; y += 1.45) {
  for (let col = -1; col <= 1; col++) {
    addBox(DATA_CENTER.x + col * 1.8, y, DATA_CENTER.z + 3.43, 1.15, 0.8, 0.06, mats.glass, false);
  }
}
const deliveryPad = addCylinder(DATA_CENTER.x, 0.05, DATA_CENTER.z + 5.4, 2.5, 0.1, mats.trim, 48);
deliveryPad.material = new GFX.MeshStandardMaterial({ color: '#a6ff52', emissive: '#4d9b1c', emissiveIntensity: 0.7, transparent: true, opacity: 0.62 });
addRing(DATA_CENTER.x, DATA_CENTER.z + 5.4, 2.8, mats.trim);
addBox(DATA_CENTER.x, 0.28, DATA_CENTER.z + 5.4, 1.0, 0.48, 0.85, mats.dark);

// The player's model is deliberately replaceable: this cast member is a stand-in.
const sam = createModel(GFX, agent, { detail: 0.86 });
scene.add(sam.group);
sam.group.scale.setScalar(0.98);
const player = { x: 0, z: 13, y: 0, vy: 0, yaw: Math.PI, health: 100, ram: 0, delivered: 0, invulnerable: 0, attackCooldown: 0, grounded: true };
sam.group.position.set(player.x, player.y, player.z);

// Glowing RAM-stick pickups: two green DIMMs and a central contact strip.
const ramItems = [];
const ramGeometry = new GFX.BoxGeometry(0.13, 0.76, 0.22);
const ramContacts = new GFX.BoxGeometry(0.14, 0.08, 0.24);
function spawnRam(x, z, amount = 1) {
  const group = new GFX.Group();
  for (let i = 0; i < amount; i++) {
    const stick = new GFX.Mesh(ramGeometry, mats.ram);
    stick.position.set((i - (amount - 1) / 2) * 0.23, 0.06, 0);
    stick.rotation.z = (i - (amount - 1) / 2) * 0.12;
    const contact = new GFX.Mesh(ramContacts, mats.ramDark);
    contact.position.set(stick.position.x, -0.34, 0);
    group.add(stick, contact);
  }
  group.position.set(x, surfaceAt(x, z) + 0.92, z);
  scene.add(group);
  ramItems.push({ group, x, z, amount, phase: Math.random() * Math.PI * 2, active: true });
}
[
  [-14, 1], [-5, 12], [4, 15], [12, 4], [4, -10], [-14, -11],
  [-7, -3], [1, -6], [11, -14], [15, -1], [-1, 5], [7, 7],
].forEach(([x, z], i) => spawnRam(x, z, i % 4 === 0 ? 2 : 1));

// Opponents are intentionally generic cast-library people, not real individuals.
const cast = [punk, critic, punk, critic, punk, critic, punk];
const enemySpots = [
  [-13, 8], [-2, 8], [5, -4], [14, 8], [-14, -14], [4, 16], [12, -14],
];
const enemies = enemySpots.map(([x, z], i) => {
  const model = createModel(GFX, cast[i % cast.length], { detail: 0.72 });
  scene.add(model.group);
  model.group.scale.setScalar(0.9);
  const enemy = {
    model, x, z, homeX: x, homeZ: z, hp: 2, active: true,
    stun: 0, respawn: 0, attackTimer: 0, phase: i * 1.7,
  };
  model.group.position.set(x, surfaceAt(x, z), z);
  return enemy;
});

// Neon service markers and low bollards give the plaza a readable scale.
for ( (const [x, z] of [[-16, -3], [-2, 18], [16, 12], [15, -16], [-16, -16]]) {
  addCylinder(x, 0.58, z, 0.16, 1.16, mats.warning, 12);
  addCylinder(x, 1.18, z, 0.25, 0.12, mats.trim, 12);
}
for (let i = -2; i <= 2; i++) {
  addBox(DATA_CENTER.x + i * 1.1, 0.55, DATA_CENTER.z + 3.54, 0.54, 0.35, 0.08, mats.trim, false);
}

let elapsed = 0;
let swingTime = 0;
let deliveredPulse = 0;
stage.target.set(player.x, player.y + 1.2, player.z);
stage.view.zoomBy(-1.0);
function updateHud() {
  ui.ram.textContent = String(player.ram).padStart(2, '0');
  ui.delivered.textContent = `${String(player.delivered).padStart(2, '0')} / ${TARGET_RAM}`;
  ui.health.style.width = `${Math.max(0, player.health)}%`;
  ui.health.style.background = player.health < 35 ? '#ff655c' : '#a6ff52';
  ui.objective.textContent = player.delivered >= TARGET_RAM
    ? 'Quarterly target met. Get out.'
    : `Collect RAM. Deliver ${TARGET_RAM - player.delivered} more to the data center.`;
}
updateHud();

function attack() {
  if (player.attackCooldown > 0 || !started || won) return;
  player.attackCooldown = 0.48;
  swingTime = 0.22;
  tone(210, 0.12, 0.16);
  let hits = 0;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    const dx = enemy.x - player.x, dz = enemy.z - player.z;
    const distance = Math.hypot(dx, dz);
    const dot = distance > 0.001 ? (dx * fx + dz * fz) / distance : 1;
    if (distance < 2.45 && dot > -0.2 && Math.abs(surfaceAt(enemy.x, enemy.z) - player.y) < 2.0) {
      enemy.hp -= 1;
      enemy.x += fx * 0.48;
      enemy.z += fz * 0.48;
      enemy.stun = 0.5;
      hits++;
      if (enemy.hp <= 0) {
        enemy.active = false;
        enemy.respawn = 8;
        for (let i = 0; i < 3; i++) spawnRam(enemy.x + (i - 1) * 0.4, enemy.z + 0.25, 1);
        showToast('OPPONENT RAIDED  +3 RAM');
        tone(530, 0.18, 0.2);
      } else {
        showToast('HIT! THEY DROPPED THEIR GUARD');
      }
    }
  }
  if (!hits) showToast('RAM RAID — NO TARGET IN RANGE');
}
function deliverRam() {
  if (player.ram <= 0 || won) return;
  const amount = player.ram;
  player.ram = 0;
  player.delivered += amount;
  deliveredPulse = 0.8;
  showToast(`DELIVERED ${amount} RAM TO THE DATA CENTER`);
  tone(720, 0.22, 0.18);
  updateHud();
  if (player.delivered >= TARGET_RAM) {
    won = true;
    ui.winCopy.textContent = `${player.delivered} RAM delivered. The data center is online. Sam's quarterly target is secured.`;
    ui.win.hidden = false;
  }
}
function respawnPlayer() {
  player.x = 0; player.z = 13; player.y = surfaceAt(0, 13); player.vy = 0;
  player.health = Math.max(55, player.health);
  player.invulnerable = 2.0;
  showToast('EMERGENCY SHUTTLE — BACK TO THE PLAZA');
  updateHud();
}

stage.run((rawDt) => {
  const dt = Math.min(rawDt, 0.05);
  elapsed += dt;
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.classList.remove('show');
  }
  if (deliveredPulse > 0) deliveredPulse -= dt;
  if (!started || won) {
    const look = input.view(dt);
    stage.view.turn(look.turn, look.tilt);
    stage.view.zoomBy(look.zoom);
    stage.view.step(dt);
    return;
  }

  const look = input.view(dt);
  stage.view.turn(look.turn, look.tilt);
  stage.view.zoomBy(look.zoom);
  stage.view.step(dt);

  const [mx, mz] = toGround(input.stick(), stage.view.yaw);
  const magnitude = Math.min(1, Math.hypot(mx, mz));
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = sprint ? 8.6 : 5.8;
  if (magnitude > 0.08) {
    player.x += mx / Math.max(1, Math.hypot(mx, mz)) * speed * magnitude * dt;
    player.z += mz / Math.max(1, Math.hypot(mx, mz)) * speed * magnitude * dt;
    player.yaw = Math.atan2(mx, mz);
  }
  player.x = Math.max(-21.5, Math.min(21.5, player.x));
  player.z = Math.max(-21.5, Math.min(21.5, player.z));

  const previousY = player.y;
  if (player.grounded && jumpQueued) {
    player.vy = 9.2;
    player.grounded = false;
    tone(340, 0.08, 0.06);
  }
  jumpQueued = false;
  player.vy -= 23 * dt;
  player.y += player.vy * dt;
  const support = surfaceAt(player.x, player.z);
  if (player.vy <= 0 && previousY >= support - 0.06 && player.y <= support) {
    player.y = support;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
  if (player.y < -12) respawnPlayer();

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (attackQueued) attack();
  attackQueued = false;
  if (swingTime > 0) swingTime -= dt;

  sam.group.position.set(player.x, player.y, player.z);
  sam.group.rotation.y = player.yaw;
  sam.group.rotation.z = player.invulnerable > 0 ? Math.sin(elapsed * 28) * 0.08 : 0;
  sam.pose({ clip: magnitude > 0.1 ? 'walk' : 'idle', t: elapsed, time: elapsed });

  for (const item of ramItems) {
    if (!item.active) continue;
    item.group.position.y = surfaceAt(item.x, item.z) + 0.92 + Math.sin(elapsed * 2.5 + item.phase) * 0.12;
    item.group.rotation.y = elapsed * 1.2;
    item.group.rotation.z = Math.sin(elapsed * 1.7 + item.phase) * 0.08;
    if (Math.hypot(item.x - player.x, item.z - player.z) < 1.15 && Math.abs(item.group.position.y - (player.y + 0.9)) < 2.1) {
      item.active = false;
      scene.remove(item.group);
      player.ram += item.amount;
      tone(650 + player.ram * 8, 0.08, 0.13);
      showToast(`RAM ACQUIRED  +${item.amount}`);
      updateHud();
    }
  }

  for (const enemy of enemies) {
    if (!enemy.active) {
      enemy.respawn -= dt;
      if (enemy.respawn <= 0) {
        enemy.active = true;
        enemy.hp = 2;
        enemy.x = enemy.homeX;
        enemy.z = enemy.homeZ;
      } else continue;
    }
    enemy.stun = Math.max(0, enemy.stun - dt);
    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    const dx = player.x - enemy.x, dz = player.z - enemy.z;
    const distance = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (enemy.stun <= 0) {
      if (distance < 8.5 && distance > 1.2) {
        vx = dx / distance; vz = dz / distance;
      } else if (distance >= 8.5) {
        const a = elapsed * 0.45 + enemy.phase;
        const tx = enemy.homeX + Math.cos(a) * 1.45;
        const tz = enemy.homeZ + Math.sin(a) * 1.45;
        const txd = tx - enemy.x, tzd = tz - enemy.z, td = Math.hypot(txd, tzd);
        if (td > 0.1) { vx = txd / td; vz = tzd / td; }
      }
      const eSpeed = distance < 8.5 ? 2.6 : 1.25;
      enemy.x += vx * eSpeed * dt;
      enemy.z += vz * eSpeed * dt;
    }
    enemy.x = Math.max(-21, Math.min(21, enemy.x));
    enemy.z = Math.max(-21, Math.min(21, enemy.z));
    enemy.model.group.position.set(enemy.x, surfaceAt(enemy.x, enemy.z), enemy.z);
    if (Math.abs(vx) + Math.abs(vz) > 0.01) enemy.model.group.rotation.y = Math.atan2(vx, vz);
    enemy.model.pose({ clip: 'walk', t: elapsed + enemy.phase, time: elapsed });
    if (distance < 1.32 && enemy.attackTimer <= 0 && enemy.stun <= 0 && player.invulnerable <= 0) {
      enemy.attackTimer = 1.0;
      player.health = Math.max(0, player.health - 12);
      player.invulnerable = 0.72;
      player.x += dx / Math.max(0.01, distance) * 0.65;
      player.z += dz / Math.max(0.01, distance) * 0.65;
      showToast('YOU GOT BONKED — WATCH YOUR RAM');
      tone(115, 0.18, 0.18);
      updateHud();
      if (player.health <= 0) respawnPlayer();
    }
  }

  if (Math.hypot(player.x - DATA_CENTER.x, player.z - (DATA_CENTER.z + 5.4)) < 3.0 && player.y < 1.3) deliverRam();

  const k = 1 - Math.exp(-5.2 * dt);
  stage.target.x += (player.x - stage.target.x) * k;
  stage.target.y += (player.y + 1.15 - stage.target.y) * k;
  stage.target.z += (player.z - stage.target.z) * k;
});

globalThis.ramStealinSam = {
  player,
  stage,
  enemies,
  get ramPickups() { return ramItems.filter((item) => item.active).length; },
  deliverRam,
};
