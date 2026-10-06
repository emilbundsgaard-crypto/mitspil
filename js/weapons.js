// Weapon roster, ordered roughly by power. Damage is a multiplier on the soldier's base damage.
// pellets: bullets per shot · pierce: extra enemies passed · splash: explosion radius
// arc: lobbed projectile · chain: lightning jumps to nearby enemies
export const WEAPONS = [
  { id: 'pistol',   name: 'PISTOL',          icon: '🔫', rate: 2.2, dmg: 1.0,  speed: 48, color: 0xfff1a8, size: 0.9 },
  { id: 'revolver', name: 'REVOLVER',        icon: '🤠', rate: 1.8, dmg: 1.6,  speed: 52, color: 0xffe08a, size: 1.0, pierce: 1 },
  { id: 'uzi',      name: 'UZI',             icon: '🔫', rate: 6.0, dmg: 0.55, speed: 50, color: 0xffd95a, size: 0.8 },
  { id: 'tommy',    name: 'TOMMY GUN',       icon: '🎩', rate: 6.5, dmg: 0.6,  speed: 52, color: 0xffc94a, size: 0.85 },
  { id: 'mp5',      name: 'MP5',             icon: '🔫', rate: 7.0, dmg: 0.65, speed: 56, color: 0xffd36b, size: 0.85 },
  { id: 'shotgun',  name: 'SHOTGUN',         icon: '💥', rate: 1.4, dmg: 0.75, speed: 50, color: 0xffb347, size: 0.75, pellets: 5, spread: 0.22 },
  { id: 'double',   name: 'DOUBLE BARREL',   icon: '💥', rate: 1.1, dmg: 0.85, speed: 50, color: 0xffa040, size: 0.75, pellets: 8, spread: 0.32 },
  { id: 'hunting',  name: 'HUNTING RIFLE',   icon: '🦌', rate: 1.6, dmg: 4.2,  speed: 75, color: 0xfff4c0, size: 1.0, pierce: 2 },
  { id: 'm16',      name: 'M16',             icon: '🪖', rate: 5.5, dmg: 1.45, speed: 62, color: 0xffb860, size: 0.95 },
  { id: 'bullpup',  name: 'BULLPUP RIFLE',   icon: '🪖', rate: 7.0, dmg: 1.35, speed: 64, color: 0xffa95a, size: 0.95 },
  { id: 'sniper',   name: 'SNIPER RIFLE',    icon: '🎯', rate: 1.0, dmg: 11,   speed: 110, color: 0xffffff, size: 1.3, pierce: 5 },
  { id: 'grenade',  name: 'GRENADE LAUNCHER',icon: '🧨', rate: 1.5, dmg: 6,    speed: 34, color: 0x8fbf4a, size: 1.6, splash: 2.4, arc: true },
  { id: 'hmg',      name: 'HEAVY MACHINE GUN', icon: '💥', rate: 10, dmg: 1.25, speed: 66, color: 0xff8c42, size: 1.0 },
  { id: 'bazooka',  name: 'BAZOOKA',         icon: '🚀', rate: 0.9, dmg: 16,   speed: 32, color: 0xff5533, size: 2.0, splash: 3.4, rocket: true },
  { id: 'minigun',  name: 'MINIGUN',         icon: '🌀', rate: 18,  dmg: 0.95, speed: 70, color: 0xff6b3d, size: 0.9 },
  { id: 'laser',    name: 'LASER RIFLE',     icon: '🔆', rate: 8,   dmg: 2.6,  speed: 120, color: 0x5ff2ff, size: 1.3, pierce: 3, beam: true },
  { id: 'tesla',    name: 'TESLA GUN',       icon: '⚡', rate: 3,   dmg: 8,    speed: 90, color: 0x9fd8ff, size: 1.4, chain: 4 },
  { id: 'plasma',   name: 'PLASMA CANNON',   icon: '🟣', rate: 9,   dmg: 3.2,  speed: 80, color: 0xd277ff, size: 1.6, pierce: 2, splash: 1.4 },
];
export const WEAPON_INDEX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));
