import * as GFX from 'madness-engine/gfx';
import { createAudio } from 'madness-engine/audio';
import { createInput } from 'madness-engine/input';
import { createStage } from 'madness-engine/stage';
import { createModel } from 'madness-engine/models/model';
import { toGround } from 'madness-engine/view';
import robot from 'madness-engine/characters/robot';
import punk from 'madness-engine/characters/punk';
import critic from 'madness-engine/characters/critic';
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
};
const TARGET_RAM = 20;
const DATA_CENTER = { x: 18, z: -17 };
let started = false;
let won = false;
let toastTimer = 0;
let attackQueued = false;
let jumpQueued = false;

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
function addRing(x, z, radius, material) {
  const mesh = new GFX.Mesh(new GFX.TorusGeometry(radius - 0.06, 0.06, 8, 48), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.025, z);
  scene.add(mesh);
  return mesh;
}

// Industrial parkour course: a continuous catch floor sits below a real,
// elevated platform route. Falling off a deck means a recoverable drop, not a
// hole in the world. Platform tops and collision heights share one definition.
const asphaltTexture = paintAsphalt(GFX);
const concreteTexture = paintConcrete(GFX);
const plateTexture = paintPlate(GFX);
const grateTexture = paintGrate(GFX);
const surfaceMaterial = (paint, tint, roughness, metalness, repeat = 1) => new GFX.MeshStandardMaterial({
  color: tint,
  map: tiled(GFX, paint.map, repeat, repeat),
  bumpMap: tiled(GFX, paint.bump, repeat, repeat),
  bumpScale: 0.065,
  roughness,
  metalness,
});
mats.ground = surfaceMaterial(asphaltTexture, '#69777b', 0.96, 0.02, 12);
const floor = new GFX.Mesh(new GFX.PlaneGeometry(48, 48), mats.ground);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const platformFinishes = [
  surfaceMaterial(concreteTexture, '#a0aaad', 0.9, 0.02, 2),
  surfaceMaterial(plateTexture, '#9aa7aa', 0.48, 0.58, 2),
  surfaceMaterial(grateTexture, '#7e8e92', 0.66, 0.42, 2),
];
const platforms = [
  // Start deck and first climb.
  { x: 0, z: 17, w: 6, d: 6, h: 0.9, finish: 0, label: 'START' },
  { x: 0, z: 9, w: 5.4, d: 5.4, h: 1.1, finish: 1 },
  // West route, then the central transfer hub.
  { x: -7, z: 4, w: 5.4, d: 5.4, h: 1.3, finish: 2 },
  { x: -14, z: -1, w: 5.4, d: 5.4, h: 1.5, finish: 1 },
  { x: -7, z: -7, w: 5.4, d: 5.4, h: 1.3, finish: 0 },
  { x: 0, z: -1, w: 7.2, d: 7.2, h: 1.45, finish: 0, label: 'HUB' },
  // North spur and mirrored east route form a loop back to the start.
  { x: 0, z: -10, w: 5.4, d: 5.4, h: 1.7, finish: 2 },
  { x: 7, z: -7, w: 5.4, d: 5.4, h: 1.3, finish: 1 },
  { x: 14, z: -1, w: 5.4, d: 5.4, h: 1.5, finish: 2 },
  { x: 7, z: 4, w: 5.4, d: 5.4, h: 1.3, finish: 1 },
  // Optional high-risk outer ledges branch from the hub and upper spur.
  { x: -8, z: -15, w: 5.4, d: 5.4, h: 1.9, finish: 2 },
  { x: 8, z: -15, w: 5.4, d: 5.4, h: 1.9, finish: 2 },
  { x: 0, z: -18, w: 6, d: 5.4, h: 2.05, finish: 1 },
];
for (const [index, p] of platforms.entries()) {
  // Solid box is the physical deck; the textured plane sits exactly at the
  // height returned by surfaceAt() below.
  addBox(p.x, p.h / 2, p.z, p.w, p.h, p.d, mats.dark, false);
  const top = new GFX.Mesh(new GFX.PlaneGeometry(p.w - 0.12, p.d - 0.12), platformFinishes[p.finish]);
  top.rotation.x = -Math.PI / 2;
  top.position.set(p.x, p.h + 0.012, p.z);
  top.receiveShadow = true;
  scene.add(top);

  // High-contrast perimeter markings clarify every landing edge.
  const edgeY = p.h + 0.035;
  const edgeMat = index % 3 === 0 ? mats.trim : mats.warning;
  addBox(p.x, edgeY, p.z - p.d / 2 + 0.055, p.w - 0.16, 0.035, 0.075, edgeMat, false);
  addBox(p.x, edgeY, p.z + p.d / 2 - 0.055, p.w - 0.16, 0.035, 0.075, edgeMat, false);
  addBox(p.x - p.w / 2 + 0.055, edgeY, p.z, 0.075, 0.035, p.d - 0.16, edgeMat, false);
  addBox(p.x + p.w / 2 - 0.055, edgeY, p.z, 0.075, 0.035, p.d - 0.16, edgeMat, false);
}
function insideFootprint(x, z, object, margin = 0) {
  return Math.abs(x - object.x) <= object.w / 2 - margin
    && Math.abs(z - object.z) <= object.d / 2 - margin;
}
function surfaceAt(x, z) {
  let height = 0.12; // Continuous asphalt catch floor.
  for (const p of platforms) {
    if (insideFootprint(x, z, p)) height = Math.max(height, p.h + 0.08);
  }
  return height;
}
// Prevent walking through platform sides. The 0.05 tolerance is deliberately
// tighter than the landing snap tolerance so a descending player cannot enter
// a deck's footprint below its top and tunnel through it.
function canMoveTo(x, z, feetY) {
  if (x < -23.2 || x > 23.2 || z < -23.2 || z > 23.2) return false;
  for (const p of platforms) {
    if (insideFootprint(x, z, p, 0.08) && feetY < p.h + 0.012 - 0.05) return false;
  }
  return true;
}

// The upload terminal is a ground-level objective beyond the elevated route.
const deliveryPad = addCylinder(DATA_CENTER.x, 0.05, DATA_CENTER.z + 5.4, 2.5, 0.1, mats.trim, 48);
deliveryPad.material = new GFX.MeshStandardMaterial({
  color: '#a6ff52', emissive: '#4d9b1c', emissiveIntensity: 0.7,
  transparent: true, opacity: 0.62,
});
addRing(DATA_CENTER.x, DATA_CENTER.z + 5.4, 2.8, mats.trim);
addBox(DATA_CENTER.x, 0.28, DATA_CENTER.z + 5.4, 1.0, 0.48, 0.85, mats.dark);
// The player's model is deliberately replaceable: this cast member is a stand-in.
const sam = createModel(GFX, robot, { detail: 0.86 });
scene.add(sam.group);
sam.group.scale.setScalar(0.98);
const START = { x: 0, z: 17 };
const player = { x: START.x, z: START.z, y: surfaceAt(START.x, START.z), vy: 0, yaw: Math.PI, health: 100, ram: 0, delivered: 0, invulnerable: 0, attackCooldown: 0, grounded: true };
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
  [0, 17], [0, 9], [-7, 4], [-14, -1], [-7, -7],
  [0, -1], [0, -10], [7, -7], [14, -1], [7, 4],
  [-8, -15], [8, -15], [0, -18], [-14, 8], [14, 8], [18, -12],
].forEach(([x, z], i) => spawnRam(x, z, i % 4 === 0 ? 2 : 1));

// Opponents are intentionally generic cast-library people, not real individuals.
const cast = [punk, critic, punk, critic, punk, critic, punk];
const enemySpots = [
  [-7, 4], [-14, -1], [-7, -7], [7, -7], [14, -1], [7, 4], [0, -18],
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
for (const [x, z] of [[-16, -3], [-2, 18], [16, 12], [15, -16], [-16, -16]]) {
  addCylinder(x, 0.58, z, 0.16, 1.16, mats.warning, 12);
  addCylinder(x, 1.18, z, 0.25, 0.12, mats.trim, 12);
}
for (let i = -2; i <= 2; i++) {
  addBox(DATA_CENTER.x + i * 1.1, 0.55, DATA_CENTER.z + 3.54, 0.54, 0.35, 0.08, mats.trim, false);
}

let elapsed = 0;
let swingTime = 0;
stage.target.set(player.x, player.y + 1.2, player.z);
stage.view.zoomBy(1.08);
function updateHud() {
  ui.ram.textContent = String(player.ram).padStart(2, '0');
  ui.delivered.textContent = `${String(player.delivered).padStart(2, '0')} / ${TARGET_RAM}`;
  ui.health.style.width = `${Math.max(0, player.health)}%`;
  ui.health.style.background = player.health < 35 ? '#ff655c' : '#a6ff52';
  ui.objective.textContent = player.delivered >= TARGET_RAM
    ? 'Quarterly target met. Get out.'
    : `Collect RAM. Deliver ${TARGET_RAM - player.delivered} more to the data center.`;
  ui.status.textContent = player.ram > 0
    ? `Carrying ${player.ram} RAM. Return to the glowing delivery pad.`
    : 'The data center is always hungry.';
}
updateHud();

function attack() {
  if (player.attackCooldown > 0 || !started || won) return;
  player.attackCooldown = 0.48;
  swingTime = 0.9;
  tone(210, 0.12, 0.16);
  let hits = 0;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    const dx = enemy.x - player.x, dz = enemy.z - player.z;
    const distance = Math.hypot(dx, dz);
    const dot = distance > 0.001 ? (dx * fx + dz * fz) / distance : 1;
    if (distance < 3.0 && dot > -0.45 && Math.abs(surfaceAt(enemy.x, enemy.z) - player.y) < 2.0) {
      enemy.hp -= 1;
      const pushedX = enemy.x + fx * 0.48;
      const pushedZ = enemy.z + fz * 0.48;
      if (canMoveTo(pushedX, enemy.z, surfaceAt(enemy.x, enemy.z))) enemy.x = pushedX;
      if (canMoveTo(enemy.x, pushedZ, surfaceAt(enemy.x, enemy.z))) enemy.z = pushedZ;
      enemy.stun = 0.5;
      hits++;
      if (enemy.hp <= 0) {
        enemy.active = false;
        enemy.model.group.visible = false;
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
  player.x = START.x;
  player.z = START.z;
  player.y = surfaceAt(START.x, START.z);
  player.vy = 0;
  player.grounded = true;
  player.health = Math.max(55, player.health);
  player.invulnerable = 2.0;
  jumpQueued = false;
  attackQueued = false;
  showToast('EMERGENCY SHUTTLE — BACK TO THE PLAZA');
  updateHud();
}

stage.run((rawDt) => {
  const dt = Math.min(rawDt, 0.05);
  elapsed += dt;
  input.take(); // Drain pointer taps and unused gamepad presses.
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.classList.remove('show');
  }
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
  const speed = sprint ? 10.2 : 7.2;
  if (magnitude > 0.08) {
    const nextX = player.x + mx * speed * dt;
    const nextZ = player.z + mz * speed * dt;
    if (canMoveTo(nextX, player.z, player.y)) player.x = nextX;
    if (canMoveTo(player.x, nextZ, player.y)) player.z = nextZ;
    player.yaw = Math.atan2(mx, mz);
  }
  player.x = Math.max(-22.8, Math.min(22.8, player.x));
  player.z = Math.max(-22.8, Math.min(22.8, player.z));

  const previousY = player.y;
  if (player.grounded && jumpQueued) {
    player.vy = 11.0;
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
  if (player.y < -3) respawnPlayer();

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (attackQueued) attack();
  attackQueued = false;
  if (swingTime > 0) swingTime -= dt;

  sam.group.position.set(player.x, player.y, player.z);
  sam.group.rotation.y = player.yaw;
  sam.group.rotation.z = player.invulnerable > 0 ? Math.sin(elapsed * 28) * 0.08 : 0;
  sam.pose({ clip: swingTime > 0 ? 'attack' : (magnitude > 0.1 ? 'walk' : 'idle'), t: swingTime > 0 ? 0.9 - swingTime : elapsed, time: elapsed });

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
        enemy.model.group.visible = true;
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
      if (distance < 10 && distance > 1.25) {
        vx = dx / distance; vz = dz / distance;
      } else if (distance >= 10) {
        const a = elapsed * 0.45 + enemy.phase;
        const tx = enemy.homeX + Math.cos(a) * 1.45;
        const tz = enemy.homeZ + Math.sin(a) * 1.45;
        const txd = tx - enemy.x, tzd = tz - enemy.z, td = Math.hypot(txd, tzd);
        if (td > 0.1) { vx = txd / td; vz = tzd / td; }
      }
      const eSpeed = distance < 10 ? 2.15 : 1.0;
      const nextX = enemy.x + vx * eSpeed * dt;
      const nextZ = enemy.z + vz * eSpeed * dt;
      const enemyY = surfaceAt(enemy.x, enemy.z);
      if (canMoveTo(nextX, enemy.z, enemyY) && Math.abs(surfaceAt(nextX, enemy.z) - enemyY) < 0.5) enemy.x = nextX;
      if (canMoveTo(enemy.x, nextZ, enemyY) && Math.abs(surfaceAt(enemy.x, nextZ) - enemyY) < 0.5) enemy.z = nextZ;
    }
    enemy.x = Math.max(-22.5, Math.min(22.5, enemy.x));
    enemy.z = Math.max(-22.5, Math.min(22.5, enemy.z));
    enemy.model.group.position.set(enemy.x, surfaceAt(enemy.x, enemy.z), enemy.z);
    if (Math.abs(vx) + Math.abs(vz) > 0.01) enemy.model.group.rotation.y = Math.atan2(vx, vz);
    enemy.model.pose({ clip: 'walk', t: elapsed + enemy.phase, time: elapsed });
    if (distance < 1.28 && enemy.attackTimer <= 0 && enemy.stun <= 0 && player.invulnerable <= 0) {
      enemy.attackTimer = 1.0;
      player.health = Math.max(0, player.health - 8);
      player.invulnerable = 0.72;
      // dx/distance points from the attacker to Sam, so adding it repels him.
      const repelX = player.x + dx / Math.max(0.01, distance) * 0.65;
      const repelZ = player.z + dz / Math.max(0.01, distance) * 0.65;
      if (canMoveTo(repelX, player.z, player.y)) player.x = repelX;
      if (canMoveTo(player.x, repelZ, player.y)) player.z = repelZ;
      showToast('YOU GOT BONKED — WATCH YOUR RAM');
      tone(115, 0.18, 0.18);
      updateHud();
      if (player.health <= 0) respawnPlayer();
    }
  }

  if (player.grounded && Math.hypot(player.x - DATA_CENTER.x, player.z - (DATA_CENTER.z + 5.4)) < 3.0 && player.y < 0.6) deliverRam();

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
