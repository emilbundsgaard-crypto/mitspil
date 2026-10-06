// Tech tree: node data, derived run stats, and the pan/zoom tree UI.
import { save, persist, fmt } from './save.js';
import { sfx } from './audio.js';
import { WEAPONS } from './weapons.js';

// Re-exported so older `import { WEAPONS } from './tech.js'` keeps working.
export { WEAPONS };

export const CATS = {
  core:      { color: '#5fb7ff', name: 'Command', angle: 0 },
  squad:     { color: '#ffb020', name: 'Squad' },
  defense:   { color: '#8aa0b8', name: 'Defense' },
  firepower: { color: '#ff4d5e', name: 'Firepower' },
  weapons:   { color: '#a46bff', name: 'Weapons' },
  vehicles:  { color: '#9ad83c', name: 'Vehicles' },
  abilities: { color: '#ff8c42', name: 'Abilities' },
  economy:   { color: '#2fd27a', name: 'Economy' },
  supply:    { color: '#ffd84a', name: 'Supply' },
  gates:     { color: '#28c4ff', name: 'Gates' },
  skip:      { color: '#ff7ad9', name: 'Wave skip' },
};
// Clockwise sector order starting at "up".
const SECTOR_ORDER = ['squad', 'defense', 'firepower', 'weapons', 'vehicles', 'abilities', 'economy', 'supply', 'gates', 'skip'];

// Waves a run can start at (each needs its Head Start node and a best wave at least that high).
export const SKIP_WAVES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200];
const SKIP_COST = [100, 400, 1200, 3000, 6000, 12000, 30000, 80000, 180000, 500000, 2e6, 7e6, 2.5e7, 8e7, 2.5e8];

// Starting vehicles, weakest first (getStats().startVehicle is the best one unlocked).
const VEHICLE_ORDER = ['jeep', 'tank', 'heli', 'mech'];

// n(id, cat, icon, name, desc, max, cost, grow, req, effect(lv) -> text, extra)
function n(id, cat, icon, name, desc, max, cost, grow, req, effect, extra = {}) {
  return { id, cat, icon, name, desc, max, cost, grow, req, effect, ...extra };
}
const pct = (v) => `${Math.round(v * 100)}%`;
const times = (v) => `×${+v.toFixed(2)}`;
// round to two significant digits so generated prices look tidy
const nice = (v) => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.round(v / p) * p; };

// ---------------------------------------------------------------- starting weapons
// One unlock per weapon in weapons.js, in power order. Old saves keep their original node ids.
const WEAPON_TECH = {
  revolver: ['w_revolver', 'Sidearms'],
  uzi:      ['w_smg', 'SMG Training'],
  tommy:    ['w_tommy', 'Drum Magazines'],
  mp5:      ['w_mp5', 'Tactical SMGs'],
  shotgun:  ['w_shotgun', 'Breacher Corps'],
  double:   ['w_double', 'Double Trouble'],
  hunting:  ['w_hunting', 'Hunting Lodge'],
  m16:      ['w_rifle', 'Rifle Training'],
  bullpup:  ['w_bullpup', 'Bullpup Rifles'],
  sniper:   ['w_sniper', 'Sniper School'],
  grenade:  ['w_grenade', 'Grenade Launchers'],
  hmg:      ['w_mg', 'Heavy Weapons'],
  bazooka:  ['w_rocket', 'Rocket Division'],
  minigun:  ['w_mini', 'Minigun Corps'],
  laser:    ['w_laser', 'Laser Lab'],
  tesla:    ['w_tesla', 'Tesla Coils'],
  plasma:   ['w_plasma', 'Plasma Reactor'],
};
const titleCase = (s) => s.split(' ').map((w) => (/\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(' ');
function weaponDesc(w) {
  const t = [`${w.rate} shots/s`, `${w.dmg}x damage`];
  if (w.pellets) t.push(`${w.pellets} pellets per shot`);
  if (w.pierce) t.push(`pierces ${w.pierce} ${w.pierce === 1 ? 'enemy' : 'enemies'}`);
  if (w.splash) t.push('explodes on impact');
  if (w.chain) t.push(`lightning jumps between ${w.chain} enemies`);
  return `Start every run with the ${titleCase(w.name)}: ${t.join(', ')}.`;
}
const WEAPON_NODES = [];
for (let i = 1; i < WEAPONS.length; i++) {
  const w = WEAPONS[i];
  const [id, name] = WEAPON_TECH[w.id] || [`w_${w.id}`, `${titleCase(w.name)} Training`];
  const prev = WEAPON_NODES.length ? WEAPON_NODES[WEAPON_NODES.length - 1].id : 'core';
  WEAPON_NODES.push(n(id, 'weapons', w.icon, name, weaponDesc(w), 1, nice(55 * Math.pow(2.4, i - 1)), 1,
    [[prev, 1]], () => `Start: ${titleCase(w.name)}`, { weapon: i }));
}
const wid = (weaponId, fallback) => (WEAPON_TECH[weaponId] && WEAPONS.some((w) => w.id === weaponId) ? WEAPON_TECH[weaponId][0] : fallback);
const W_FIRST = WEAPON_NODES.length ? WEAPON_NODES[0].id : 'core';
const wAt = (weaponId, k) => wid(weaponId, WEAPON_NODES[Math.min(k, WEAPON_NODES.length - 1)]?.id || 'core');

export const NODES = [
  n('core', 'core', '🎖️', 'Command Center', 'The heart of your army. Everything grows from here.', 1, 0, 1, [], () => 'Online'),

  // ---------------------------------------------------------------- Squad: more men
  n('recruit', 'squad', '🧍', 'Recruits', 'Start every run with +1 soldier per level.', 10, 15, 1.3, [['core', 1]], (l) => `+${l} starting soldiers`),
  n('formation', 'squad', '🔷', 'Tight Formation', 'Soldiers pack closer together, making the squad easier to steer around danger.', 3, 100, 2.5, [['recruit', 2]], (l) => `-${l * 10}% squad spread`),
  n('barracks', 'squad', '🏠', 'Barracks', '+3 starting soldiers per level.', 10, 150, 1.3, [['recruit', 4]], (l) => `+${l * 3} starting soldiers`),
  n('medic', 'squad', '⛑️', 'Field Medic', 'Periodically revives a fallen soldier.', 8, 300, 1.4, [['barracks', 2]], (l) => l ? `+1 soldier every ${22 - l * 2}s` : 'Not trained'),
  n('veteran', 'squad', '🎗️', 'Veterans', 'Battle-hardened soldiers deal more damage.', 10, 900, 1.35, [['medic', 2]], (l) => `+${l * 6}% squad damage`),
  n('elite', 'squad', '⭐', 'Elite Training', 'Drill sergeants push every soldier harder: +10% squad damage per level.', 10, 20000, 1.35, [['veteran', 6]], (l) => `+${l * 10}% squad damage`),
  n('specops', 'squad', '🥷', 'Special Forces', 'Multiplies all squad damage by a further +25% per level.', 10, 1.5e6, 1.45, [['elite', 5]], (l) => `${times(1 + 0.25 * l)} squad damage`),
  n('commander', 'squad', '🦸', 'Hero Commander', 'A giant hero leads your squad, firing heavy rounds.', 5, 5000, 1.8, [['veteran', 3]], (l) => l ? `Hero deals ${l * 15}x damage` : 'No hero'),
  n('legend', 'squad', '🏅', 'Living Legend', 'Your hero commander gains +1 hero level per level (+15x hero damage).', 5, 200000, 2, [['commander', 5]], (l) => `+${l} hero level${l === 1 ? '' : 's'}`),
  n('reinforce', 'squad', '🪂', 'Reinforcements', 'Each cleared wave drops in +2 soldiers per level.', 10, 400, 1.32, [['barracks', 2]], (l) => `+${l * 2} soldiers per wave`),
  n('airborne', 'squad', '🛩️', 'Airborne Infantry', 'Transport planes drop +6 more soldiers after every cleared wave per level.', 10, 6000, 1.35, [['reinforce', 5]], (l) => `+${l * 6} soldiers per wave`),
  n('paratroop', 'squad', '🛫', 'Paratrooper Division', 'Whole companies jump in: +25 soldiers after every cleared wave per level.', 10, 1e6, 1.4, [['airborne', 6]], (l) => `+${l * 25} soldiers per wave`),
  n('battalion', 'squad', '🚩', 'Battalion', '+10 starting soldiers per level.', 10, 2500, 1.35, [['reinforce', 3]], (l) => `+${l * 10} starting soldiers`),
  n('mobilize', 'squad', '📢', 'Mass Mobilization', 'More soldiers march on the road at once (+40 per level). Extra soldiers still wait in reserve.', 7, 20000, 1.5, [['battalion', 3]], (l) => `${320 + l * 40} soldiers on the road`),
  n('legion', 'squad', '🏛️', 'Legion', '+25 starting soldiers per level.', 5, 30000, 1.5, [['battalion', 5]], (l) => `+${l * 25} starting soldiers`),
  n('division', 'squad', '🎌', 'Division', '+60 starting soldiers per level.', 5, 300000, 1.6, [['legion', 3]], (l) => `+${l * 60} starting soldiers`),
  n('army', 'squad', '🔱', 'Grand Army', '+150 starting soldiers per level.', 5, 1e7, 1.7, [['division', 3]], (l) => `+${l * 150} starting soldiers`),
  n('warhost', 'squad', '🌍', 'World War', 'Every nation sends its troops: +400 starting soldiers per level.', 5, 3e8, 1.8, [['army', 3]], (l) => `+${fmt(l * 400)} starting soldiers`),

  // ---------------------------------------------------------------- Defense
  n('armor', 'defense', '🦺', 'Body Armor', 'Chance that a soldier survives being hit.', 15, 40, 1.3, [['core', 1]], (l) => `${l * 3}% survive chance`),
  n('kevlar', 'defense', '🧥', 'Kevlar Weave', 'Even tougher armor: +2% survive chance per level.', 5, 25000, 1.6, [['armor', 15]], (l) => `+${l * 2}% survive chance`),
  n('laststand', 'defense', '🔥', 'Last Stand', 'With 10 or fewer soldiers, the squad deals bonus damage.', 8, 200, 1.35, [['armor', 2]], (l) => `+${l * 30}% damage when desperate`),
  n('berserk', 'defense', '😤', 'Berserker', 'Last Stand grows even stronger: +60% desperate damage per level.', 5, 15000, 1.6, [['laststand', 6]], (l) => `+${l * 60}% damage when desperate`),
  n('shield', 'defense', '🛡️', 'Energy Shield', 'Blocks enemy hits. Recharges every wave.', 10, 350, 1.35, [['armor', 4]], (l) => `Blocks ${l * 2} hits per wave`),
  n('bulwark', 'defense', '🧱', 'Bulwark', 'The energy shield blocks +6 more hits per wave per level.', 10, 5000, 1.4, [['shield', 6]], (l) => `+${l * 6} blocked hits per wave`),
  n('forcefield', 'defense', '🔰', 'Force Field', 'A huge dome over the squad: +25 blocked hits per wave per level.', 10, 800000, 1.45, [['bulwark', 5]], (l) => `+${l * 25} blocked hits per wave`),
  n('crash', 'defense', '🛢️', 'Crash Pads', 'Rolling barrels crush fewer soldiers.', 5, 500, 1.45, [['shield', 1]], (l) => `-${l * 15}% barrel losses`),
  n('boots', 'defense', '🥾', 'Stomp Boots', 'Boss stomps kill fewer soldiers.', 5, 1500, 1.5, [['shield', 3]], (l) => `-${l * 12}% stomp losses`),
  n('secondwind', 'defense', '💖', 'Second Wind', 'Once per run, when your squad is wiped, it comes back.', 3, 8000, 2, [['boots', 2]], (l) => l ? `Revive with ${l * 8} soldiers` : 'Inactive'),
  n('phoenix', 'defense', '🦅', 'Phoenix Protocol', 'Second Wind brings back +30 more soldiers per level.', 5, 200000, 1.8, [['secondwind', 3]], (l) => `+${l * 30} revived soldiers`),

  // ---------------------------------------------------------------- Firepower
  n('dmg1', 'firepower', '🎯', 'Hollow Points', '+20 damage per bullet.', 25, 10, 1.17, [['core', 1]], (l) => `+${l * 20} damage`),
  n('ap', 'firepower', '🔩', 'Armor Piercing', '+60 damage per bullet.', 20, 300, 1.2, [['dmg1', 10]], (l) => `+${l * 60} damage`),
  n('du', 'firepower', '☢️', 'Depleted Uranium', '+200 damage per bullet.', 15, 4000, 1.22, [['ap', 8]], (l) => `+${l * 200} damage`),
  n('anti', 'firepower', '⚛️', 'Antimatter Rounds', '+800 damage per bullet.', 10, 60000, 1.25, [['du', 8]], (l) => `+${l * 800} damage`),
  n('neutron', 'firepower', '💠', 'Neutron Rounds', '+3,000 damage per bullet.', 10, 1e6, 1.28, [['anti', 6]], (l) => `+${fmt(l * 3000)} damage`),
  n('graviton', 'firepower', '🔮', 'Graviton Rounds', '+12,000 damage per bullet.', 10, 2.5e7, 1.3, [['neutron', 6]], (l) => `+${fmt(l * 12000)} damage`),
  n('darkmatter', 'firepower', '🌑', 'Dark Matter Rounds', '+50,000 damage per bullet.', 10, 6e8, 1.32, [['graviton', 6]], (l) => `+${fmt(l * 50000)} damage`),
  n('singularity', 'firepower', '🕳️', 'Singularity Rounds', 'Every bullet carries a tiny black hole: +200,000 damage per bullet.', 10, 1.5e10, 1.35, [['darkmatter', 6]], (l) => `+${fmt(l * 200000)} damage`),
  n('ballistics', 'firepower', '📐', 'Ballistics Lab', 'Multiplies all bullet damage: +10% per level.', 20, 1500, 1.25, [['ap', 5]], (l) => `+${l * 10}% bullet damage`),
  n('overpressure', 'firepower', '🧪', 'Overpressure Loads', 'Hotter powder. Multiplies all bullet damage: +25% per level.', 10, 250000, 1.38, [['ballistics', 12]], (l) => `+${l * 25}% bullet damage`),
  n('rate1', 'firepower', '⏱️', 'Trigger Discipline', '+6% fire rate per level.', 15, 40, 1.25, [['dmg1', 3]], (l) => `+${l * 6}% fire rate`),
  n('rate2', 'firepower', '⚡', 'Hair Trigger', '+10% fire rate per level.', 10, 1200, 1.3, [['rate1', 8]], (l) => `+${l * 10}% fire rate`),
  n('rate3', 'firepower', '🔁', 'Rapid Cycling', 'Multiplies fire rate: +8% per level.', 10, 50000, 1.38, [['rate2', 6]], (l) => `+${l * 8}% fire rate`),
  n('rate4', 'firepower', '🏎️', 'Overclock', 'Multiplies fire rate: +10% per level.', 5, 5e6, 1.6, [['rate3', 6]], (l) => `+${l * 10}% fire rate`),
  n('range', 'firepower', '🔭', 'Long Barrels', 'Bullets fly faster and further.', 5, 120, 1.5, [['rate1', 1]], (l) => `+${l * 10}% range & speed`),
  n('crit', 'firepower', '💢', 'Critical Hits', 'Chance for bullets to crit.', 15, 150, 1.25, [['rate1', 3]], (l) => `${l * 3}% crit chance`),
  n('crit2', 'firepower', '👁️', 'Weak Spots', '+2% crit chance per level.', 10, 60000, 1.4, [['crit', 15]], (l) => `+${l * 2}% crit chance`),
  n('crit3', 'firepower', '🧿', 'Sixth Sense', '+2% crit chance per level.', 10, 2e7, 1.45, [['crit2', 6]], (l) => `+${l * 2}% crit chance`),
  n('critdmg', 'firepower', '💣', 'Devastation', 'Critical hits hit even harder.', 10, 900, 1.3, [['crit', 5]], (l) => `Crits deal ${(2 + l * 0.3).toFixed(1)}x`),
  n('critdmg2', 'firepower', '🪓', 'Executioner', 'Critical hits deal +1x more damage per level.', 10, 120000, 1.35, [['critdmg', 10]], (l) => `+${l}x crit damage`),
  n('critdmg3', 'firepower', '💀', 'Obliteration', 'Critical hits deal +3x more damage per level.', 10, 5e7, 1.4, [['critdmg2', 6]], (l) => `+${l * 3}x crit damage`),
  n('bossslayer', 'firepower', '🗡️', 'Boss Slayer', 'Extra damage against bosses.', 10, 2000, 1.3, [['critdmg', 2]], (l) => `+${l * 15}% boss damage`),
  n('giantkiller', 'firepower', '🏹', 'Giant Killer', '+40% boss damage per level.', 10, 150000, 1.4, [['bossslayer', 10]], (l) => `+${l * 40}% boss damage`),
  n('titanbane', 'firepower', '⚔️', 'Titan Bane', '+100% boss damage per level. Mega bosses fear you.', 10, 4e7, 1.45, [['giantkiller', 6]], (l) => `+${l * 100}% boss damage`),

  // ---------------------------------------------------------------- Weapons (starting weapon chain + perks)
  ...WEAPON_NODES,
  n('armory', 'weapons', '🗄️', 'Armory', 'Barrels drop weapon upgrades more often.', 5, 300, 1.5, [[W_FIRST, 1]], (l) => `+${l * 10}% weapon drops`),
  n('multishot', 'weapons', '🎆', 'Multishot', 'Chance for every bullet to split into two.', 10, 600, 1.3, [[wAt('tommy', 2), 1]], (l) => `${l * 8}% double shot`),
  n('pierce', 'weapons', '📌', 'Penetrator', 'Bullets pass through extra enemies at full damage.', 5, 3000, 1.6, [['multishot', 3]], (l) => `+${l} pierce`),
  n('multishot2', 'weapons', '⛈️', 'Bullet Storm', '+4% double shot chance per level.', 5, 80000, 1.6, [['multishot', 10]], (l) => `+${l * 4}% double shot`),
  n('pierce2', 'weapons', '🪡', 'Railgun Rounds', 'Bullets pass through +1 more enemy per level.', 5, 500000, 1.7, [['pierce', 5]], (l) => `+${l} pierce`),
  n('gunsmith', 'weapons', '🛠️', 'Gunsmith', 'Custom-tuned guns: +8% bullet damage per level.', 10, 4000, 1.35, [[wAt('shotgun', 4), 1]], (l) => `+${l * 8}% bullet damage`),
  n('fusion', 'weapons', '🔋', 'Fusion Cells', 'Energy-boosted ammo: +20% bullet damage per level.', 10, 3e7, 1.45, [[wAt('laser', 14), 1]], (l) => `+${l * 20}% bullet damage`),

  // ---------------------------------------------------------------- Vehicles
  n('motorpool', 'vehicles', '🔧', 'Motor Pool', 'Opens the vehicle line. Vehicles you drive get +15% HP per level.', 5, 250, 1.5, [['core', 1]], (l) => `+${l * 15}% vehicle HP`),
  n('v_jeep', 'vehicles', '🚙', 'Jeep Garage', 'Start every run with an armed Jeep.', 1, 1500, 1, [['motorpool', 1]], () => 'Start: Jeep', { vehicle: 'jeep' }),
  n('v_tank', 'vehicles', '🏭', 'Tank Factory', 'Start every run with a Battle Tank instead.', 1, 50000, 1, [['v_jeep', 1]], () => 'Start: Tank', { vehicle: 'tank' }),
  n('v_heli', 'vehicles', '🚁', 'Helipad', 'Start every run with an Attack Helicopter instead.', 1, 1.5e6, 1, [['v_tank', 1]], () => 'Start: Helicopter', { vehicle: 'heli' }),
  n('v_mech', 'vehicles', '🤖', 'Mech Bay', 'Start every run with a giant Battle Mech instead.', 1, 5e7, 1, [['v_heli', 1]], () => 'Start: Mech', { vehicle: 'mech' }),
  n('convoy', 'vehicles', '🚚', 'Convoy', 'Drive one more vehicle at the same time per level.', 2, 20000, 5, [['v_jeep', 1]], (l) => `${2 + l} vehicle slots`),
  n('column', 'vehicles', '🚛', 'Armored Column', 'Drive one more vehicle at the same time per level.', 2, 5e6, 5, [['convoy', 2]], (l) => `+${l} vehicle slots`),
  n('vplate', 'vehicles', '🪨', 'Reactive Armor', '+25% vehicle HP per level.', 10, 2000, 1.35, [['motorpool', 2]], (l) => `+${l * 25}% vehicle HP`),
  n('vplate2', 'vehicles', '⛓️', 'Composite Armor', 'Multiplies vehicle HP: +50% per level.', 10, 200000, 1.4, [['vplate', 6]], (l) => `${times(1 + 0.5 * l)} vehicle HP`),
  n('vplate3', 'vehicles', '💎', 'Nano Hull', 'Self-repairing hulls. Multiplies vehicle HP: +60% per level.', 5, 3e7, 1.6, [['vplate2', 6]], (l) => `${times(1 + 0.6 * l)} vehicle HP`),
  n('vgun', 'vehicles', '📡', 'Targeting Computers', 'Vehicle gunners hit harder: +20% vehicle damage per level.', 10, 2000, 1.35, [['motorpool', 2]], (l) => `+${l * 20}% vehicle damage`),
  n('vgun2', 'vehicles', '⚙️', 'Autocannons', 'Multiplies vehicle damage: +50% per level.', 10, 150000, 1.4, [['vgun', 6]], (l) => `${times(1 + 0.5 * l)} vehicle damage`),
  n('vgun3', 'vehicles', '☄️', 'Railgun Turrets', 'Multiplies vehicle damage: +100% per level.', 10, 2e7, 1.45, [['vgun2', 6]], (l) => `${times(1 + l)} vehicle damage`),

  // ---------------------------------------------------------------- Abilities
  n('grenade', 'abilities', '🧨', 'Grenadiers', 'Your squad throws grenades automatically.', 10, 60, 1.35, [['core', 1]], (l) => l ? `Grenade every ${(8 - l * 0.5).toFixed(1)}s` : 'No grenades'),
  n('airstrike', 'abilities', '✈️', 'Airstrike', 'Unlock the Airstrike ability (SPACE). More levels mean a shorter cooldown.', 10, 400, 1.3, [['grenade', 2]], (l) => l ? `${30 - l * 2}s cooldown` : 'Locked'),
  n('carpet', 'abilities', '🎇', 'Carpet Bombing', 'Airstrikes drop more bombs.', 5, 1500, 1.5, [['airstrike', 3]], (l) => `+${l * 2} bombs per strike`),
  n('carpet2', 'abilities', '🌋', 'Saturation Bombing', 'Airstrikes drop +2 more bombs per level.', 5, 40000, 1.7, [['carpet', 5]], (l) => `+${l * 2} bombs per strike`),
  n('nuke', 'abilities', '☢️', 'Tactical Nuke', 'Unlock the Nuke (N), which clears the whole road.', 5, 15000, 1.8, [['carpet', 2]], (l) => l ? `${120 - l * 15}s cooldown` : 'Locked'),
  n('drone', 'abilities', '🛸', 'Combat Drones', 'Flying drones fire alongside your squad.', 6, 800, 1.6, [['grenade', 3]], (l) => `${l} drone${l === 1 ? '' : 's'}`),
  n('swarm', 'abilities', '🐝', 'Drone Swarm', '+1 combat drone per level.', 4, 120000, 2.2, [['drone', 6]], (l) => `+${l} drone${l === 1 ? '' : 's'}`),

  // ---------------------------------------------------------------- Economy
  n('magnet', 'economy', '🧲', 'Coin Magnet', '+10% coins from everything.', 25, 20, 1.2, [['core', 1]], (l) => `+${l * 10}% coins`),
  n('magnet2', 'economy', '💸', 'Gold Rush', '+25% coins from everything per level.', 10, 25000, 1.35, [['magnet', 20]], (l) => `+${l * 25}% coins`),
  n('magnet3', 'economy', '🏰', 'Fort Knox', 'Multiplies all coins: +50% per level.', 10, 2e6, 1.45, [['magnet2', 6]], (l) => `${times(1 + 0.5 * l)} coins`),
  n('magnet4', 'economy', '🪐', 'Galactic Bank', 'Multiplies all coins: +100% per level.', 10, 5e8, 1.5, [['magnet3', 6]], (l) => `${times(1 + l)} coins`),
  n('bounty', 'economy', '💰', 'Bounty Hunter', 'Extra coins per kill.', 10, 150, 1.35, [['magnet', 3]], (l) => `+${l} coins per kill`),
  n('bounty2', 'economy', '🕵️', 'Headhunter', '+4 coins per kill per level.', 10, 30000, 1.35, [['bounty', 10]], (l) => `+${l * 4} coins per kill`),
  n('bounty3', 'economy', '⚜️', 'Mercenary Guild', '+15 coins per kill per level.', 10, 5e6, 1.4, [['bounty2', 6]], (l) => `+${l * 15} coins per kill`),
  n('treasure', 'economy', '🎁', 'Treasure Hunter', 'Barrels drop coin chests more often, and bigger ones.', 10, 600, 1.35, [['bounty', 2]], (l) => `+${l * 20}% chest value`),
  n('treasure2', 'economy', '🗺️', 'Treasure Maps', 'Coin chests get even more common and valuable.', 10, 40000, 1.4, [['treasure', 10]], (l) => `+${l * 20}% chest value`),
  n('golden', 'economy', '🪙', 'Golden Touch', 'Tiny chance any kill pays out 25x.', 10, 3000, 1.4, [['treasure', 3]], (l) => `${(l * 0.5).toFixed(1)}% jackpot chance`),
  n('golden2', 'economy', '🎰', 'Midas Touch', '+0.3% jackpot chance per level.', 10, 150000, 1.45, [['golden', 10]], (l) => `+${(l * 0.3).toFixed(1)}% jackpot chance`),
  n('bonds', 'economy', '📜', 'War Bonds', 'Bigger rewards for clearing waves.', 10, 300, 1.3, [['magnet', 5]], (l) => `+${l * 25}% wave rewards`),
  n('bonds2', 'economy', '📈', 'War Profits', '+60% wave clear rewards per level.', 10, 50000, 1.35, [['bonds', 10]], (l) => `+${l * 60}% wave rewards`),
  n('bossloot', 'economy', '👑', 'Boss Loot', 'Bosses drop more coins.', 10, 1200, 1.3, [['bonds', 2]], (l) => `+${l * 50}% boss coins`),
  n('bossloot2', 'economy', '🐉', 'Dragon Hoard', '+100% boss coins per level.', 10, 120000, 1.35, [['bossloot', 10]], (l) => `+${l * 100}% boss coins`),
  n('interest', 'economy', '🏦', 'Interest', 'After each run, earn interest on your banked coins.', 5, 5000, 1.6, [['bonds', 4]], (l) => `${l * 2}% interest (max ${fmt(l * 5000)})`),
  n('interest2', 'economy', '💹', 'Compound Interest', 'Even more interest after each run: +2% and a higher cap per level.', 5, 25000, 1.6, [['interest', 5]], (l) => `+${l * 2}% interest (max +${fmt(l * 5000)})`),

  // ---------------------------------------------------------------- Supply: pickups, buffs, rescues
  n('scavenger', 'supply', '🎒', 'Scavengers', '+5% chance per level that supplies on the road come in pairs.', 10, 120, 1.35, [['core', 1]], (l) => `+${l * 5}% pickups`),
  n('stims', 'supply', '💉', 'Stim Packs', 'Power-up buffs last 10% longer per level.', 10, 300, 1.35, [['scavenger', 2]], (l) => `+${l * 10}% buff duration`),
  n('adrenaline', 'supply', '🫀', 'Adrenaline', 'Power-up buffs last +10% longer per level.', 10, 25000, 1.4, [['stims', 10]], (l) => `+${l * 10}% buff duration`),
  n('overdrive', 'supply', '⚗️', 'Overdrive Serum', 'Power-up buffs last +10% longer per level.', 5, 4e6, 1.6, [['adrenaline', 6]], (l) => `+${l * 10}% buff duration`),
  n('rescue', 'supply', '🆘', 'Search & Rescue', 'Groups of stranded soldiers waiting for rescue are 10% bigger per level.', 10, 400, 1.35, [['scavenger', 3]], (l) => `+${l * 10}% rescued soldiers`),
  n('liberation', 'supply', '🗽', 'Liberation', 'Rescue groups are +15% bigger per level.', 10, 30000, 1.4, [['rescue', 10]], (l) => `+${l * 15}% rescued soldiers`),
  n('resistance', 'supply', '✊', 'Resistance Network', 'Whole villages join you: rescue groups +30% bigger per level.', 5, 3e6, 1.6, [['liberation', 6]], (l) => `+${l * 30}% rescued soldiers`),
  n('logistics', 'supply', '📦', 'Logistics Corps', '+3% more pickups per level.', 10, 12000, 1.4, [['scavenger', 10]], (l) => `+${l * 3}% pickups`),
  n('airdrop', 'supply', '🛬', 'Air Drops', '+4% more pickups per level.', 5, 2e6, 1.7, [['logistics', 6]], (l) => `+${l * 4}% pickups`),

  // ---------------------------------------------------------------- Gates
  n('gplus', 'gates', '➕', 'Gate Hacker', 'Every + gate gives more soldiers.', 15, 30, 1.25, [['core', 1]], (l) => `+${l} on every + gate`),
  n('gplus2', 'gates', '⏫', 'Gate Overclock', '+4 soldiers on every + gate per level.', 15, 2500, 1.3, [['gplus', 15]], (l) => `+${l * 4} on every + gate`),
  n('gplus3', 'gates', '♾️', 'Quantum Gates', '+20 soldiers on every + gate per level.', 10, 300000, 1.4, [['gplus2', 10]], (l) => `+${l * 20} on every + gate`),
  n('gshoot', 'gates', '🔫', 'Gate Shooter', 'Shooting a gate raises its value faster.', 5, 200, 1.5, [['gplus', 2]], (l) => `+${l * 30}% gate charge speed`),
  n('gshoot2', 'gates', '🔨', 'Gate Breaker', 'Shooting gates charges them +40% faster per level.', 5, 6000, 1.5, [['gshoot', 5]], (l) => `+${l * 40}% gate charge speed`),
  n('gminus', 'gates', '🧯', 'Damage Control', 'Negative gates take fewer soldiers.', 8, 400, 1.35, [['gshoot', 1]], (l) => `-${l * 8}% losses from − and ÷`),
  n('gminus2', 'gates', '🚪', 'Blast Doors', 'Negative gates take -3% fewer soldiers per level.', 5, 15000, 1.6, [['gminus', 8]], (l) => `-${l * 3}% losses from − and ÷`),
  n('gmult', 'gates', '✖️', 'Multiplier Mastery', 'Multiplier gates give bonus soldiers.', 10, 800, 1.35, [['gplus', 5]], (l) => `+${l * 10}% from × gates`),
  n('gmult2', 'gates', '✴️', 'Exponential Gates', 'Multiplier gates give +10% more soldiers per level.', 10, 50000, 1.4, [['gmult', 10]], (l) => `+${l * 10}% from × gates`),
  n('glucky', 'gates', '🌟', 'Lucky Gates', 'Chance for a golden mega gate to appear.', 5, 3000, 1.6, [['gmult', 3]], (l) => `${l * 4}% golden gate chance`),
  n('glucky2', 'gates', '🌠', 'Midas Gates', '+3% golden gate chance per level.', 5, 250000, 1.6, [['glucky', 5]], (l) => `+${l * 3}% golden gate chance`),

  // ---------------------------------------------------------------- Wave skip chain
  ...SKIP_WAVES.map((w, i) => n(`skip${w}`, 'skip', w <= 20 ? '⏩' : w <= 60 ? '🚀' : w < 200 ? '🌌' : '🏆', `Head Start ${w}`,
    `Unlock starting a run at wave ${w}. You also get bonus soldiers to survive the jump. Requires reaching wave ${w}.`,
    1, SKIP_COST[i], 1, [[i ? `skip${SKIP_WAVES[i - 1]}` : 'core', 1]], () => `Start at wave ${w}`, { best: w })),
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
  for (const x of NODES) { if (x.id === 'core') continue; have += Math.min(lvl(x.id), x.max); total += x.max; }
  return { have, total };
}

export function startWaves() {
  return [1, ...SKIP_WAVES.filter((w) => lvl(`skip${w}`) > 0)];
}

// Everything the run needs, derived from tech levels.
export function getStats() {
  const L = (id) => Math.min(lvl(id), NODE[id] ? NODE[id].max : 0);
  let startWeapon = 0;
  let startVehicle = null;
  for (const x of NODES) {
    if (!L(x.id)) continue;
    if (x.weapon) startWeapon = Math.max(startWeapon, x.weapon);
    if (x.vehicle && VEHICLE_ORDER.indexOf(x.vehicle) > VEHICLE_ORDER.indexOf(startVehicle)) startVehicle = x.vehicle;
  }
  const flatDmg = 100 + 20 * L('dmg1') + 60 * L('ap') + 200 * L('du') + 800 * L('anti')
    + 3000 * L('neutron') + 12000 * L('graviton') + 50000 * L('darkmatter') + 200000 * L('singularity');
  return {
    startMen: 3 + L('recruit') + 3 * L('barracks') + 10 * L('battalion') + 25 * L('legion')
      + 60 * L('division') + 150 * L('army') + 400 * L('warhost'),
    spacing: 0.62 * (1 - 0.1 * L('formation')),
    medicInterval: L('medic') ? 22 - 2 * L('medic') : 0,
    veteran: (1 + 0.06 * L('veteran') + 0.1 * L('elite')) * (1 + 0.25 * L('specops')),
    commander: L('commander') + L('legend'),
    reinforce: 2 * L('reinforce') + 6 * L('airborne') + 25 * L('paratroop'),
    dodge: 0.03 * L('armor') + 0.02 * L('kevlar'),
    lastStand: 0.3 * L('laststand') + 0.6 * L('berserk'),
    shieldHits: 2 * L('shield') + 6 * L('bulwark') + 25 * L('forcefield'),
    crash: 1 - 0.15 * L('crash'),
    boots: 1 - 0.12 * L('boots'),
    secondWind: 8 * L('secondwind') + 30 * L('phoenix'),
    dmg: flatDmg * (1 + 0.1 * L('ballistics')) * (1 + 0.25 * L('overpressure')) * (1 + 0.08 * L('gunsmith')) * (1 + 0.2 * L('fusion')),
    rateMult: (1 + 0.06 * L('rate1')) * (1 + 0.1 * L('rate2')) * (1 + 0.08 * L('rate3')) * (1 + 0.1 * L('rate4')),
    rangeMult: 1 + 0.1 * L('range'),
    crit: 0.03 * L('crit') + 0.02 * L('crit2') + 0.02 * L('crit3'),
    critMult: 2 + 0.3 * L('critdmg') + L('critdmg2') + 3 * L('critdmg3'),
    bossMult: 1 + 0.15 * L('bossslayer') + 0.4 * L('giantkiller') + L('titanbane'),
    gatePlus: L('gplus') + 4 * L('gplus2') + 20 * L('gplus3'),
    gateShoot: 1 + 0.3 * L('gshoot') + 0.4 * L('gshoot2'),
    gateMinus: 1 - 0.08 * L('gminus') - 0.03 * L('gminus2'),
    gateMult: 0.1 * L('gmult') + 0.1 * L('gmult2'),
    goldenGate: 0.04 * L('glucky') + 0.03 * L('glucky2'),
    coinMult: (1 + 0.1 * L('magnet') + 0.25 * L('magnet2')) * (1 + 0.5 * L('magnet3')) * (1 + L('magnet4')),
    bounty: L('bounty') + 4 * L('bounty2') + 15 * L('bounty3'),
    bonds: 1 + 0.25 * L('bonds') + 0.6 * L('bonds2'),
    bossLoot: 1 + 0.5 * L('bossloot') + L('bossloot2'),
    treasure: L('treasure') + L('treasure2'),
    jackpot: 0.005 * L('golden') + 0.003 * L('golden2'),
    interest: L('interest') + L('interest2'),
    grenade: L('grenade'),
    airstrike: L('airstrike'),
    carpet: L('carpet') + L('carpet2'),
    nuke: L('nuke'),
    drones: L('drone') + L('swarm'),
    startWeapon,
    armory: 0.1 * L('armory'),
    multishot: 0.08 * L('multishot') + 0.04 * L('multishot2'),
    pierce: L('pierce') + L('pierce2'),
    // pickups & rescues
    pickupRate: 1 + 0.05 * L('scavenger') + 0.03 * L('logistics') + 0.04 * L('airdrop'),
    buffTime: 1 + 0.1 * (L('stims') + L('adrenaline') + L('overdrive')),
    rescue: 1 + 0.1 * L('rescue') + 0.15 * L('liberation') + 0.3 * L('resistance'),
    maxSquad: 320 + 40 * L('mobilize'),
    // vehicles
    vehicleHp: (1 + 0.15 * L('motorpool') + 0.25 * L('vplate')) * (1 + 0.5 * L('vplate2')) * (1 + 0.6 * L('vplate3')),
    vehicleDmg: (1 + 0.2 * L('vgun')) * (1 + 0.5 * L('vgun2')) * (1 + L('vgun3')),
    vehicleSlots: 2 + L('convoy') + L('column'),
    startVehicle,
  };
}

// ---------------------------------------------------------------- Tree UI
const STEP = 150;   // radial distance between rings
const GAP = 134;    // minimum centre distance between neighbours on the same ring
const PAD = 70;     // empty arc between sectors, in px measured on the first ring
const R0 = 220;     // smallest allowed radius of the first ring (grown until everything fits)
let built = false;
let firstRing = R0;
let view = { x: 0, y: 0, s: 0.75 };
let selected = null;
let onChange = () => {};
const els = {};

// Radial tidy-tree layout. Every node sits on ring `depth` (depth = steps from the core along the
// first requirement). Each subtree reserves at least the arc its root needs on its ring (GAP px),
// so nodes on the same ring never get closer than GAP and different rings are STEP apart.
export function layout() {
  const kids = {};
  for (const x of NODES) {
    if (x.id === 'core') continue;
    const p = x.req.length && NODE[x.req[0][0]] ? x.req[0][0] : 'core';
    (kids[p] = kids[p] || []).push(x.id);
  }
  const roots = kids.core || [];
  const order = [...SECTOR_ORDER, ...Object.keys(CATS).filter((c) => !SECTOR_ORDER.includes(c))];
  const sectors = order.map((cat) => ({ cat, roots: roots.filter((id) => NODE[id].cat === cat), w: 0 })).filter((s) => s.roots.length);
  const arcFor = (r) => 2 * Math.asin(Math.min(1, GAP / (2 * r)));
  let r0 = R0, need = {}, total = 0;
  for (;;) {
    need = {};
    const rec = (id, d) => {
      let s = 0;
      for (const k of kids[id] || []) s += rec(k, d + 1);
      return (need[id] = Math.max(s, arcFor(r0 + d * STEP)));
    };
    for (const id of roots) rec(id, 0);
    for (const s of sectors) s.w = s.roots.reduce((t, id) => t + need[id], 0);
    total = sectors.reduce((t, s) => t + s.w + PAD / r0, 0);
    if (total <= Math.PI * 2 || r0 > 5000) break;
    r0 += 10;
  }
  const spare = Math.max(0, Math.PI * 2 - total);
  const sumW = sectors.reduce((t, s) => t + s.w, 0) || 1;
  const pos = { core: { x: 0, y: 0, a: 0, r: 0 } };
  const place = (id, d, a0, a1) => {
    const r = r0 + d * STEP, mid = (a0 + a1) / 2;
    pos[id] = { x: Math.sin(mid) * r, y: -Math.cos(mid) * r, a: mid, r };
    const ks = kids[id] || [];
    const tot = ks.reduce((t, k) => t + need[k], 0);
    let c = a0;
    for (const k of ks) {
      const span = (a1 - a0) * (need[k] / tot);
      place(k, d + 1, c, c + span);
      c += span;
    }
  };
  const spanOf = (s) => s.w + PAD / r0 + spare * (s.w / sumW);
  let a = sectors.length ? -spanOf(sectors[0]) / 2 : 0; // centre the first sector ("squad") on top
  for (const s of sectors) {
    const span = spanOf(s);
    const usable = span - PAD / r0;
    let c = a + PAD / r0 / 2;
    for (const id of s.roots) {
      const sp = usable * (need[id] / s.w);
      place(id, 0, c, c + sp);
      c += sp;
    }
    s.a0 = a; s.a1 = a + span;
    a += span;
  }
  pos._sectors = sectors.map((s) => ({ cat: s.cat, a0: s.a0, a1: s.a1 }));
  pos._r0 = r0;
  return pos;
}

function buildLegend() {
  const legend = document.querySelector('#tech .tech-legend');
  if (!legend) return;
  const hint = legend.querySelector('.hint');
  legend.innerHTML = SECTOR_ORDER.map((c) => `<span><i style="background:${CATS[c].color}"></i>${CATS[c].name}</span>`).join('');
  if (hint) legend.appendChild(hint);
}

function buildTree() {
  const pos = layout();
  firstRing = pos._r0;
  const nodesEl = document.getElementById('tech-nodes');
  const svg = document.getElementById('tech-lines');
  nodesEl.innerHTML = '';
  svg.innerHTML = '';
  buildLegend();
  for (const x of NODES) {
    for (const [rid] of x.req) {
      const a = pos[rid], b = pos[x.id];
      if (!a || !b) continue;
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
      moved += 10;
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
    const ns = Math.min(1.6, Math.max(0.12, view.s * f));
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
    el.querySelector('.lv').textContent = x.id === 'core' ? 'HQ' : x.max === 1 ? (l ? '✓' : fmt(nodeCost(x))) : `${Math.min(l, x.max)}/${x.max}`;
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
  const l = Math.min(lvl(x.id), x.max);
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
  for (const [id, need] of x.req) if (lvl(id) < need) reqs.push(NODE[id].max === 1 ? NODE[id].name : `${NODE[id].name} level ${need}`);
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
  // frame the core and the first ring of the (huge) tree
  view.s = Math.min(0.8, Math.max(0.15, (Math.min(r.width, r.height) / 2 - 30) / (firstRing + 70)));
  view.x = r.width / 2; view.y = r.height / 2;
  els.apply();
  selected = null;
  refresh();
}
export function closeTech() {
  document.getElementById('tech').classList.add('hidden');
}
