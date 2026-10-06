// Squad Rush: endless wave runner-shooter.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';
import * as models from './models.js';
import { save, persist, fmt } from './save.js';
import { sfx, unlockAudio, musicStart, musicStop, musicIntensity } from './audio.js';
import { WEAPONS } from './weapons.js';
import * as tech from './tech.js';
import * as BOSSES from './bosses.js';
import * as PU from './powerups.js';

const { UnitRenderer, soldierGeos, PALETTES, Environment, BIOMES, buildBarrel, buildGate, drawLabel, drawIcon, gunMesh } = models;
const { NODES, getStats, openTech, closeTech, startWaves, canBuy, buy, nodeCost, nodeUnlocked, lvl, techCount } = tech;

// ------------------------------------------------------------ constants
const SQUAD_Z = 4;
const SPAWN_Z = -112;
const WAVE_LEN = 150;
const BASE_SPEED = 9;
const RENDER_ALLIES = 600;
const MAX_ENEMIES = 600;
const MAX_BULLETS = 900;
const MAX_PARTS = 1600;
const ROAD_HALF = 5.2;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const DIFFS = [
  { id: 'easy', name: 'EASY', hp: 0.6, count: 0.75, speed: 0.85, coins: 0.7, dmg: 0.6, color: '#35d36f' },
  { id: 'medium', name: 'MEDIUM', hp: 1, count: 1, speed: 1, coins: 1, dmg: 1, color: '#ffc531' },
  { id: 'hard', name: 'HARD', hp: 1.7, count: 1.25, speed: 1.1, coins: 1.7, dmg: 1.4, color: '#ff7a1a' },
  { id: 'impossible', name: 'IMPOSSIBLE', hp: 3.2, count: 1.6, speed: 1.25, coins: 3.2, dmg: 2.2, color: '#ff3b4e' },
];
const diffById = (id) => DIFFS.find((d) => d.id === id) || DIFFS[1];

// ------------------------------------------------------------ renderer & scene
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(BIOMES[0].fog, 75, 165);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 800);
const CAM_BASE = new THREE.Vector3(0, 9, 15);
const CAM_LOOK = new THREE.Vector3(0, 0.4, -8);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96b0, 0.7));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
sun.position.set(-10, 26, 14);
sun.target.position.set(0, 0, -14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 50, bottom: -50, near: 1, far: 110 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const env = new Environment(scene);

// bloom post-processing (High quality only); multisampled HDR target keeps edges smooth
const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.35, 1.25);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let useBloom = true;
const glowK = () => (useBloom ? 3 : 1);

const allyR = new UnitRenderer(scene, soldierGeos(PALETTES.ally), RENDER_ALLIES, { armed: 0, key: 'ally' });
const heroR = new UnitRenderer(scene, soldierGeos(PALETTES.hero), 1, { armed: 0, key: 'hero' });
const enemyR = {
  grunt: new UnitRenderer(scene, soldierGeos(PALETTES.grunt), 500),
  runner: new UnitRenderer(scene, soldierGeos(PALETTES.runner), 250),
  armored: new UnitRenderer(scene, soldierGeos(PALETTES.armored), 250),
  giant: new UnitRenderer(scene, soldierGeos(PALETTES.giant), 40, { pose: 'brute' }),
  bomber: new UnitRenderer(scene, soldierGeos(PALETTES.bomber), 150),
};

// bullets: bright core + additive glow
const bulletGeo = new THREE.CapsuleGeometry(0.05, 0.6, 2, 6);
bulletGeo.rotateX(Math.PI / 2);
const bulletCore = new THREE.InstancedMesh(bulletGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_BULLETS);
const bulletGlow = new THREE.InstancedMesh(bulletGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), MAX_BULLETS);
for (const b of [bulletCore, bulletGlow]) {
  b.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BULLETS * 3), 3);
  b.frustumCulled = false;
  b.count = 0;
  scene.add(b);
}
const partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), MAX_PARTS);
partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTS * 3), 3);
partMesh.frustumCulled = false;
partMesh.count = 0;
scene.add(partMesh);
const fxPool = [];
for (let i = 0; i < 30; i++) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ball.visible = ring.visible = false;
  scene.add(ball, ring);
  fxPool.push({ ball, ring, t: 1, life: 1, r: 1 });
}
const zapPool = [];
for (let i = 0; i < 40; i++) {
  const z = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  z.visible = false;
  scene.add(z);
  zapPool.push({ m: z, t: 1 });
}
const SMOKE_MAX = 300;
const smokeMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false }), SMOKE_MAX);
smokeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE_MAX * 3), 3);
smokeMesh.frustumCulled = false;
smokeMesh.count = 0;
scene.add(smokeMesh);
const smoke = [];
const FLASH_MAX = 80;
const flashGeo = (() => {
  const a = new THREE.PlaneGeometry(1, 0.42);
  const b = a.clone().rotateX(Math.PI / 2);
  const c = new THREE.PlaneGeometry(0.42, 0.42).rotateY(Math.PI / 2);
  const g = models.merge([a, b, c].map((x) => { x.deleteAttribute('uv'); return x.toNonIndexed(); }));
  g.translate(0, 0, -0.35);
  g.rotateY(Math.PI / 2);
  return g;
})();
const flashMesh = new THREE.InstancedMesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), FLASH_MAX);
flashMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLASH_MAX * 3), 3);
flashMesh.frustumCulled = false;
flashMesh.count = 0;
scene.add(flashMesh);
const flashes = [];
const muzzle = new THREE.PointLight(0xffc060, 0, 12);
scene.add(muzzle);
const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
shieldBubble.visible = false;
scene.add(shieldBubble);

// ------------------------------------------------------------ state
let S = null;
let mode = 'menu';
let stats = getStats();
const input = { left: false, right: false, dragging: false, lastX: 0 };
let shake = 0;
let hitstop = 0;
let worldObjs = [];
function clearWorld() {
  for (const o of worldObjs) scene.remove(o);
  worldObjs = [];
}
function track(o) { scene.add(o); worldObjs.push(o); return o; }
function untrack(o) { scene.remove(o); const i = worldObjs.indexOf(o); if (i >= 0) worldObjs.splice(i, 1); }
const maxSquad = () => Math.min(RENDER_ALLIES, stats.maxSquad || 320);

function newRun(startWave, demo = false) {
  stats = getStats();
  if (S && !S.demo) { try { PU.clear(G); } catch (e) { console.error(e); } }
  clearWorld();
  smoke.length = 0;
  flashes.length = 0;
  S = {
    wave: startWave, startWave, dist: 0, waveStart: 0, events: [], evIdx: 0, speed: BASE_SPEED,
    squadX: 0, targetX: 0, allies: [], reserve: 0, enemies: [], bullets: [], gates: [], barrels: [], parts: [], grenades: [], bombs: [],
    boss: null, weapon: clamp(stats.startWeapon || 0, 0, WEAPONS.length - 1), runDmg: 1, runRate: 1,
    fireT: 0, heroT: 0, droneT: 0, grenadeT: 4, medicT: 0, strikeCd: 0, nukeCd: 0, shield: stats.shieldHits,
    coins: 0, kills: 0, bosses: 0, peak: 0, secondWindUsed: false, over: false, overT: 0, time: 0, plane: null,
    drones: [], hero: stats.commander > 0, buffs: {}, vehicles: [], diff: diffById(save.difficulty), stats, demo,
    radius: 1, frontZ: SQUAD_Z, combo: 0, comboT: 0, bestCombo: 0,
  };
  let men = stats.startMen;
  if (startWave > 1) {
    men += Math.round(startWave * 2.2 + Math.pow(startWave, 1.35));
    S.weapon = Math.max(S.weapon, Math.min(WEAPONS.length - 4, Math.floor(startWave / 10)));
  }
  addAllies(men);
  allyR.setWeapon(S.weapon);
  heroR.setWeapon(Math.max(S.weapon, 8));
  if (!demo) {
    for (let i = 0; i < stats.drones; i++) {
      const d = models.buildDrone();
      track(d);
      S.drones.push({ g: d, a: (i / Math.max(1, stats.drones)) * Math.PI * 2 });
    }
    try { PU.initRun(G); } catch (e) { console.error(e); }
  }
  setupWave(startWave, true);
}

// ------------------------------------------------------------ difficulty
function enemyHp(w) { return 100 * (1 + 0.45 * (w - 1)) * Math.pow(1.06, w - 1) * (S ? S.diff.hp : 1); }
const TYPES = {
  grunt:   { hp: 1, speed: 3.6, scale: 1.0, bite: 1, coin: 1, r: 0.42 },
  runner:  { hp: 0.55, speed: 7.0, scale: 0.92, bite: 1, coin: 1, r: 0.4 },
  armored: { hp: 3.2, speed: 2.8, scale: 1.15, bite: 2, coin: 3, r: 0.5 },
  giant:   { hp: 22, speed: 2.1, scale: 2.4, bite: 7, coin: 15, r: 0.5 },
  bomber:  { hp: 0.8, speed: 5.4, scale: 1.0, bite: 1, coin: 2, r: 0.42 },
};

function genWave(w) {
  const ev = [];
  const boss = w % 5 === 0;
  const grp = (mult) => {
    let count = Math.round((5 + w * 1.7) * mult * S.diff.count * rand(0.85, 1.15));
    let hpMult = 1;
    if (count > 60) { hpMult = count / 60; count = 60; }
    const mix = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let t = 'grunt';
      if (w >= 4 && r < 0.06 + Math.min(0.06, w * 0.002)) t = 'bomber';
      else if (w >= 3 && r < 0.18 + Math.min(0.18, w * 0.006)) t = 'runner';
      else if (w >= 6 && r < 0.38 + Math.min(0.18, w * 0.005)) t = 'armored';
      mix.push(t);
    }
    const giants = (w >= 8 && Math.random() < 0.35 + w * 0.01 ? 1 : 0) + (w >= 20 && Math.random() < 0.5 ? 1 : 0) + (w >= 60 ? 1 : 0) + (w >= 120 ? 1 : 0);
    for (let i = 0; i < giants; i++) mix.push('giant');
    return { type: 'enemies', mix, hpMult, shape: pick(['block', 'block', 'wedge', 'lanes', 'blob']) };
  };
  ev.push({ d: 6, ...gatePair(w) });
  ev.push({ d: 16, type: 'pickup' });
  ev.push({ d: 26, ...grp(0.8) });
  ev.push({ d: 36, type: 'recruits' });
  ev.push({ d: 46, type: 'barrels', n: w >= 6 && Math.random() < 0.4 ? 2 : 1 });
  ev.push({ d: 54, type: 'pickup' });
  ev.push({ d: 62, ...grp(1.0) });
  ev.push({ d: 72, type: Math.random() < 0.5 ? 'recruits' : 'pickup' });
  ev.push({ d: 80, ...gatePair(w) });
  ev.push({ d: 90, type: 'pickup' });
  ev.push({ d: 98, ...grp(1.1) });
  ev.push({ d: 108, type: 'pickup' });
  ev.push({ d: 116, ...(Math.random() < 0.5 ? { type: 'barrels', n: 1 } : gatePair(w)) });
  ev.push({ d: 124, type: 'recruits' });
  ev.push({ d: 132, ...grp(boss ? 0.9 : 1.35) });
  if (boss) ev.push({ d: 146, type: 'boss' });
  return ev;
}
function gatePair(w) {
  const plus = () => ({ op: '+', v: Math.round(3 + w * 0.8 + rand(0, 3)) + stats.gatePlus });
  const mult = () => ({ op: 'x', v: w > 10 && Math.random() < 0.15 ? 4 : Math.random() < 0.65 ? 2 : 3 });
  const minus = () => ({ op: '-', v: Math.round((3 + w * 1.1 + rand(0, 4)) * S.diff.dmg) });
  const div = () => ({ op: '÷', v: Math.random() < 0.7 ? 2 : 3 });
  const special = () => pick(S.weapon < WEAPONS.length - 1 ? [{ op: 'dmg', v: 15 }, { op: 'rate', v: 12 }, { op: 'gun', v: 1 }] : [{ op: 'dmg', v: 15 }, { op: 'rate', v: 12 }]);
  const good = () => (w >= 2 && Math.random() < 0.16 ? special() : Math.random() < 0.6 ? plus() : mult());
  const bad = () => (Math.random() < 0.65 ? minus() : div());
  const r = Math.random();
  const g2 = 0.3 / S.diff.dmg;
  let pair = r < g2 ? [good(), good()] : r < 0.85 ? [good(), bad()] : [bad(), bad()];
  if (Math.random() < 0.5) pair.reverse();
  if (Math.random() < stats.goldenGate) {
    const i = irand(0, 1);
    pair[i] = Math.random() < 0.5 ? { op: '+', v: plus().v * 5, golden: true } : { op: 'x', v: 5, golden: true };
  }
  return { type: 'gates', pair };
}
function setupWave(w, first = false) {
  S.wave = w;
  S.waveStart = S.dist;
  S.events = S.demo ? [] : genWave(w);
  S.evIdx = 0;
  S.shield = stats.shieldHits;
  env.setBiome(Math.floor((w - 1) / 10), first);
  if (S.demo) return;
  musicIntensity(w >= 30 ? 1 : 0);
  const boss = w % 5 === 0;
  banner(`WAVE ${w}`, boss ? (w % 50 === 0 ? '☠ MEGA BOSS INCOMING ☠' : 'BOSS INCOMING!') : BIOMES[env.biome].name.toUpperCase(), boss);
}

// ------------------------------------------------------------ allies
function squadShape(n) {
  const c0 = 0.53 * stats.spacing * (S.buffs.giant > 0 ? 1.3 : 1);
  const c = Math.min(c0, 4.4 / Math.sqrt(Math.max(1, n)));
  return { c, r: Math.min(4.4, c * Math.sqrt(n)) };
}
function totalMen() { return S.allies.length + S.reserve; }
const menCap = () => Math.round(maxSquad() * (1 + (stats.reserveMult || 0)));
function addAllies(n, at = null) {
  n = Math.min(Math.floor(n), menCap() - totalMen());
  for (let i = 0; i < n; i++) {
    if (S.allies.length < maxSquad()) {
      const x = at ? at.x + rand(-0.8, 0.8) : S.squadX + rand(-1, 1);
      const z = at ? at.z + rand(-0.8, 0.8) : SQUAD_Z + rand(-0.5, 0.5);
      S.allies.push({ x, z, phase: Math.random() * 6.28, flash: 0.8 });
    } else S.reserve++;
  }
  S.peak = Math.max(S.peak, totalMen());
  bumpBubble();
}
function killAllyAt(idx) {
  const a = S.allies[idx];
  if (!a) return false;
  burst(a.x, 0.6, a.z, 0x2f8bff, 6, 4);
  burst(a.x, 0.6, a.z, 0xf0dfbd, 3, 3);
  if (S.reserve > 0) { S.reserve--; a.flash = 1; a.z += 1.5; }
  else S.allies.splice(idx, 1);
  sfx('lose');
  return true;
}
// remove n soldiers; optionally the ones nearest to a point
function hurtSquad(n, opts = {}) {
  n = Math.floor(n);
  if (n <= 0 || !S || !S.allies.length) return 0;
  if (S.buffs.shield > 0) { burst(S.squadX, 1, SQUAD_Z, 0x7fe8ff, 8, 5); return 0; }
  let killed = 0;
  if (opts.x !== undefined) {
    const R = opts.radius || 99;
    const cand = S.allies.map((a, i) => [Math.hypot(a.x - opts.x, a.z - (opts.z ?? SQUAD_Z)), i]).filter((d) => d[0] < R).sort((a, b) => a[0] - b[0]);
    const idxs = cand.slice(0, n).map((d) => d[1]).sort((a, b) => b - a);
    for (const i of idxs) { if (killAllyAt(i)) killed++; }
  } else {
    for (let i = 0; i < n; i++) {
      if (S.reserve > 0) { S.reserve--; killed++; continue; }
      if (!S.allies.length) break;
      const idx = Math.floor(Math.random() * S.allies.length);
      const a = S.allies[idx];
      if (killed < 40) burst(a.x, 0.6, a.z, 0x2f8bff, 5, 4);
      S.allies.splice(idx, 1);
      killed++;
    }
  }
  bumpBubble();
  return killed;
}
function nearestAlly(x, z) {
  let best = -1, bd = 1e9;
  const al = S.allies;
  for (let i = 0; i < al.length; i++) {
    const dx = al[i].x - x, dz = al[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: Math.sqrt(bd) };
}
function updateAllies(dt) {
  const n = S.allies.length;
  const { c, r } = squadShape(n);
  S.radius = r;
  const kb = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (kb) S.targetX += kb * 13 * dt;
  const lim = Math.max(0, ROAD_HALF - r * 0.85 - 0.3);
  S.targetX = clamp(S.targetX, -lim, lim);
  S.squadX += clamp(S.targetX - S.squadX, -16 * dt, 16 * dt);
  S.frontZ = SQUAD_Z - r * 0.8;
  for (let i = 0; i < n; i++) {
    const a = S.allies[i];
    const rr = c * Math.sqrt(i + 0.5);
    const th = i * 2.39996;
    const k = Math.min(1, dt * 9);
    a.x += (S.squadX + Math.cos(th) * rr - a.x) * k;
    a.z += (SQUAD_Z + Math.sin(th) * rr * 0.8 - a.z) * k;
    a.phase += dt * 11;
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 3);
  }
  if (stats.medicInterval && n > 0) {
    S.medicT += dt;
    if (S.medicT >= stats.medicInterval) {
      S.medicT = 0;
      addAllies(1);
      floater(S.squadX, 2, SQUAD_Z, '+1 ⛑️', '#9effc2', 22);
    }
  }
}

// ------------------------------------------------------------ spawning
function spawnEvent(e) {
  try {
    if (e.type === 'enemies') spawnGroup(e);
    else if (e.type === 'gates') spawnGates(e.pair);
    else if (e.type === 'barrels') { if (e.n === 2) { spawnBarrel(-2.6); spawnBarrel(2.6); } else spawnBarrel(pick([-2.6, 0, 2.6])); }
    else if (e.type === 'pickup') {
      const n = 1 + (Math.random() < (stats.pickupRate || 1) - 1 ? 1 : 0);
      const xs = n === 2 ? [-2.8, 2.8] : [pick([-3, -1.5, 0, 1.5, 3])];
      for (const x of xs) PU.spawnPickup(G, x);
    } else if (e.type === 'recruits') {
      const cnt = Math.max(2, Math.round((3 + S.wave * 0.9) * (stats.rescue || 1) * rand(0.8, 1.2)));
      PU.spawnRecruits(G, pick([-3, -1.5, 0, 1.5, 3]), cnt);
    } else if (e.type === 'boss') spawnBoss();
  } catch (err) { console.error('event', e.type, err); }
}
function spawnEnemy(t, x, z, hpMult = 1) {
  const T = TYPES[t] || TYPES.grunt;
  if (S.enemies.length >= MAX_ENEMIES) return null;
  const hp = enemyHp(S.wave) * T.hp * hpMult;
  const e = { type: t in TYPES ? t : 'grunt', x: clamp(x, -ROAD_HALF + 0.4, ROAD_HALF - 0.4), z, ox: x - S.squadX, hp, maxHp: hp, speed: T.speed * rand(0.9, 1.1) * S.diff.speed, s: T.scale, bite: T.bite, coin: T.coin, phase: Math.random() * 6.28, flash: 0, r: T.r * T.scale };
  S.enemies.push(e);
  return e;
}
function spawnGroup(e) {
  const cols = Math.min(9, Math.max(3, Math.ceil(Math.sqrt(e.mix.length) * 1.3)));
  const width = cols * 0.95;
  const cx = clamp(rand(-2.5, 2.5), -ROAD_HALF + width / 2, ROAD_HALF - width / 2);
  e.mix.sort((a, b) => (a === 'giant') - (b === 'giant'));
  e.mix.forEach((t, i) => {
    let x, z;
    const row = Math.floor(i / cols), col = i % cols;
    if (t === 'giant') { x = cx + rand(-1.5, 1.5); z = SPAWN_Z - Math.ceil(e.mix.length / cols) * 1.1 - 2 - rand(0, 3); }
    else if (e.shape === 'wedge') { x = cx + (col - (cols - 1) / 2) * 0.95; z = SPAWN_Z - row * 1.1 - Math.abs(col - (cols - 1) / 2) * 0.7; }
    else if (e.shape === 'lanes') { const lane = i % 3; x = (lane - 1) * 3.3 + rand(-0.6, 0.6); z = SPAWN_Z - Math.floor(i / 3) * 1.2; }
    else if (e.shape === 'blob') { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * Math.sqrt(e.mix.length) * 0.55; x = cx + Math.cos(a) * r; z = SPAWN_Z + Math.sin(a) * r * 1.4; }
    else { x = cx + (col - (cols - 1) / 2) * 0.95 + rand(-0.12, 0.12); z = SPAWN_Z - row * 1.1; }
    const en = spawnEnemy(t, x, z, e.hpMult);
    if (en) en.ox = x - cx;
  });
}
function spawnGates(pair) {
  const width = ROAD_HALF;
  const made = pair.map((g, i) => {
    const mesh = buildGate(width - 0.1);
    const x = (i === 0 ? -1 : 1) * width / 2;
    mesh.position.set(x, 0, SPAWN_Z);
    track(mesh);
    const gate = { ...g, x, x0: x - width / 2, x1: x + width / 2, z: SPAWN_Z, mesh, hits: 0, pop: 0, used: false };
    S.gates.push(gate);
    styleGate(gate);
    return gate;
  });
  made[0].twin = made[1]; made[1].twin = made[0];
}
const SPECIAL_GATE = { dmg: (v) => `+${v}% DMG`, rate: (v) => `+${v}% RATE`, gun: () => 'WEAPON UP' };
const gateGood = (g) => g.op === '+' || g.op === 'x' || !!SPECIAL_GATE[g.op];
function styleGate(g) {
  const u = g.mesh.userData;
  const good = gateGood(g);
  const sp = SPECIAL_GATE[g.op];
  u.panelMat.color.setHex(g.golden ? 0xffc531 : sp ? 0xa46bff : good ? 0x3aa0ff : 0xff3b4e);
  u.frameMat.color.setHex(g.golden ? 0xffd34a : sp ? 0x8a4fff : good ? 0x2f7cf0 : 0xd62839);
  u.lightMat.color.setHex(g.golden ? 0xfff1b0 : sp ? 0xe6d6ff : good ? 0xbfe6ff : 0xffc0c8);
  const txt = sp ? sp(g.v) : (g.op === 'x' ? '×' : g.op) + fmt(g.v);
  drawLabel(u.label, txt, { fill: '#ffffff', stroke: g.golden ? '#8a5200' : sp ? '#3a1a7a' : good ? '#0d3c8f' : '#7a0f1c' });
}
function spawnBarrel(x) {
  const g = buildBarrel();
  g.position.set(x, 0, SPAWN_Z);
  track(g);
  const hp = enemyHp(S.wave) * (7 + S.wave * 0.25);
  let reward;
  try { reward = PU.barrelReward(G); } catch (e) { console.error(e); reward = { icon: '🧍', text: '+5', color: '#2f8bff', apply: (G) => G.addAllies(5) }; }
  if (reward.weaponIndex !== undefined && reward.weaponIndex >= 0) {
    const gun = gunMesh(reward.weaponIndex, 2.6);
    gun.rotation.y = Math.PI / 2;
    gun.position.y = 3.1;
    g.add(gun);
    g.userData.gun = gun;
    drawIcon(g.userData.icon, '', reward.text, reward.color);
    g.userData.iconMesh.position.y = 2.4;
  } else drawIcon(g.userData.icon, reward.icon, reward.text, reward.color);
  S.barrels.push({ x, z: SPAWN_Z, hp, maxHp: hp, g, reward, flash: 0 });
  drawLabel(g.userData.label, fmt(hp / 10));
}
function spawnBoss() {
  try {
    S.boss = BOSSES.createBoss(G, S.wave);
  } catch (e) { console.error('boss', e); S.boss = null; return; }
  const B = S.boss;
  B.dead = false;
  document.getElementById('boss-name').textContent = B.name;
  document.getElementById('boss-bar').classList.remove('hidden');
  sfx('boss');
  musicIntensity(2);
  banner(B.name, B.title || 'BOSS FIGHT', true);
}

// ------------------------------------------------------------ combat
function curWeapon() { return WEAPONS[S.weapon]; }
function setWeapon(i) {
  i = clamp(i, 0, WEAPONS.length - 1);
  const up = i > S.weapon;
  S.weapon = i;
  allyR.setWeapon(i);
  banner(WEAPONS[i].name, up ? 'WEAPON UPGRADE!' : 'NEW WEAPON');
  sfx('powerup');
}
function perSoldierDmg() {
  let d = stats.dmg * curWeapon().dmg * stats.veteran * S.runDmg;
  if (totalMen() <= 10 && stats.lastStand) d *= 1 + stats.lastStand;
  if (S.buffs.power > 0) d *= 2;
  if (S.buffs.giant > 0) d *= 1.5;
  return d;
}
function fireRate() { return curWeapon().rate * stats.rateMult * S.runRate * (S.buffs.rage > 0 ? 2 : 1); }
function squadDps() { return perSoldierDmg() * fireRate() * (curWeapon().pellets || 1) * Math.max(1, totalMen()); }

const targets = [];
function gatherTargets() {
  targets.length = 0;
  const range = SQUAD_Z - 70 * stats.rangeMult;
  for (const e of S.enemies) if (!e.dead && e.z > range && e.z < SQUAD_Z + 1) targets.push(e);
  targets.sort((a, b) => b.z - a.z);
  if (targets.length > 14) targets.length = 14;
  if (S.boss && !S.boss.dead && S.boss.z > range - 10) targets.unshift(S.boss);
  for (const b of S.barrels) if (!b.dead && b.z > range && Math.abs(b.x - S.squadX) < 3.5 && targets.length < 6) targets.push(b);
  return targets;
}

function fire(dt) {
  if (!S.allies.length) return;
  const n = totalMen();
  const W = curWeapon();
  const rate = fireRate();
  S.fireT += dt;
  const interval = 1 / rate;
  if (S.fireT < interval) return;
  S.fireT -= interval;
  if (S.fireT > interval) S.fireT = 0;
  gatherTargets();
  const pellets = W.pellets || 1;
  const k = Math.min(S.allies.length, Math.max(1, Math.floor(240 / (rate * pellets))));
  const dmgEach = (perSoldierDmg() * n) / k;
  const speed = W.speed * stats.rangeMult;
  const range = 72 * stats.rangeMult;
  for (let i = 0; i < k; i++) {
    const a = S.allies[Math.floor(Math.pow(Math.random(), 1.6) * S.allies.length)];
    let tx = a.x + rand(-0.3, 0.3), tz = a.z - 40;
    if (targets.length) {
      const tgt = targets[Math.floor(Math.pow(Math.random(), 1.5) * Math.min(targets.length, 5))];
      tx = tgt.x + rand(-0.25, 0.25);
      const tt = Math.abs(a.z - tgt.z) / speed;
      tz = tgt === S.boss ? tgt.z : tgt.z + (S.speed + (tgt.speed || 0)) * tt * 0.6;
    }
    const sx = a.x + 0.09, sz = a.z - 0.75;
    const dx = tx - sx, dz = tz - sz;
    const len = Math.hypot(dx, dz) || 1;
    if (flashes.length < FLASH_MAX && i < 40) flashes.push({ x: a.x + 0.095, y: 0.74, z: a.z - 0.86, yaw: Math.atan2(dx, dz) + Math.PI, roll: rand(0, 3), s: (W.rocket || W.arc ? 0.7 : W.pellets ? 0.55 : 0.36) * rand(0.8, 1.2), t: 0.05, c: W.color });
    const crit = Math.random() < stats.crit;
    const bd = dmgEach * (crit ? stats.critMult : 1);
    if (W.arc) {
      const dist = Math.min(len, range * 0.75);
      spawnBullet(sx, sz, (dx / len) * speed, (dz / len) * speed, bd, { life: dist / speed, arc: true, crit });
      continue;
    }
    for (let p = 0; p < pellets; p++) {
      const ang = pellets > 1 ? (p / (pellets - 1) - 0.5) * W.spread * 2 + rand(-0.04, 0.04) : rand(-0.015, 0.015);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const vx = ((dx / len) * ca - (dz / len) * sa) * speed, vz = ((dx / len) * sa + (dz / len) * ca) * speed;
      spawnBullet(sx, sz, vx, vz, bd, { life: (pellets > 1 ? 0.55 : 1) * range / speed, crit });
    }
    if (Math.random() < stats.multishot) spawnBullet(sx, sz, (dx / len) * speed + rand(-3, 3), (dz / len) * speed, bd, { life: range / speed, crit });
  }
  muzzle.intensity = 8;
  muzzle.color.setHex(W.color);
  muzzle.position.set(S.squadX, 1.5, S.frontZ - 1);
  if (W.rocket || W.arc) sfx('rocket'); else if (W.beam || W.chain) sfx('laser'); else sfx('shoot');
}
function spawnBullet(x, z, vx, vz, dmg, o = {}) {
  if (S.bullets.length >= MAX_BULLETS) return;
  const W = curWeapon();
  const custom = o.color !== undefined;
  S.bullets.push({
    x, y: o.y ?? 0.72, z, vx, vz, dmg, life: o.life ?? 1.4, max: o.life ?? 1.4,
    color: o.crit ? 0xff3355 : custom ? o.color : W.color,
    size: (o.size ?? W.size) * (o.crit ? 1.3 : 1),
    pierce: o.pierce ?? (custom ? 0 : (W.pierce || 0) + stats.pierce),
    splash: o.splash ?? (custom ? 0 : W.splash || 0),
    chain: custom ? 0 : W.chain || 0, beam: !custom && W.beam, rocket: !custom && W.rocket,
    arc: o.arc || false, crit: o.crit, hit: null, sy: o.y ?? 0.72,
  });
}

// spatial buckets for enemies
const BUCKET = 2, BZ0 = -150, NB = 100;
const buckets = Array.from({ length: NB }, () => []);
function rebuildBuckets() {
  for (const b of buckets) b.length = 0;
  for (const e of S.enemies) {
    const i = Math.floor((e.z - BZ0) / BUCKET);
    if (i >= 0 && i < NB) buckets[i].push(e);
  }
}
function segDist2(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const l2 = vx * vx + vz * vz || 1e-6;
  const t = clamp((wx * vx + wz * vz) / l2, 0, 1);
  const dx = ax + vx * t - px, dz = az + vz * t - pz;
  return dx * dx + dz * dz;
}
function damageEnemy(e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 1;
  if (e.hp <= 0) { e.dead = true; killEnemy(e); }
}
const COMBO_MS = [[25, 'KILLING SPREE!'], [50, 'RAMPAGE!'], [100, 'UNSTOPPABLE!'], [200, 'GODLIKE!'], [400, 'LEGENDARY!'], [800, 'WAR MACHINE!'], [1500, 'APOCALYPSE!']];
function addCombo() {
  S.combo++;
  S.comboT = 2.5;
  if (S.combo > S.bestCombo) S.bestCombo = S.combo;
  const m = COMBO_MS.find(([n]) => n === S.combo);
  if (m) {
    const c = Math.round(S.combo * (1 + S.wave / 5));
    earn(c);
    shout(m[1], `${S.combo} KILLS · +${fmt(earnValue(c))} COINS`);
    sfx('powerup');
  }
}
function bomberBlast(e) {
  const r = 2.8;
  explosion(e.x, 0.8, e.z, r, 0xff5a2a);
  sfx('explode');
  shake = Math.max(shake, 0.35);
  areaDamage(e.x, e.z, r, enemyHp(S.wave) * 3 + perSoldierDmg() * 4, { noFx: true, bossMult: 0.2 });
  if (e.z > S.frontZ - r - 1 && S.allies.length) {
    const k = hurtSquad(Math.round((2 + S.wave * 0.06) * S.diff.dmg), { x: e.x, z: e.z, radius: r });
    if (k) floater(e.x, 2, e.z, `-${k}`, '#ff6b7a', 32);
  }
}
function killEnemy(e) {
  S.kills++;
  save.kills++;
  addCombo();
  if (e.type === 'bomber') bomberBlast(e);
  const col = e.type === 'armored' ? 0x3b3f4a : e.type === 'runner' ? 0xff9a1f : 0xe8343f;
  burst(e.x, 0.6 * e.s, e.z, col, e.type === 'giant' ? 24 : 6, 5 * Math.sqrt(e.s));
  burst(e.x, 0.6 * e.s, e.z, 0xf3e6d6, e.type === 'giant' ? 12 : 3, 4);
  let c = e.coin + Math.floor(S.wave / 5) + stats.bounty;
  if (Math.random() < stats.jackpot) { c *= 25; floater(e.x, 1.5, e.z, `JACKPOT +${fmt(earnValue(c))}`, '#ffe066', 30); sfx('powerup'); }
  else if (e.type === 'giant') floater(e.x, 2.5, e.z, `+${fmt(earnValue(c))}`, '#ffe066', 26);
  earn(c);
  sfx('die');
}
const earnValue = (c) => c * stats.coinMult * S.diff.coins * (S.buffs.coins > 0 ? 2 : 1);
function earn(c) { if (!S.demo) S.coins += earnValue(c); }
function damageBoss(dmg, mult = 1) {
  const B = S.boss;
  if (!B || B.dead || B.invulnerable) return;
  const d = dmg * stats.bossMult * mult * (1 - (B.armor || 0));
  B.hp -= d;
  B.flash = 1;
  B.dmgAcc = (B.dmgAcc || 0) + d;
  if (B.hp <= 0) killBoss();
}
function killBoss() {
  const B = S.boss;
  B.dead = true;
  S.bosses++;
  const mega = S.wave % 50 === 0;
  const c = Math.round((150 + S.wave * 45) * stats.bossLoot * (mega ? 4 : 1));
  earn(c);
  const bx = B.x, bz = B.z;
  for (let i = 0; i < 8; i++) setTimeout(() => S && explosion(bx + rand(-2.5, 2.5), rand(0.5, 4), bz + rand(-2, 2), 3, pick([0xffa030, 0xff5a2a, 0xffe066])), i * 110);
  burst(bx, 2, bz, 0xffc531, 70, 13);
  floater(bx, 5, bz, `BOSS DOWN! +${fmt(earnValue(c))}`, '#ffe066', 42);
  shake = 1.4;
  hitstop = 0.15;
  try { B.destroy(G); } catch (e) { console.error(e); }
  S.boss = null;
  document.getElementById('boss-bar').classList.add('hidden');
  const men = Math.round(8 + S.wave * 0.6);
  addAllies(men);
  floater(S.squadX, 2.5, SQUAD_Z, `+${men} 🧍`, '#7fd0ff', 28);
  if (S.weapon < WEAPONS.length - 1 && Math.random() < 0.5) setWeapon(S.weapon + 1);
  musicIntensity(S.wave >= 30 ? 1 : 0);
  sfx('explode');
}
function explosion(x, y, z, r, color = 0xffa030) {
  const fx = fxPool.find((f) => f.t >= f.life) || fxPool[0];
  fx.t = 0; fx.life = 0.5; fx.r = r;
  fx.ball.material.color.setHex(color).multiplyScalar(glowK());
  fx.ball.visible = fx.ring.visible = true;
  fx.ball.position.set(x, y, z);
  fx.ring.position.set(x, 0.08, z);
  burst(x, y, z, 0xffd27a, 10, 7);
  burst(x, y, z, 0xff8a2a, 6, 10, 0.35);
  puff(x, y, z, r, Math.min(6, 2 + Math.round(r)));
}
function puff(x, y, z, r, n) {
  for (let i = 0; i < n; i++) {
    if (smoke.length >= SMOKE_MAX) smoke.shift();
    const life = rand(0.35, 0.65);
    smoke.push({ x: x + rand(-r, r) * 0.4, y: Math.max(0.4, y + rand(0, r * 0.3)), z: z + rand(-r, r) * 0.4, vx: rand(-1, 1), vy: rand(2.5, 4.5), vz: rand(-1, 1), s: Math.min(0.9, r * rand(0.12, 0.22)), life, max: life, grey: rand(0.6, 0.85) });
  }
}
const _fire = new THREE.Color(0xffa040), _smk = new THREE.Color();
function updateSmoke(dt) {
  let n = 0;
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.life -= dt;
    if (p.life <= 0) { smoke[i] = smoke[smoke.length - 1]; smoke.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + (S ? S.speed : 0)) * dt;
    p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.97;
  }
  for (const p of smoke) {
    const k = 1 - p.life / p.max;
    const sc = p.s * (0.7 + k * 1.3) * Math.min(1, (p.life / p.max) / 0.35) * Math.min(1, k / 0.08 + 0.2);
    _quat.identity();
    _sv.set(sc, sc, sc); _pv.set(p.x, p.y, p.z);
    _mat.compose(_pv, _quat, _sv);
    smokeMesh.setMatrixAt(n, _mat);
    _smk.setRGB(p.grey, p.grey, p.grey * 1.05);
    if (k < 0.3) _smk.lerp(_fire, 1 - k / 0.3);
    smokeMesh.setColorAt(n, _smk);
    n++;
  }
  smokeMesh.count = n;
  smokeMesh.instanceMatrix.needsUpdate = true;
  if (smokeMesh.instanceColor) smokeMesh.instanceColor.needsUpdate = true;
}
function updateFlashes(dt) {
  let n = 0;
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.t -= dt;
    if (f.t <= 0) { flashes[i] = flashes[flashes.length - 1]; flashes.pop(); continue; }
  }
  for (const f of flashes) {
    _eu.set(0, f.yaw, f.roll);
    _quat.setFromEuler(_eu);
    const sc = f.s * (0.6 + f.t / 0.06 * 0.6);
    _sv.set(sc, sc, sc); _pv.set(f.x, f.y, f.z);
    _mat.compose(_pv, _quat, _sv);
    flashMesh.setMatrixAt(n, _mat);
    _col.setHex(f.c).multiplyScalar(glowK() * 0.55);
    flashMesh.setColorAt(n, _col);
    n++;
  }
  flashMesh.count = n;
  flashMesh.instanceMatrix.needsUpdate = true;
  if (flashMesh.instanceColor) flashMesh.instanceColor.needsUpdate = true;
}
function areaDamage(x, z, r, dmg, o = {}) {
  if (!o.noFx) explosion(x, 0.8, z, r, o.color ?? 0xffa030);
  const r2 = r * r;
  const i0 = Math.floor((z - r - BZ0) / BUCKET), i1 = Math.floor((z + r - BZ0) / BUCKET);
  for (let i = Math.max(0, i0); i <= Math.min(NB - 1, i1); i++) {
    for (const e of buckets[i]) {
      if (e.dead) continue;
      const dx = e.x - x, dz = e.z - z;
      if (dx * dx + dz * dz < r2 + e.r * e.r) damageEnemy(e, dmg);
    }
  }
  for (const b of S.barrels) if (!b.dead && Math.hypot(b.x - x, b.z - z) < r + 1) damageBarrel(b, dmg);
  if (S.boss && !S.boss.dead && Math.hypot(S.boss.x - x, S.boss.z - z) < r + S.boss.radius) damageBoss(dmg, o.bossMult ?? 1);
}
function zap(x1, z1, x2, z2) {
  const Z = zapPool.find((p) => p.t >= 1) || zapPool[0];
  const len = Math.hypot(x2 - x1, z2 - z1);
  Z.m.position.set((x1 + x2) / 2, 0.9, (z1 + z2) / 2);
  Z.m.scale.set(1 + Math.random(), 1, len);
  Z.m.rotation.set(0, Math.atan2(x2 - x1, z2 - z1), rand(-0.5, 0.5));
  Z.m.visible = true;
  Z.m.material.color.setHex(0x9fe4ff).multiplyScalar(glowK());
  Z.t = 0;
}
function chainFrom(e, dmg, n) {
  let from = e;
  const hit = new Set([e]);
  for (let k = 0; k < n; k++) {
    let best = null, bd = 16;
    const i0 = Math.max(0, Math.floor((from.z - 4 - BZ0) / BUCKET)), i1 = Math.min(NB - 1, Math.floor((from.z + 4 - BZ0) / BUCKET));
    for (let i = i0; i <= i1; i++) for (const o of buckets[i]) {
      if (o.dead || hit.has(o)) continue;
      const d = (o.x - from.x) ** 2 + (o.z - from.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) break;
    zap(from.x, from.z, best.x, best.z);
    hit.add(best);
    damageEnemy(best, dmg * 0.6);
    from = best;
  }
}
function damageBarrel(b, dmg) {
  if (b.dead) return;
  b.hp -= dmg;
  b.flash = 1;
  if (b.hp <= 0) breakBarrel(b, true);
}
function breakBarrel(b, reward) {
  b.dead = true;
  untrack(b.g);
  burst(b.x, 1, b.z, 0xc98546, 26, 8);
  burst(b.x, 1, b.z, 0x8a93a3, 8, 6);
  sfx('barrel');
  shake = Math.max(shake, 0.3);
  if (!reward) return;
  try { b.reward.apply(G, b.x, b.z); } catch (e) { console.error(e); }
  floater(b.x, 3, b.z, b.reward.text, b.reward.color || '#ffffff', 30);
}
function bulletDone(b) {
  if (b.splash) { areaDamage(b.x, b.z, b.splash, b.dmg * 0.7, { color: b.color }); if (b.rocket || b.arc) sfx('explode'); }
}
function updateBullets(dt) {
  rebuildBuckets();
  const bl = S.bullets;
  for (let j = bl.length - 1; j >= 0; j--) {
    const b = bl[j];
    const ox = b.x, oz = b.z;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    if (b.arc) {
      b.y = b.sy + Math.sin((1 - b.life / b.max) * Math.PI) * 3.5;
      if (b.life <= 0) { areaDamage(b.x, b.z, b.splash || 2.4, b.dmg, { color: 0xb6e05a }); sfx('explode'); shake = Math.max(shake, 0.15); bl[j] = bl[bl.length - 1]; bl.pop(); }
      continue;
    }
    if (b.rocket && Math.random() < 0.6) burst(b.x, b.y, b.z + 0.4, 0xcccccc, 1, 0.6, 0.35);
    let dead = b.life <= 0 || b.x < -7 || b.x > 7;
    if (!dead) for (const g of S.gates) {
      if (g.used) continue;
      if (oz > g.z && b.z <= g.z && b.x > g.x0 && b.x < g.x1) { chargeGate(g); dead = true; break; }
    }
    if (!dead) for (const br of S.barrels) {
      if (br.dead) continue;
      if (segDist2(br.x, br.z, ox, oz, b.x, b.z) < 1.05 * 1.05) { damageBarrel(br, b.dmg); bulletDone(b); dead = true; break; }
    }
    if (!dead && S.boss && !S.boss.dead) {
      const B = S.boss;
      if (segDist2(B.x, B.z, ox, oz, b.x, b.z) < B.radius * B.radius) { damageBoss(b.dmg); bulletDone(b); dead = true; }
    }
    if (!dead) {
      const zmin = Math.min(oz, b.z), zmax = Math.max(oz, b.z);
      const i0 = Math.max(0, Math.floor((zmin - 2.5 - BZ0) / BUCKET)), i1 = Math.min(NB - 1, Math.floor((zmax + 2.5 - BZ0) / BUCKET));
      outer: for (let i = i0; i <= i1; i++) {
        for (const e of buckets[i]) {
          if (e.dead || e === b.hit) continue;
          if (segDist2(e.x, e.z, ox, oz, b.x, b.z) < e.r * e.r) {
            const deal = Math.min(b.dmg, e.hp);
            damageEnemy(e, b.dmg);
            sfx('hit');
            if (b.chain) chainFrom(e, b.dmg, b.chain);
            if (b.splash) { bulletDone(b); dead = true; break outer; }
            b.hit = e;
            if (b.pierce > 0) { b.pierce--; continue; }
            b.dmg -= deal;
            if (b.dmg <= 1) { dead = true; break outer; }
          }
        }
      }
    }
    if (dead) {
      if (b.life > 0) burst(b.x, b.y, b.z, b.color, 2, 3, 0.2);
      else if (b.splash) bulletDone(b);
      bl[j] = bl[bl.length - 1];
      bl.pop();
    }
  }
}
function chargeGate(g) {
  if (g.op !== '+' && g.op !== '-') return;
  g.hits++;
  const bps = fireRate() * Math.min(totalMen(), 240 / fireRate());
  const need = Math.max(3, bps / 5) / stats.gateShoot;
  if (g.hits >= need) {
    g.hits = 0;
    if (g.op === '+') g.v += Math.max(1, Math.round(S.wave / 12));
    else { g.v -= Math.max(1, Math.round(S.wave / 12)); if (g.v <= 0) { g.op = '+'; g.v = 1; } }
    g.pop = 1;
    styleGate(g);
  }
}
function passGate(g) {
  g.used = true;
  if (g.twin) g.twin.used = true;
  if (SPECIAL_GATE[g.op]) {
    if (g.op === 'dmg') { S.runDmg *= 1 + g.v / 100; floater(S.squadX, 2.6, SQUAD_Z - 1, `+${g.v}% DAMAGE`, '#ff9aa4', 38); }
    if (g.op === 'rate') { S.runRate *= 1 + g.v / 100; floater(S.squadX, 2.6, SQUAD_Z - 1, `+${g.v}% FIRE RATE`, '#ffe066', 38); }
    if (g.op === 'gun') setWeapon(S.weapon + 1);
    sfx('gateGood');
    burst(S.squadX, 1.5, SQUAD_Z - 1, 0xc9a6ff, 24, 6);
    g.fade = 1;
    return;
  }
  const n = totalMen();
  let delta = 0;
  if (g.op === '+') delta = g.v;
  if (g.op === 'x') delta = Math.round(Math.min(n, 8 + S.wave * 2.5) * (g.v - 1) * (1 + stats.gateMult));
  if (g.op === '-') delta = -Math.ceil(g.v * stats.gateMinus);
  if (g.op === '÷') delta = -Math.ceil((n - n / g.v) * stats.gateMinus);
  if (delta > 0) { addAllies(delta); sfx('gateGood'); burst(S.squadX, 1.5, SQUAD_Z - 1, 0x7fd0ff, 20, 6); }
  else { if (S.buffs.shield > 0) delta = 0; else hurtSquad(-delta); sfx('gateBad'); shake = Math.max(shake, 0.25); }
  floater(S.squadX, 2.6, SQUAD_Z - 1, `${delta >= 0 ? '+' : ''}${fmt(delta)}`, delta >= 0 ? '#7fd0ff' : '#ff6b7a', 42);
  g.fade = 1;
}

// ------------------------------------------------------------ abilities
function airstrike(free = false) {
  if (!free) {
    if (!stats.airstrike || S.strikeCd > 0) return;
    S.strikeCd = 30 - stats.airstrike * 2;
  }
  const plane = models.buildPlane();
  plane.position.set(rand(-2, 2), 14, SQUAD_Z + 18);
  track(plane);
  S.plane = { g: plane, dropped: 0, bombs: 6 + stats.carpet * 2 };
  banner('AIRSTRIKE!', '');
}
function nuke(free = false) {
  if (!free) {
    if (!stats.nuke || S.nukeCd > 0) return;
    S.nukeCd = 120 - stats.nuke * 15;
  }
  sfx('nuke');
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:#fff;pointer-events:none;transition:opacity 1.2s;z-index:5';
  document.body.appendChild(flash);
  requestAnimationFrame(() => requestAnimationFrame(() => { flash.style.opacity = '0'; }));
  setTimeout(() => flash.remove(), 1400);
  for (const e of S.enemies) if (!e.dead) damageEnemy(e, e.hp + 1);
  for (const b of S.barrels) if (!b.dead) breakBarrel(b, true);
  if (S.boss) damageBoss(S.boss.maxHp * 0.2 / stats.bossMult);
  for (let i = 0; i < 10; i++) explosion(rand(-4, 4), 1, rand(-80, -5), 4, 0xffe066);
  shake = 2;
}
function updateAbilities(dt) {
  S.strikeCd = Math.max(0, S.strikeCd - dt);
  S.nukeCd = Math.max(0, S.nukeCd - dt);
  if (S.plane) {
    const P = S.plane;
    P.g.position.z -= 55 * dt;
    if (P.dropped < P.bombs && P.g.position.z < SQUAD_Z - 12 - P.dropped * (60 / P.bombs)) {
      P.dropped++;
      gatherTargets();
      const tx = targets.length ? pick(targets).x + rand(-1, 1) : rand(-4, 4);
      S.bombs.push({ x: P.g.position.x, y: 13, z: P.g.position.z, vx: (tx - P.g.position.x) * 0.8, vz: -10, vy: 0 });
    }
    if (P.g.position.z < -140) { untrack(P.g); S.plane = null; }
  }
  if (stats.grenade && S.allies.length) {
    S.grenadeT -= dt;
    if (S.grenadeT <= 0) {
      S.grenadeT = 8 - stats.grenade * 0.5;
      gatherTargets();
      const t = targets.find((x) => x !== S.boss && x.z > SQUAD_Z - 40) || (S.boss && S.boss.z > SQUAD_Z - 40 ? S.boss : null);
      if (t) {
        const g = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3d5a2a }));
        track(g);
        const fz = t.z + (S.speed + (t.speed || 0)) * 0.9;
        S.grenades.push({ g, sx: S.squadX, sz: SQUAD_Z - 1, tx: t.x, tz: fz, t: 0, T: 0.9 });
      }
    }
  }
  for (let i = S.grenades.length - 1; i >= 0; i--) {
    const Gr = S.grenades[i];
    Gr.t += dt;
    const k = Gr.t / Gr.T;
    Gr.tz += S.speed * dt;
    Gr.g.position.set(Gr.sx + (Gr.tx - Gr.sx) * k, 1 + Math.sin(k * Math.PI) * 5, Gr.sz + (Gr.tz - Gr.sz) * k);
    if (k >= 1) {
      untrack(Gr.g);
      S.grenades.splice(i, 1);
      areaDamage(Gr.tx, Gr.tz, 2.6, perSoldierDmg() * (6 + stats.grenade * 3) * Math.sqrt(totalMen()));
      sfx('explode');
      shake = Math.max(shake, 0.2);
    }
  }
  for (let i = S.bombs.length - 1; i >= 0; i--) {
    const B = S.bombs[i];
    B.vy -= 30 * dt;
    B.x += B.vx * dt; B.y += B.vy * dt; B.z += (B.vz + S.speed) * dt;
    burst(B.x, B.y, B.z, 0xaaaaaa, 1, 0.5, 0.25);
    if (B.y <= 0.3) {
      S.bombs.splice(i, 1);
      areaDamage(B.x, B.z, 3.4, enemyHp(S.wave) * 4 + perSoldierDmg() * 20, { bossMult: 0 });
      if (S.boss && Math.hypot(S.boss.x - B.x, S.boss.z - B.z) < 4 + S.boss.radius) damageBoss(S.boss.maxHp * 0.03 / stats.bossMult);
      sfx('explode');
      shake = Math.max(shake, 0.5);
    }
  }
  if (S.drones.length) {
    S.droneT -= dt;
    const fireNow = S.droneT <= 0;
    if (fireNow) { S.droneT = 0.45; gatherTargets(); }
    S.drones.forEach((d, i) => {
      d.a += dt * 1.2;
      const R = S.radius + 1.2;
      d.g.position.set(S.squadX + Math.cos(d.a) * R, 3 + Math.sin(S.time * 3 + i) * 0.3, SQUAD_Z + Math.sin(d.a) * R * 0.5);
      if (fireNow && targets.length) {
        const t = targets[Math.min(targets.length - 1, i % 3)];
        const dx = t.x - d.g.position.x, dz = t.z - d.g.position.z;
        const L = Math.hypot(dx, dz) || 1;
        spawnBullet(d.g.position.x, d.g.position.z, (dx / L) * 70, (dz / L) * 70, perSoldierDmg() * (4 + totalMen() * 0.15), { color: 0x5ff2ff, y: 2.6, size: 1.2, life: 1.2 });
      }
    });
  }
  if (S.hero && S.allies.length) {
    S.heroT -= dt;
    if (S.heroT <= 0) {
      S.heroT = 0.45;
      gatherTargets();
      if (targets.length) {
        const t = targets[0];
        const hx = S.squadX, hz = S.frontZ - 1.6;
        const dx = t.x - hx, dz = t.z - hz;
        const L = Math.hypot(dx, dz) || 1;
        spawnBullet(hx, hz, (dx / L) * 60, (dz / L) * 60, perSoldierDmg() * stats.commander * 15, { color: 0xffd700, y: 1.3, size: 2.2, life: 1.4, pierce: 2 });
      }
    }
  }
}

// ------------------------------------------------------------ world update
function updateEnemies(dt) {
  const frontLine = S.frontZ - 0.5;
  const frozen = S.buffs.freeze > 0;
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    if (e.dead) { S.enemies.splice(i, 1); continue; }
    e.z += (S.speed + (frozen ? 0 : e.speed)) * dt;
    if (!frozen) e.phase += dt * (6 + e.speed * 1.4) / e.s;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
    if (e.type === 'bomber' && e.z > -30) e.flash = Math.max(e.flash, Math.sin(S.time * 18) > 0.3 ? 0.55 : 0);
    if (e.z > -34 && !frozen) {
      const tx = clamp(S.squadX + (e.ox || 0) * 0.5, -ROAD_HALF + 0.4, ROAD_HALF - 0.4);
      e.x += clamp(tx - e.x, -3.2 * dt, 3.2 * dt);
    }
    if (e.type === 'bomber' && e.z > frontLine - 1.5 && S.allies.length) {
      const near = nearestAlly(e.x, e.z);
      if (near.i >= 0 && near.d < 1.1 + e.r) { e.dead = true; bomberBlast(e); continue; }
    }
    if (e.z > frontLine - 1.5 * e.s && (S.allies.length || S.vehicles.length)) {
      let absorbed = false;
      try { absorbed = PU.absorbHit(G, e); } catch (err) { console.error(err); }
      if (absorbed) { e.bite--; e.z -= 0.8; }
      else if (S.allies.length) {
        const near = nearestAlly(e.x, e.z);
        if (near.i >= 0 && near.d < 0.55 + e.r) {
          if (S.buffs.shield > 0) { burst(e.x, 0.8, e.z, 0x7fe8ff, 8, 5); e.bite = 0; }
          else if (S.shield > 0) { S.shield--; floater(e.x, 1.5, e.z, 'BLOCK', '#7fe8ff', 20); burst(e.x, 0.8, e.z, 0x7fe8ff, 8, 5); e.bite--; }
          else if (Math.random() < stats.dodge) { floater(e.x, 1.5, e.z, 'SAVED', '#c8d4e8', 18); e.bite--; }
          else { killAllyAt(near.i); e.bite--; }
          e.z -= 0.6;
          bumpBubble();
        }
      }
      if (e.bite <= 0) { e.dead = true; burst(e.x, 0.6, e.z, 0xe8343f, 6, 4); }
    }
    if (e.z > SQUAD_Z + 8) e.dead = true;
  }
}
function updateProps(dt) {
  for (let i = S.gates.length - 1; i >= 0; i--) {
    const g = S.gates[i];
    g.z += S.speed * dt;
    g.mesh.position.z = g.z;
    if (g.pop > 0) { g.pop = Math.max(0, g.pop - dt * 5); const s = 1 + g.pop * 0.15; g.mesh.userData.labelMesh.scale.set(s, s, 1); }
    if (!g.used && g.z >= SQUAD_Z - 0.5 && S.allies.length && S.squadX >= g.x0 && S.squadX < g.x1) passGate(g);
    if (g.fade !== undefined) {
      g.fade -= dt * 2.5;
      g.mesh.userData.panelMat.opacity = Math.max(0, g.fade) * 0.85;
      g.mesh.scale.y = Math.max(0.01, 0.4 + g.fade * 0.6);
    }
    if (g.z > SQUAD_Z + 16) { untrack(g.mesh); S.gates.splice(i, 1); }
  }
  for (let i = S.barrels.length - 1; i >= 0; i--) {
    const b = S.barrels[i];
    if (b.dead) { S.barrels.splice(i, 1); continue; }
    b.z += (S.speed + 2.2) * dt;
    b.g.position.z = b.z;
    b.g.userData.roll.rotation.x += dt * 3.2;
    if (b.g.userData.gun) b.g.userData.gun.rotation.y += dt * 2;
    else b.g.userData.iconMesh.position.y = 3.0 + Math.sin(S.time * 3 + b.x) * 0.15;
    drawLabel(b.g.userData.label, fmt(Math.max(1, b.hp / 10)));
    if (b.flash > 0) { b.flash -= dt * 6; const s = 1 + Math.max(0, b.flash) * 0.06; b.g.userData.roll.scale.set(s, s, s); }
    if (S.allies.length && b.z > S.frontZ - 1 && Math.abs(b.x - S.squadX) < 1.1 + S.radius) {
      const k = Math.max(1, Math.round((3 + S.wave * 0.35) * stats.crash * S.diff.dmg));
      const lost = hurtSquad(k, { x: b.x, z: b.z, radius: 3 });
      if (lost) floater(b.x, 2, b.z, `-${lost}`, '#ff6b7a', 34);
      breakBarrel(b, false);
      shake = Math.max(shake, 0.5);
    }
    if (b.z > SQUAD_Z + 14) { untrack(b.g); S.barrels.splice(i, 1); }
  }
}
function updateBoss(dt) {
  const B = S.boss;
  if (!B) return;
  try { B.update(G, dt); } catch (e) { console.error('boss update', e); }
  if (B.flash > 0) B.flash = Math.max(0, B.flash - dt * 6);
  document.getElementById('boss-fill').style.width = `${Math.max(0, (B.hp / B.maxHp) * 100)}%`;
  B.floatT = (B.floatT || 0) + dt;
  if (B.dmgAcc && B.floatT > 0.25) { floater(B.x + rand(-1, 1), B.height || 4, B.z, `-${fmt(B.dmgAcc)}`, '#ffffff', 24); B.dmgAcc = 0; B.floatT = 0; }
}

// particles
function burst(x, y, z, color, n, spd, life = 0.6) {
  if (!S) return;
  for (let i = 0; i < n; i++) {
    if (S.parts.length >= MAX_PARTS) S.parts.shift();
    S.parts.push({ x, y, z, vx: rand(-1, 1) * spd, vy: rand(0.3, 1.2) * spd, vz: rand(-1, 1) * spd, life: life * rand(0.6, 1.2), max: life, color, s: rand(0.6, 1.3) });
  }
}
const _mat = new THREE.Matrix4(), _col = new THREE.Color(), _quat = new THREE.Quaternion(), _sv = new THREE.Vector3(), _pv = new THREE.Vector3(), _eu = new THREE.Euler();
function updateParts(dt) {
  const Pt = S.parts;
  for (let i = Pt.length - 1; i >= 0; i--) {
    const p = Pt[i];
    p.life -= dt;
    if (p.life <= 0) { Pt[i] = Pt[Pt.length - 1]; Pt.pop(); continue; }
    p.vy -= 22 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + S.speed) * dt;
    if (p.y < 0.08) { p.y = 0.08; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
  }
  let n = 0;
  for (const p of Pt) {
    const s = p.s * Math.min(1, (p.life / p.max) * 2);
    _eu.set(p.life * 7, p.life * 5, 0);
    _quat.setFromEuler(_eu);
    _sv.set(s, s, s); _pv.set(p.x, p.y, p.z);
    _mat.compose(_pv, _quat, _sv);
    partMesh.setMatrixAt(n, _mat);
    partMesh.setColorAt(n, _col.setHex(p.color));
    n++;
  }
  partMesh.count = n;
  partMesh.instanceMatrix.needsUpdate = true;
  if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
}
function updateFx(dt) {
  for (const f of fxPool) {
    if (f.t >= f.life) continue;
    f.t += dt;
    const k = Math.min(1, f.t / f.life);
    f.ball.scale.setScalar(f.r * (0.3 + k * 0.9));
    f.ball.material.opacity = (1 - k) * 0.9;
    f.ring.scale.setScalar(f.r * (0.4 + k * 1.6));
    f.ring.material.opacity = (1 - k) * 0.7;
    if (k >= 1) f.ball.visible = f.ring.visible = false;
  }
  for (const Z of zapPool) {
    if (Z.t >= 1) continue;
    Z.t += dt * 8;
    Z.m.material.opacity = 1 - Z.t;
    if (Z.t >= 1) Z.m.visible = false;
  }
  muzzle.intensity = Math.max(0, muzzle.intensity - dt * 60);
}

// ------------------------------------------------------------ drawing
const WHITE_C = new THREE.Color(1, 1, 1);
function drawCrowds() {
  const big = S && S.buffs.giant > 0 ? 1.4 : 1;
  allyR.begin();
  if (S) for (const a of S.allies) allyR.add(a.x, 0, a.z, 0, big, a.phase, a.flash);
  allyR.end();
  heroR.begin();
  if (S && S.hero && S.allies.length) heroR.add(S.squadX, 0, S.frontZ - 1.6, 0, 1.9, S.time * 9, 0);
  heroR.end();
  for (const r of Object.values(enemyR)) r.begin();
  if (S) for (const e of S.enemies) enemyR[e.type].add(e.x, 0, e.z, Math.PI, e.s, e.phase, e.flash, S.buffs.freeze > 0 ? 0 : 1);
  for (const r of Object.values(enemyR)) r.end();
  let n = 0;
  if (S) for (const b of S.bullets) {
    _eu.set(0, Math.atan2(b.vx, b.vz), 0);
    _quat.setFromEuler(_eu);
    _pv.set(b.x, b.y, b.z);
    const L = b.beam ? 3.5 : b.rocket ? 1.4 : 1;
    _sv.set(b.size, b.size, b.size * L);
    _mat.compose(_pv, _quat, _sv);
    bulletCore.setMatrixAt(n, _mat);
    _sv.set(b.size * 2.6, b.size * 2.6, b.size * 1.4 * L);
    _mat.compose(_pv, _quat, _sv);
    bulletGlow.setMatrixAt(n, _mat);
    _col.setHex(b.color);
    bulletGlow.setColorAt(n, _col);
    _col.lerp(WHITE_C, 0.3).multiplyScalar(glowK());
    bulletCore.setColorAt(n, _col);
    n++;
  }
  for (const b of [bulletCore, bulletGlow]) {
    b.count = n;
    b.instanceMatrix.needsUpdate = true;
    b.instanceColor.needsUpdate = true;
  }
  shieldBubble.visible = !!(S && S.buffs.shield > 0 && S.allies.length);
  if (shieldBubble.visible) {
    shieldBubble.position.set(S.squadX, 0.6, SQUAD_Z);
    shieldBubble.scale.set(S.radius + 1, 1.8 + S.radius * 0.3, S.radius * 0.8 + 1);
  }
}

// ------------------------------------------------------------ HUD
const $ = (id) => document.getElementById(id);
const bubble = $('squad-bubble');
const floatersEl = $('floaters');
const floaters = [];
function floater(x, y, z, text, color, size = 26) {
  if (floaters.length > 40) { const f = floaters.shift(); f.el.remove(); }
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  el.style.color = color;
  el.style.fontSize = size + 'px';
  floatersEl.appendChild(el);
  floaters.push({ el, x, y, z, t: 0 });
}
const _v = new THREE.Vector3();
function toScreen(x, y, z) {
  _v.set(x, y, z).project(camera);
  return [(_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight];
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    f.y += dt * 2.2;
    f.z += (S ? S.speed : 0) * dt * 0.3;
    const [sx, sy] = toScreen(f.x, f.y, f.z);
    f.el.style.left = sx + 'px';
    f.el.style.top = sy + 'px';
    const k = f.t / 1.1;
    f.el.style.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
    f.el.style.transform = `translate(-50%,-50%) scale(${f.t < 0.12 ? 0.6 + f.t * 4 : 1})`;
    if (k >= 1) { f.el.remove(); floaters.splice(i, 1); }
  }
}
let bubbleT = 0;
function bumpBubble() { bubbleT = 0.25; }
function banner(text, sub = '', boss = false) {
  const el = $('banner');
  el.className = 'banner' + (boss ? ' boss' : '');
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  void el.offsetWidth;
  el.classList.add('show');
}
function shout(text, sub = '') {
  const el = $('shout');
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
let lastHud = '', lastBuffs = '', lastCombo = -1;
function updateHud(dt) {
  if (!S || S.demo) return;
  const n = totalMen();
  const [bx, by] = toScreen(S.squadX, 1.9, S.frontZ - 0.3);
  bubble.style.left = bx + 'px';
  bubble.style.top = by + 'px';
  bubble.textContent = fmt(n);
  if (bubbleT > 0) { bubbleT -= dt; bubble.style.transform = `translate(-50%,-100%) scale(${1 + bubbleT})`; }
  const prog = S.boss ? 1 - S.boss.hp / S.boss.maxHp : clamp((S.dist - S.waveStart) / WAVE_LEN, 0, 1);
  $('wave-fill').style.width = `${prog * 100}%`;
  $('wave-fill').classList.toggle('boss', !!S.boss);
  const W = curWeapon();
  const key = `${S.wave}|${Math.floor(S.coins)}|${S.weapon}|${Math.round(perSoldierDmg())}|${fireRate().toFixed(1)}`;
  if (key !== lastHud) {
    lastHud = key;
    $('wave-label').textContent = `WAVE ${S.wave}`;
    $('hud-coins').textContent = fmt(save.coins + S.coins);
    $('hud-weapon').textContent = W.name;
    $('hud-weapon-ico').textContent = W.icon;
    $('hud-wstats').textContent = `DMG ${fmt(perSoldierDmg())} · ${fireRate().toFixed(1)}/s`;
  }
  if (S.combo !== lastCombo) {
    lastCombo = S.combo;
    const el = $('combo');
    el.classList.toggle('hidden', S.combo < 5);
    if (S.combo >= 5) {
      el.querySelector('b').textContent = S.combo;
      el.style.fontSize = `${Math.min(46, 22 + Math.log2(S.combo) * 3)}px`;
    }
  }
  if (S.combo >= 5) $('combo-bar').style.width = `${(S.comboT / 2.5) * 100}%`;
  const bk = Object.entries(S.buffs).filter(([, t]) => t > 0).map(([k, t]) => `${k}:${Math.ceil(t)}`).join('|');
  if (bk !== lastBuffs) {
    lastBuffs = bk;
    $('buffs').innerHTML = Object.entries(S.buffs).filter(([, t]) => t > 0).map(([k, t]) => {
      const b = PU.BUFFS[k] || { icon: '✨', name: k, color: '#fff' };
      return `<div class="buff" style="border-color:${b.color}"><span>${b.icon}</span><b>${Math.ceil(t)}s</b></div>`;
    }).join('');
  }
  $('btn-strike').classList.toggle('hidden', !stats.airstrike);
  $('btn-nuke').classList.toggle('hidden', !stats.nuke);
  if (stats.airstrike) $('strike-cd').style.height = `${(S.strikeCd / (30 - stats.airstrike * 2)) * 100}%`;
  if (stats.nuke) $('nuke-cd').style.height = `${(S.nukeCd / (120 - stats.nuke * 15)) * 100}%`;
}

// ------------------------------------------------------------ main loop
function stepGame(dt) {
  S.time += dt;
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
  let want = Math.min(12, BASE_SPEED + S.wave * 0.02);
  if (S.boss && S.boss.holdWorld) want = 0;
  if (!S.allies.length) want = 0;
  S.speed += (want - S.speed) * Math.min(1, dt * 3);
  const dz = S.speed * dt;
  S.dist += dz;
  env.update(dz, dt, S.time);
  while (S.evIdx < S.events.length && S.dist - S.waveStart >= S.events[S.evIdx].d) spawnEvent(S.events[S.evIdx++]);
  if (S.dist - S.waveStart >= WAVE_LEN && S.evIdx >= S.events.length && !S.boss) waveCleared();
  updateAllies(dt);
  fire(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateProps(dt);
  updateBoss(dt);
  updateAbilities(dt);
  try { PU.update(G, dt); } catch (e) { console.error('powerups', e); }
  if (!S.allies.length && S.reserve <= 0 && !S.over) {
    if (stats.secondWind && !S.secondWindUsed) {
      S.secondWindUsed = true;
      addAllies(stats.secondWind);
      banner('SECOND WIND!', `+${stats.secondWind} soldiers`);
      sfx('powerup');
      for (const e of S.enemies) if (e.z > SQUAD_Z - 12) damageEnemy(e, e.hp + 1);
    } else {
      S.over = true;
      S.overT = 0;
      sfx('death');
    }
  }
}
function waveCleared() {
  const w = S.wave;
  const reward = Math.round((20 + w * 9) * stats.bonds);
  earn(reward);
  floater(S.squadX, 3.2, SQUAD_Z - 2, `WAVE CLEAR +${fmt(earnValue(reward))}`, '#ffe066', 30);
  if (stats.reinforce) { addAllies(stats.reinforce); floater(S.squadX, 2.2, SQUAD_Z, `+${stats.reinforce} 🪂`, '#7fd0ff', 26); }
  sfx('wave');
  bestFor(w);
  setupWave(w + 1);
}
function bestFor(w) {
  if (w > save.best) save.best = w;
  save.bestBy = save.bestBy || {};
  const id = S.diff.id;
  if (w > (save.bestBy[id] || 0)) save.bestBy[id] = w;
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (hitstop > 0) { hitstop -= dt; dt *= 0.15; }
  if (mode === 'play' && S) {
    if (S.over) {
      S.overT += dt;
      stepGame(dt * Math.max(0.2, 1 - S.overT) * 0.5);
      if (S.overT > 1.3) endRun();
    } else stepGame(dt);
  } else if (mode === 'menu') menuDemo(dt);
  if (S && mode !== 'paused') { updateParts(dt); updateFx(dt); updateSmoke(dt); updateFlashes(dt); }
  if (mode !== 'paused') updateFloaters(dt);
  updateHud(dt);
  drawCrowds();
  shake = Math.max(0, shake - dt * 2.5);
  const sx = S ? S.squadX * 0.35 : 0;
  const zoom = S ? clamp(S.radius * 0.35, 0, 1.6) : 0;
  camera.position.set(CAM_BASE.x + sx + (Math.random() - 0.5) * shake * 0.6, CAM_BASE.y + zoom * 1.4 + (Math.random() - 0.5) * shake * 0.6, CAM_BASE.z + zoom);
  camera.lookAt(CAM_LOOK.x + sx * 0.8, CAM_LOOK.y, CAM_LOOK.z);
  if (useBloom) composer.render(); else renderer.render(scene, camera);
}
function menuDemo(dt) {
  if (!S) newRun(1, true);
  S.time += dt;
  S.speed = BASE_SPEED * 0.6;
  env.update(S.speed * dt, dt, S.time);
  S.targetX = Math.sin(S.time * 0.5) * 2;
  updateAllies(dt);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  const need = Math.max(1, 0.95 / camera.aspect);
  camera.fov = clamp(2 * Math.atan(Math.tan((50 * Math.PI) / 360) * need) * (180 / Math.PI), 50, 92);
  camera.updateProjectionMatrix();
}
function applyQuality() {
  const low = save.quality === 'low';
  renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 1.75));
  sun.castShadow = !low;
  useBloom = !low;
  resize();
  const b = document.getElementById('btn-quality');
  if (b) b.textContent = low ? '⚙ Graphics: Low (fast)' : '⚙ Graphics: High';
}
addEventListener('resize', resize);
applyQuality();

// ------------------------------------------------------------ module API (see API.md)
const G = {
  THREE, scene, SQUAD_Z, ROAD_HALF, SPAWN_Z, models,
  get S() { return S; }, get stats() { return stats; },
  track, untrack, totalMen, addAllies: (n, at) => addAllies(n, at), hurtSquad,
  damageEnemy, areaDamage, damageBoss: (d, m = 1) => damageBoss(d, m),
  spawnBullet: (x, z, vx, vz, dmg, o = {}) => spawnBullet(x, z, vx, vz, dmg, { color: 0xffe066, size: 1, ...o }),
  spawnEnemy, enemyHp, perSoldierDmg, squadDps, getTargets: () => gatherTargets().slice(),
  explosion, burst, floater, banner, shake: (a) => { shake = Math.max(shake, a); }, sfx, earn, setWeapon, rand,
  airstrike: () => airstrike(true), nuke: () => nuke(true),
};

// ------------------------------------------------------------ input
addEventListener('keydown', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
  if (mode === 'play') {
    if (e.code === 'Space') { e.preventDefault(); airstrike(); }
    if (e.code === 'KeyN') nuke();
    if (e.code === 'KeyP' || e.code === 'Escape') pause();
  } else if (mode === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) resume();
});
addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
});
const cv = renderer.domElement;
const ray = new THREE.Raycaster();
function pointerToX(clientX) {
  ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, 0), camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  const x = o.x + d.x * ((SQUAD_Z - o.z) / d.z);
  return Number.isFinite(x) ? x : 0;
}
cv.addEventListener('pointerdown', (e) => { input.dragging = true; input.lastX = e.clientX; unlockAudio(); });
addEventListener('pointerup', () => { input.dragging = false; });
cv.addEventListener('pointermove', (e) => {
  if (!S || mode !== 'play') return;
  if (e.pointerType === 'mouse') S.targetX = pointerToX(e.clientX) * 1.3;
  else if (input.dragging) { S.targetX += ((e.clientX - input.lastX) / innerWidth) * 16; input.lastX = e.clientX; }
});
$('btn-strike').addEventListener('pointerdown', (e) => { e.stopPropagation(); airstrike(); });
$('btn-nuke').addEventListener('pointerdown', (e) => { e.stopPropagation(); nuke(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

// ------------------------------------------------------------ screens
let chosenStart = 1;
function show(ids) {
  for (const s of ['menu', 'death', 'pause', 'hud', 'tech']) $(s).classList.toggle('hidden', !ids.includes(s));
}
function renderChips(el) {
  const unlocked = startWaves();
  const all = [1, ...(tech.SKIP_WAVES || [5, 10, 15, 20, 30, 40, 50, 75, 100])];
  if (!unlocked.includes(chosenStart)) chosenStart = 1;
  el.innerHTML = '';
  for (const w of all) {
    const b = document.createElement('button');
    const ok = unlocked.includes(w);
    b.className = 'chip' + (w === chosenStart ? ' on' : '') + (ok ? '' : ' locked');
    b.textContent = ok ? w : `🔒${w}`;
    b.title = ok ? `Start at wave ${w}` : `Unlock "Head Start ${w}" in the tech tree`;
    b.onclick = () => { if (!ok) { sfx('deny'); return; } chosenStart = w; save.startWave = w; persist(); sfx('click'); renderChips(el); };
    el.appendChild(b);
  }
}
function renderDiffs(el) {
  el.innerHTML = '';
  for (const d of DIFFS) {
    const b = document.createElement('button');
    const on = (save.difficulty || 'medium') === d.id;
    b.className = 'diff' + (on ? ' on' : '');
    b.style.setProperty('--dc', d.color);
    const best = (save.bestBy || {})[d.id] || 0;
    b.innerHTML = `<b>${d.name}</b><span>${d.coins}× coins${best ? ` · best ${best}` : ''}</span>`;
    b.onclick = () => { save.difficulty = d.id; persist(); sfx('click'); renderDiffs(el); };
    el.appendChild(b);
  }
}
function showMenu() {
  mode = 'menu';
  musicStop();
  if (S && !S.demo) { try { PU.clear(G); } catch (e) { console.error(e); } }
  S = null;
  clearWorld();
  show(['menu']);
  $('menu-best').textContent = save.best;
  $('menu-coins').textContent = fmt(save.coins);
  $('menu-tech').textContent = techCount().have;
  $('btn-mute').textContent = save.mute ? '🔇 Sound off' : '🔊 Sound on';
  renderChips($('menu-chips'));
  renderDiffs($('menu-diff'));
}
function startGame() {
  if (document.activeElement) document.activeElement.blur();
  unlockAudio();
  sfx('click');
  floaters.forEach((f) => f.el.remove());
  floaters.length = 0;
  newRun(chosenStart);
  save.runs++;
  persist();
  mode = 'play';
  show(['hud']);
  $('boss-bar').classList.add('hidden');
  $('buffs').innerHTML = '';
  lastHud = lastBuffs = '';
  lastCombo = -1;
  musicStart();
  musicIntensity(chosenStart >= 30 ? 1 : 0);
}
function pause() { if (mode !== 'play') return; mode = 'paused'; show(['hud', 'pause']); musicStop(); }
function resume() { mode = 'play'; show(['hud']); last = performance.now(); musicStart(); musicIntensity(S && S.boss ? 2 : S && S.wave >= 30 ? 1 : 0); }
function endRun() {
  mode = 'dead';
  musicStop();
  const earned = Math.floor(S.coins);
  save.coins += earned;
  const reached = S.wave;
  const newBest = reached > save.best;
  bestFor(reached);
  let bonus = '';
  if (stats.interest) {
    const i = Math.min(Math.floor(save.coins * 0.02 * stats.interest), stats.interest * 5000);
    if (i > 0) { save.coins += i; bonus = ` · 🏦 Interest: +${fmt(i)} coins`; }
  }
  persist();
  $('d-wave').textContent = reached;
  $('d-newbest').classList.toggle('hidden', !newBest);
  $('d-kills').textContent = fmt(S.kills);
  $('d-bosses').textContent = S.bosses;
  $('d-peak').textContent = fmt(S.peak);
  $('d-coins').textContent = fmt(earned);
  $('d-bonus').textContent = `${S.diff.name} · Best combo ${S.bestCombo}${bonus}`;
  $('boss-bar').classList.add('hidden');
  renderQuick();
  renderChips($('death-chips'));
  show(['death']);
}
function renderQuick() {
  const el = $('d-quick');
  el.innerHTML = '';
  const opts = NODES.filter((x) => x.id !== 'core' && nodeUnlocked(x) && lvl(x.id) < x.max).sort((a, b) => nodeCost(a) - nodeCost(b)).slice(0, 3);
  for (const x of opts) {
    const b = document.createElement('button');
    b.className = 'quick' + (canBuy(x) ? '' : ' cant');
    b.innerHTML = `<div class="q-ico">${x.icon}</div><div class="q-name">${x.name}${x.max > 1 ? ` ${lvl(x.id) + 1}` : ''}</div><div class="q-cost">${fmt(nodeCost(x))}</div>`;
    b.onclick = () => { if (buy(x)) { sfx('buy'); stats = getStats(); renderQuick(); } else sfx('deny'); };
    el.appendChild(b);
  }
  if (!opts.length) el.innerHTML = '<div style="grid-column:1/-1;opacity:.6;font-weight:800">Everything available is maxed. Open the tech tree.</div>';
}
function openTree(from) {
  sfx('click');
  mode = 'tech';
  show(['tech']);
  openTech(() => { stats = getStats(); });
  $('tech-back').onclick = () => {
    closeTech();
    sfx('click');
    if (from === 'death') { show(['death']); mode = 'dead'; renderQuick(); renderChips($('death-chips')); }
    else showMenu();
  };
}
$('btn-play').onclick = startGame;
$('d-retry').onclick = startGame;
$('btn-tech').onclick = () => openTree('menu');
$('d-tech').onclick = () => openTree('death');
$('d-menu').onclick = () => { sfx('click'); showMenu(); };
$('btn-pause').onclick = pause;
$('p-resume').onclick = resume;
$('p-quit').onclick = () => { resume(); S.allies.length = 0; S.reserve = 0; S.secondWindUsed = true; };
$('btn-quality').onclick = () => { save.quality = save.quality === 'low' ? 'high' : 'low'; persist(); applyQuality(); sfx('click'); };
$('btn-mute').onclick = () => { save.mute = !save.mute; persist(); $('btn-mute').textContent = save.mute ? '🔇 Sound off' : '🔊 Sound on'; };

chosenStart = startWaves().includes(save.startWave) ? save.startWave : 1;
(document.fonts ? document.fonts.load('40px "Lilita One"').catch(() => {}) : Promise.resolve()).finally(() => {
  $('loading').classList.add('hidden');
  showMenu();
  requestAnimationFrame(frame);
});

// debug / test hooks
window.__game = {
  get S() { return S; }, get mode() { return mode; }, startGame, stats: () => stats, save, G,
  sim(seconds, pilot) { for (let t = 0; t < seconds && !S.over; t += 1 / 60) { if (pilot) pilot(S); stepGame(1 / 60); } return S.wave; },
};
