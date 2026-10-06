// Tech tree: node data, derived run stats, and the pan/zoom tree UI.
import { save, persist, fmt } from './save.js';
import { sfx } from './audio.js';

export const CATS = {
  core:      { color: '#5fb7ff', angle: 0 },
  squad:     { color: '#ffb020' },
  defense:   { color: '#8aa0b8' },
  firepower: { color: '#ff4d5e' },
  gates:     { color: '#28c4ff' },
  economy:   { color: '#2fd27a' },
  abilities: { color: '#a46bff' },
  weapons:   { color: '#a46bff' },
  skip:      { color: '#ff7ad9' },
};
// Clockwise sector order starting at "up".
const SECTOR_ORDER = ['squad', 'defense', 'firepower', 'gates', 'economy', 'abilities', 'weapons', 'skip'];

export const WEAPONS = [
  { name: 'PISTOL',       icon: '🔫', rate: 2.2, dmg: 1.0, speed: 46, color: 0xfff1a8, size: 1.0 },
  { name: 'SMG',          icon: '🔫', rate: 4.0, dmg: 0.75, speed: 52, color: 0xffe066, size: 0.9 },
  { name: 'ASSAULT RIFLE',icon: '🪖', rate: 4.2, dmg: 1.05, speed: 58, color: 0xffb347, size: 1.0 },
  { name: 'MACHINE GUN',  icon: '💥', rate: 7.5, dmg: 0.85, speed: 60, color: 0xff8c42, size: 1.0 },
  { name: 'MINIGUN',      icon: '🌀', rate: 13,  dmg: 0.75, speed: 64, color: 0xff6b3d, size: 0.9 },
  { name: 'LASER',        icon: '🔆', rate: 7,   dmg: 2.0, speed: 90, color: 0x6be8ff, size: 1.4, pierce: 2 },
  { name: 'ROCKETS',      icon: '🚀', rate: 2.4, dmg: 5.5, speed: 40, color: 0xff5533, size: 1.6, splash: 2.6 },
  { name: 'PLASMA',       icon: '🟣', rate: 9,   dmg: 2.6, speed: 75, color: 0xd277ff, size: 1.5, pierce: 2, splash: 1.4 },
];

const SKIPS = [5, 10, 15, 20, 30, 40, 50, 75, 100];
const SKIP_COST = [100, 400, 1000, 2500, 8000, 20000, 50000, 150000, 500000];

// n(id, cat, icon, name, desc, max, cost, grow, req, effect(lv) -> text, extra)
function n(id, cat, icon, name, desc, max, cost, grow, req, effect, extra = {}) {
  return { id, cat, icon, name, desc, max, cost, grow, req, effect, ...extra };
}
const pct = (v) => `${Math.round(v * 100)}%`;

export const NODES = [
  n('core', 'core', '🎖️', 'Command Center', 'The heart of your army. Everything grows from here.', 1, 0, 1, [], () => 'Online'),

  // Squad
  n('recruit', 'squad', '🧍', 'Recruits', 'Start every run with +1 soldier per level.', 10, 15, 1.3, [['core', 1]], (l) => `+${l} starting soldiers`),
  n('barracks', 'squad', '🏠', 'Barracks', '+3 starting soldiers per level.', 10, 150, 1.3, [['recruit', 4]], (l) => `+${l * 3} starting soldiers`),
  n('reinforce', 'squad', '🪂', 'Reinforcements', 'Each cleared wave drops in +2 soldiers per level.', 10, 400, 1.32, [['barracks', 2]], (l) => `+${l * 2} soldiers per wave`),
  n('battalion', 'squad', '🚩', 'Battalion', '+10 starting soldiers per level.', 10, 2500, 1.35, [['reinforce', 3]], (l) => `+${l * 10} starting soldiers`),
  n('legion', 'squad', '🏛️', 'Legion', '+25 starting soldiers per level.', 5, 30000, 1.5, [['battalion', 5]], (l) => `+${l * 25} starting soldiers`),
  n('formation', 'squad', '🔷', 'Tight Formation', 'Soldiers pack closer together, making the squad easier to steer around danger.', 3, 100, 2.5, [['recruit', 2]], (l) => `-${l * 10}% squad spread`),
  n('medic', 'squad', '⛑️', 'Field Medic', 'Periodically revives a fallen soldier.', 8, 300, 1.4, [['barracks', 2]], (l) => l ? `+1 soldier every ${22 - l * 2}s` : 'Not trained'),
  n('veteran', 'squad', '🎗️', 'Veterans', 'Battle-hardened soldiers deal more damage.', 10, 900, 1.35, [['medic', 2]], (l) => `+${l * 6}% squad damage`),
  n('commander', 'squad', '🦸', 'Hero Commander', 'A giant hero leads your squad, firing heavy rounds.', 5, 5000, 1.8, [['veteran', 3]], (l) => l ? `Hero deals ${l * 15}x damage` : 'No hero'),

  // Defense
  n('armor', 'defense', '🦺', 'Body Armor', 'Chance that a soldier survives being hit.', 15, 40, 1.3, [['core', 1]], (l) => `${l * 3}% survive chance`),
  n('laststand', 'defense', '🔥', 'Last Stand', 'With 10 or fewer soldiers, the squad deals bonus damage.', 8, 200, 1.35, [['armor', 2]], (l) => `+${l * 30}% damage when desperate`),
  n('shield', 'defense', '🛡️', 'Energy Shield', 'Blocks enemy hits. Recharges every wave.', 10, 350, 1.35, [['armor', 4]], (l) => `Blocks ${l * 2} hits per wave`),
  n('crash', 'defense', '🛢️', 'Crash Pads', 'Rolling barrels crush fewer soldiers.', 5, 500, 1.45, [['shield', 1]], (l) => `-${l * 15}% barrel losses`),
  n('boots', 'defense', '🥾', 'Stomp Boots', 'Boss stomps kill fewer soldiers.', 5, 1500, 1.5, [['shield', 3]], (l) => `-${l * 12}% stomp losses`),
  n('secondwind', 'defense', '💖', 'Second Wind', 'Once per run, when your squad is wiped, it comes back.', 3, 8000, 2, [['boots', 2]], (l) => l ? `Revive with ${l * 8} soldiers` : 'Inactive'),

  // Firepower
  n('dmg1', 'firepower', '🎯', 'Hollow Points', '+20 damage per bullet.', 25, 10, 1.17, [['core', 1]], (l) => `+${l * 20} damage`),
  n('ap', 'firepower', '🔩', 'Armor Piercing', '+60 damage per bullet.', 20, 300, 1.2, [['dmg1', 10]], (l) => `+${l * 60} damage`),
  n('du', 'firepower', '☢️', 'Depleted Uranium', '+200 damage per bullet.', 15, 4000, 1.22, [['ap', 8]], (l) => `+${l * 200} damage`),
  n('anti', 'firepower', '⚛️', 'Antimatter Rounds', '+800 damage per bullet.', 10, 60000, 1.25, [['du', 8]], (l) => `+${l * 800} damage`),
  n('rate1', 'firepower', '⏱️', 'Trigger Discipline', '+6% fire rate per level.', 15, 40, 1.25, [['dmg1', 3]], (l) => `+${l * 6}% fire rate`),
  n('rate2', 'firepower', '⚡', 'Hair Trigger', '+10% fire rate per level.', 10, 1200, 1.3, [['rate1', 8]], (l) => `+${l * 10}% fire rate`),
  n('range', 'firepower', '🔭', 'Long Barrels', 'Bullets fly faster and further.', 5, 120, 1.5, [['rate1', 1]], (l) => `+${l * 10}% range & speed`),
  n('crit', 'firepower', '💢', 'Critical Hits', 'Chance for bullets to crit.', 15, 150, 1.25, [['rate1', 3]], (l) => `${l * 3}% crit chance`),
  n('critdmg', 'firepower', '💣', 'Devastation', 'Critical hits hit even harder.', 10, 900, 1.3, [['crit', 5]], (l) => `Crits deal ${(2 + l * 0.3).toFixed(1)}x`),
  n('bossslayer', 'firepower', '🗡️', 'Boss Slayer', 'Extra damage against bosses.', 10, 2000, 1.3, [['critdmg', 2]], (l) => `+${l * 15}% boss damage`),

  // Gates
  n('gplus', 'gates', '➕', 'Gate Hacker', 'Every + gate gives more soldiers.', 15, 30, 1.25, [['core', 1]], (l) => `+${l} on every + gate`),
  n('gshoot', 'gates', '🔫', 'Gate Shooter', 'Shooting a gate raises its value faster.', 5, 200, 1.5, [['gplus', 2]], (l) => `+${l * 30}% gate charge speed`),
  n('gminus', 'gates', '🧯', 'Damage Control', 'Negative gates take fewer soldiers.', 8, 400, 1.35, [['gshoot', 1]], (l) => `-${l * 8}% losses from − and ÷`),
  n('gmult', 'gates', '✖️', 'Multiplier Mastery', 'Multiplier gates give bonus soldiers.', 10, 800, 1.35, [['gplus', 5]], (l) => `+${l * 10}% from × gates`),
  n('glucky', 'gates', '🌟', 'Lucky Gates', 'Chance for a golden mega gate to appear.', 5, 3000, 1.6, [['gmult', 3]], (l) => `${l * 4}% golden gate chance`),

  // Economy
  n('magnet', 'economy', '🧲', 'Coin Magnet', '+10% coins from everything.', 25, 20, 1.2, [['core', 1]], (l) => `+${l * 10}% coins`),
  n('bounty', 'economy', '💰', 'Bounty Hunter', 'Extra coins per kill.', 10, 150, 1.35, [['magnet', 3]], (l) => `+${l} coins per kill`),
  n('bonds', 'economy', '📜', 'War Bonds', 'Bigger rewards for clearing waves.', 10, 300, 1.3, [['magnet', 5]], (l) => `+${l * 25}% wave rewards`),
  n('bossloot', 'economy', '👑', 'Boss Loot', 'Bosses drop more coins.', 10, 1200, 1.3, [['bonds', 2]], (l) => `+${l * 50}% boss coins`),
  n('treasure', 'economy', '🎁', 'Treasure Hunter', 'Barrels drop coin chests more often, and bigger ones.', 10, 600, 1.35, [['bounty', 2]], (l) => `+${l * 20}% chest value`),
  n('golden', 'economy', '🪙', 'Golden Touch', 'Tiny chance any kill pays out 25x.', 10, 3000, 1.4, [['treasure', 3]], (l) => `${(l * 0.5).toFixed(1)}% jackpot chance`),
  n('interest', 'economy', '🏦', 'Interest', 'After each run, earn interest on your banked coins.', 5, 5000, 1.6, [['bonds', 4]], (l) => `${l * 2}% interest (max ${fmt(l * 5000)})`),

  // Abilities
  n('grenade', 'abilities', '🧨', 'Grenadiers', 'Your squad throws grenades automatically.', 10, 60, 1.35, [['core', 1]], (l) => l ? `Grenade every ${(8 - l * 0.5).toFixed(1)}s` : 'No grenades'),
  n('airstrike', 'abilities', '✈️', 'Airstrike', 'Unlock the Airstrike ability (SPACE). More levels mean a shorter cooldown.', 10, 400, 1.3, [['grenade', 2]], (l) => l ? `${30 - l * 2}s cooldown` : 'Locked'),
  n('carpet', 'abilities', '🎇', 'Carpet Bombing', 'Airstrikes drop more bombs.', 5, 1500, 1.5, [['airstrike', 3]], (l) => `+${l * 2} bombs per strike`),
  n('nuke', 'abilities', '☢️', 'Tactical Nuke', 'Unlock the Nuke (N), which clears the whole road.', 5, 15000, 1.8, [['carpet', 2]], (l) => l ? `${120 - l * 15}s cooldown` : 'Locked'),
  n('drone', 'abilities', '🛸', 'Combat Drones', 'Flying drones fire alongside your squad.', 6, 800, 1.6, [['grenade', 3]], (l) => `${l} drone${l === 1 ? '' : 's'}`),

  // Weapons (starting weapon unlocks)
  n('w_smg', 'weapons', '🔫', 'SMG Training', 'Start every run with the SMG.', 1, 100, 1, [['core', 1]], () => 'Start: SMG', { weapon: 1 }),
  n('w_rifle', 'weapons', '🪖', 'Rifle Training', 'Start every run with the Assault Rifle.', 1, 400, 1, [['w_smg', 1]], () => 'Start: Assault Rifle', { weapon: 2 }),
  n('w_mg', 'weapons', '💥', 'Heavy Weapons', 'Start every run with the Machine Gun.', 1, 1500, 1, [['w_rifle', 1]], () => 'Start: Machine Gun', { weapon: 3 }),
  n('w_mini', 'weapons', '🌀', 'Minigun Corps', 'Start every run with the Minigun.', 1, 6000, 1, [['w_mg', 1]], () => 'Start: Minigun', { weapon: 4 }),
  n('w_laser', 'weapons', '🔆', 'Laser Lab', 'Start every run with Lasers. They pierce enemies.', 1, 20000, 1, [['w_mini', 1]], () => 'Start: Laser', { weapon: 5 }),
  n('w_rocket', 'weapons', '🚀', 'Rocket Division', 'Start every run with Rockets. They deal splash damage.', 1, 60000, 1, [['w_laser', 1]], () => 'Start: Rockets', { weapon: 6 }),
  n('w_plasma', 'weapons', '🟣', 'Plasma Reactor', 'Start every run with Plasma, which pierces and splashes.', 1, 200000, 1, [['w_rocket', 1]], () => 'Start: Plasma', { weapon: 7 }),
  n('armory', 'weapons', '🗄️', 'Armory', 'Barrels drop weapon upgrades more often.', 5, 300, 1.5, [['w_smg', 1]], (l) => `+${l * 10}% weapon drops`),
  n('multishot', 'weapons', '🎆', 'Multishot', 'Chance for every bullet to split into two.', 10, 600, 1.3, [['w_rifle', 1]], (l) => `${l * 8}% double shot`),
  n('pierce', 'weapons', '📌', 'Penetrator', 'Bullets pass through extra enemies at full damage.', 5, 3000, 1.6, [['multishot', 3]], (l) => `+${l} pierce`),

  // Wave skip chain
  ...SKIPS.map((w, i) => n(`skip${w}`, 'skip', i < 3 ? '⏩' : i < 6 ? '🚀' : '🌌', `Head Start ${w}`,
    `Unlock starting a run at wave ${w}. You also get bonus soldiers to survive the jump. Requires reaching wave ${w}.`,
    1, SKIP_COST[i], 1, [[i ? `skip${SKIPS[i - 1]}` : 'core', 1]], () => `Start at wave ${w}`, { best: w })),
];
export const NODE = Object.fromEntries(NODES.map((x) => [x.id, x]));

export const lvl = (id) => save.tech[id] || 0;
export function nodeCost(node) {
  return Math.round(node.cost * Math.pow(node.grow, lvl(node.id)));
}
export function nodeUnlocked(node) {
  if (node.best && save.best < node.best) return false;
  return node.req.every(([id, l]) => lvl(id) >= l);
}
export function canBuy(node) {
  return lvl(node.id) < node.max && nodeUnlocked(node) && save.coins >= nodeCost(node);
}
export function buy(node) {
  if (!canBuy(node)) return false;
  save.coins -= nodeCost(node);
  save.tech[node.id] = lvl(node.id) + 1;
  persist();
  return true;
}
export function techCount() {
  let have = 0, total = 0;
  for (const x of NODES) { if (x.id === 'core') continue; have += lvl(x.id); total += x.max; }
  return { have, total };
}

export function startWaves() {
  return [1, ...SKIPS.filter((w) => lvl(`skip${w}`) > 0)];
}

// Everything the run needs, derived from tech levels.
export function getStats() {
  const L = lvl;
  let startWeapon = 0;
  for (const x of NODES) if (x.weapon && L(x.id)) startWeapon = Math.max(startWeapon, x.weapon);
  return {
    startMen: 3 + L('recruit') + 3 * L('barracks') + 10 * L('battalion') + 25 * L('legion'),
    spacing: 0.62 * (1 - 0.1 * L('formation')),
    medicInterval: L('medic') ? 22 - 2 * L('medic') : 0,
    veteran: 1 + 0.06 * L('veteran'),
    commander: L('commander'),
    reinforce: 2 * L('reinforce'),
    dodge: 0.03 * L('armor'),
    lastStand: 0.3 * L('laststand'),
    shieldHits: 2 * L('shield'),
    crash: 1 - 0.15 * L('crash'),
    boots: 1 - 0.12 * L('boots'),
    secondWind: 8 * L('secondwind'),
    dmg: 100 + 20 * L('dmg1') + 60 * L('ap') + 200 * L('du') + 800 * L('anti'),
    rateMult: (1 + 0.06 * L('rate1')) * (1 + 0.1 * L('rate2')),
    rangeMult: 1 + 0.1 * L('range'),
    crit: 0.03 * L('crit'),
    critMult: 2 + 0.3 * L('critdmg'),
    bossMult: 1 + 0.15 * L('bossslayer'),
    gatePlus: L('gplus'),
    gateShoot: 1 + 0.3 * L('gshoot'),
    gateMinus: 1 - 0.08 * L('gminus'),
    gateMult: 0.1 * L('gmult'),
    goldenGate: 0.04 * L('glucky'),
    coinMult: 1 + 0.1 * L('magnet'),
    bounty: L('bounty'),
    bonds: 1 + 0.25 * L('bonds'),
    bossLoot: 1 + 0.5 * L('bossloot'),
    treasure: L('treasure'),
    jackpot: 0.005 * L('golden'),
    interest: L('interest'),
    grenade: L('grenade'),
    airstrike: L('airstrike'),
    carpet: L('carpet'),
    nuke: L('nuke'),
    drones: L('drone'),
    startWeapon,
    armory: 0.1 * L('armory'),
    multishot: 0.08 * L('multishot'),
    pierce: L('pierce'),
  };
}

// ---------------------------------------------------------------- Tree UI
const STEP = 150;   // radial distance between depths
const R0 = 170;     // radius of first ring
let built = false;
let view = { x: 0, y: 0, s: 0.75 };
let selected = null;
let onChange = () => {};
const els = {};

function layout() {
  // primary parent = first requirement
  const kids = {};
  for (const x of NODES) {
    if (x.id === 'core') continue;
    const p = x.req[0][0];
    (kids[p] = kids[p] || []).push(x.id);
  }
  const leaves = (id) => (kids[id] ? kids[id].reduce((s, k) => s + leaves(k), 0) : 1);
  const pos = { core: { x: 0, y: 0 } };
  // sector widths proportional to leaf counts
  const sectors = SECTOR_ORDER.map((cat) => {
    const roots = kids.core.filter((id) => NODE[id].cat === cat);
    return { cat, roots, w: roots.reduce((s, r) => s + leaves(r), 0) + 0.6 };
  });
  const total = sectors.reduce((s, x) => s + x.w, 0);
  let a = -Math.PI * (sectors[0].w / total); // center "squad" on top
  const place = (id, depth, a0, a1) => {
    const mid = (a0 + a1) / 2;
    const r = R0 + depth * STEP;
    pos[id] = { x: Math.sin(mid) * r, y: -Math.cos(mid) * r };
    const ks = kids[id] || [];
    const tot = ks.reduce((s, k) => s + leaves(k), 0);
    let c = a0;
    for (const k of ks) {
      const span = (a1 - a0) * (leaves(k) / tot);
      place(k, depth + 1, c, c + span);
      c += span;
    }
  };
  for (const s of sectors) {
    const span = (Math.PI * 2 * s.w) / total;
    const inner = span * (0.3 / s.w);
    let c = a + inner;
    const usable = span - inner * 2;
    const tl = s.roots.reduce((t, r) => t + leaves(r), 0);
    for (const r of s.roots) {
      const sp = usable * (leaves(r) / tl);
      place(r, 0, c, c + sp);
      c += sp;
    }
    a += span;
  }
  return pos;
}

function buildTree() {
  const pos = layout();
  const nodesEl = document.getElementById('tech-nodes');
  const svg = document.getElementById('tech-lines');
  nodesEl.innerHTML = '';
  svg.innerHTML = '';
  for (const x of NODES) {
    for (const [rid] of x.req) {
      const a = pos[rid], b = pos[x.id];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.dataset.to = x.id;
      svg.appendChild(line);
    }
  }
  for (const x of NODES) {
    const d = document.createElement('div');
    d.className = 'tnode' + (x.id === 'core' ? ' core' : '');
    d.style.left = pos[x.id].x + 'px';
    d.style.top = pos[x.id].y + 'px';
    d.style.borderColor = CATS[x.cat].color;
    d.innerHTML = `${x.icon}<div class="lv"></div><div class="nm">${x.name}</div>`;
    d.dataset.id = x.id;
    nodesEl.appendChild(d);
    els[x.id] = d;
  }
  // pan / zoom
  const viewEl = document.getElementById('tech-view');
  const world = document.getElementById('tech-world');
  const apply = () => { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`; };
  const pointers = new Map();
  let moved = 0, pinch0 = 0, s0 = 1;
  viewEl.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewEl.setPointerCapture(e.pointerId);
    moved = 0;
    if (pointers.size === 2) { const [p, q] = [...pointers.values()]; pinch0 = Math.hypot(p.x - q.x, p.y - q.y); s0 = view.s; }
    viewEl.classList.add('dragging');
  });
  viewEl.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (s0 * d) / pinch0 / view.s);
    } else {
      view.x += dx; view.y += dy; moved += Math.abs(dx) + Math.abs(dy);
    }
    apply();
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) viewEl.classList.remove('dragging');
    if (moved < 6 && e.type === 'pointerup') {
      const t = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList && el.classList.contains('tnode'));
      if (t) select(t.dataset.id);
      else { selected = null; refresh(); }
    }
  };
  viewEl.addEventListener('pointerup', up);
  viewEl.addEventListener('pointercancel', up);
  const zoomAt = (cx, cy, f) => {
    const r = viewEl.getBoundingClientRect();
    const ns = Math.min(1.6, Math.max(0.25, view.s * f));
    const k = ns / view.s;
    view.x = cx - r.left - (cx - r.left - view.x) * k;
    view.y = cy - r.top - (cy - r.top - view.y) * k;
    view.s = ns;
  };
  viewEl.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); apply(); }, { passive: false });
  els.apply = apply;
  document.getElementById('tp-buy').addEventListener('click', () => {
    if (!selected) return;
    const node = NODE[selected];
    if (buy(node)) {
      sfx('buy');
      const el = els[node.id];
      el.classList.remove('bought-anim'); void el.offsetWidth; el.classList.add('bought-anim');
      refresh();
      onChange();
    } else sfx('deny');
  });
  built = true;
}

function select(id) {
  selected = id;
  sfx('click');
  refresh();
}

export function refresh() {
  if (!built) return;
  const { have, total } = techCount();
  document.getElementById('tech-progress').textContent = `${have} / ${total} upgrades`;
  document.getElementById('tech-coins').textContent = fmt(save.coins);
  for (const x of NODES) {
    const el = els[x.id];
    const l = lvl(x.id);
    const unl = nodeUnlocked(x);
    el.classList.toggle('locked', !unl && l === 0);
    el.classList.toggle('maxed', l >= x.max);
    el.classList.toggle('afford', canBuy(x));
    el.classList.toggle('sel', selected === x.id);
    el.querySelector('.lv').textContent = x.id === 'core' ? 'HQ' : x.max === 1 ? (l ? '✓' : fmt(nodeCost(x))) : `${l}/${x.max}`;
  }
  for (const line of document.querySelectorAll('#tech-lines line')) {
    const on = lvl(line.dataset.to) > 0;
    line.classList.toggle('on', on);
    line.style.stroke = on ? CATS[NODE[line.dataset.to].cat].color : '';
  }
  const panel = document.getElementById('tech-panel');
  if (!selected) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const x = NODE[selected];
  const l = lvl(x.id);
  const ic = document.getElementById('tp-icon');
  ic.textContent = x.icon;
  ic.style.borderColor = CATS[x.cat].color;
  document.getElementById('tp-name').textContent = x.name;
  document.getElementById('tp-level').textContent = x.max === 1 ? (l ? 'Unlocked' : 'Not unlocked') : `Level ${l} / ${x.max}`;
  document.getElementById('tp-desc').textContent = x.desc;
  const nowTxt = x.effect(l);
  const nextTxt = l < x.max ? x.effect(l + 1) : null;
  document.getElementById('tp-effect').innerHTML = x.max === 1 ? nowTxt : `Now: ${nowTxt}${nextTxt ? `<br>Next: ${nextTxt}` : ''}`;
  const reqs = [];
  for (const [id, need] of x.req) if (lvl(id) < need) reqs.push(`${NODE[id].name} level ${need}`);
  if (x.best && save.best < x.best) reqs.push(`Reach wave ${x.best} (best: ${save.best})`);
  document.getElementById('tp-req').textContent = reqs.length ? 'Requires: ' + reqs.join(', ') : '';
  const btn = document.getElementById('tp-buy');
  if (l >= x.max) { btn.textContent = 'MAXED'; btn.disabled = true; }
  else { btn.innerHTML = `BUY · <span style="color:#fff3a0">${fmt(nodeCost(x))}</span>`; btn.disabled = !canBuy(x); }
}

export function openTech(changed) {
  onChange = changed || (() => {});
  document.getElementById('tech').classList.remove('hidden');
  if (!built) buildTree();
  const r = document.getElementById('tech-view').getBoundingClientRect();
  view.s = Math.min(0.85, Math.max(0.35, Math.min(r.width, r.height) / 1500));
  view.x = r.width / 2; view.y = r.height / 2;
  els.apply();
  selected = null;
  refresh();
}
export function closeTech() {
  document.getElementById('tech').classList.add('hidden');
}
