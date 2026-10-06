// 3D building blocks: vertex-coloured soldiers & guns, props, bosses, vehicles and the scrolling world.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/BufferGeometryUtils.js';
import { WEAPONS } from './weapons.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4();

// ------------------------------------------------------------ geometry helpers
// P: clone a geometry, transform it and bake a vertex colour into it.
export function P(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m4.compose(V(x, y, z), _q, V(sx, sy, sz));
  g.applyMatrix4(_m4);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export function limb(a, b, r, color) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 10).toNonIndexed();
  g.deleteAttribute('uv');
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)));
  return P(g, color);
}
export const merge = (parts) => mergeGeometries(parts.flat(), false);
export const box = (w, h, d, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => P(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
export const cylZ = (r, len, c, x = 0, y = 0, z = 0, seg = 12) => P(new THREE.CylinderGeometry(r, r, len, seg), c, x, y, z, Math.PI / 2);
export const cylX = (r, len, c, x = 0, y = 0, z = 0, seg = 12) => P(new THREE.CylinderGeometry(r, r, len, seg), c, x, y, z, 0, 0, Math.PI / 2);
export const cylY = (r, len, c, x = 0, y = 0, z = 0, seg = 12, r2 = r) => P(new THREE.CylinderGeometry(r, r2, len, seg), c, x, y, z);
export const sph = (r, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 14) => P(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)), c, x, y, z, 0, 0, 0, sx, sy, sz);

export const unitMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });
export const gunMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.55 });
export const propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
// a vertex-coloured mesh from merged parts
export function vmesh(parts, mat = propMaterial) {
  const m = new THREE.Mesh(merge(parts), mat);
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------ guns (barrel points to -z, grip at origin)
const M = 0x2b2f36, M2 = 0x4a515c, S = 0xb9c0cb, W = 0x8b5a2b, W2 = 0xb0743a, O = 0x5d6b3a, B = 0x1c1f25;
const grip = (z = 0, c = B) => box(0.045, 0.13, 0.06, c, 0, -0.01, z, 0.3);
const GUNS = {
  pistol: () => ({ fore: -0.04, parts: [box(0.06, 0.08, 0.26, M2, 0, 0.07, -0.1), box(0.066, 0.05, 0.27, M, 0, 0.12, -0.1), grip(0)] }),
  revolver: () => ({ fore: -0.04, parts: [cylZ(0.024, 0.22, S, 0, 0.1, -0.24), box(0.05, 0.07, 0.11, S, 0, 0.09, -0.06), cylZ(0.052, 0.08, M2, 0, 0.08, -0.08, 8), box(0.05, 0.14, 0.07, W, 0, 0, 0.02, 0.35)] }),
  uzi: () => ({ fore: -0.2, parts: [box(0.07, 0.1, 0.28, M, 0, 0.08, -0.1), cylZ(0.018, 0.07, M2, 0, 0.085, -0.27), box(0.045, 0.22, 0.05, B, 0, -0.03, -0.06), box(0.02, 0.05, 0.2, M2, 0, 0.08, 0.13), box(0.04, 0.03, 0.04, M2, 0, 0.14, -0.2)] }),
  tommy: () => ({ fore: -0.22, parts: [box(0.07, 0.09, 0.3, M, 0, 0.08, -0.08), cylZ(0.026, 0.24, M2, 0, 0.085, -0.34), cylZ(0.036, 0.12, M, 0, 0.085, -0.28, 8), box(0.06, 0.12, 0.28, W, 0, 0.04, 0.22), box(0.045, 0.12, 0.05, W, 0, 0, -0.22), cylX(0.1, 0.06, M2, 0, -0.03, -0.08, 16), grip(0.02, W)] }),
  mp5: () => ({ fore: -0.26, parts: [box(0.065, 0.1, 0.34, M, 0, 0.08, -0.1), box(0.075, 0.075, 0.15, B, 0, 0.07, -0.26), cylZ(0.018, 0.09, M, 0, 0.08, -0.37), box(0.04, 0.18, 0.06, M2, 0, -0.04, -0.14, -0.35), box(0.025, 0.07, 0.22, M2, 0, 0.08, 0.17), grip(0)] }),
  shotgun: () => ({ fore: -0.33, parts: [cylZ(0.027, 0.62, M, 0, 0.11, -0.3), cylZ(0.022, 0.45, M2, 0, 0.07, -0.24), box(0.065, 0.065, 0.17, W, 0, 0.07, -0.33), box(0.06, 0.1, 0.2, M, 0, 0.09, 0), box(0.055, 0.11, 0.3, W, 0, 0.06, 0.25, 0.1), grip(0.02, W)] }),
  double: () => ({ fore: -0.24, parts: [cylZ(0.027, 0.66, S, -0.028, 0.1, -0.32), cylZ(0.027, 0.66, S, 0.028, 0.1, -0.32), box(0.075, 0.05, 0.25, W, 0, 0.065, -0.22), box(0.07, 0.08, 0.12, S, 0, 0.08, 0), box(0.06, 0.12, 0.32, W2, 0, 0.05, 0.22, 0.12)] }),
  hunting: () => ({ fore: -0.35, parts: [cylZ(0.02, 0.74, M, 0, 0.11, -0.37), box(0.06, 0.07, 0.65, W2, 0, 0.07, -0.1), box(0.06, 0.13, 0.25, W2, 0, 0.04, 0.32, 0.12), cylX(0.015, 0.08, S, 0.05, 0.12, 0.02), cylZ(0.03, 0.22, B, 0, 0.17, -0.05), grip(0.03, W2)] }),
  m16: () => ({ fore: -0.3, parts: [box(0.065, 0.11, 0.3, M, 0, 0.08, -0.02), box(0.025, 0.05, 0.16, M, 0, 0.16, -0.02), cylZ(0.045, 0.28, M2, 0, 0.08, -0.3), cylZ(0.016, 0.17, M, 0, 0.08, -0.52), box(0.02, 0.09, 0.02, M, 0, 0.13, -0.42), box(0.055, 0.1, 0.26, M, 0, 0.06, 0.26), box(0.045, 0.16, 0.07, M2, 0, -0.04, -0.06, -0.25), grip(0.03)] }),
  bullpup: () => ({ fore: -0.3, parts: [box(0.075, 0.15, 0.6, M2, 0, 0.07, -0.05), box(0.025, 0.06, 0.42, B, 0, 0.18, -0.1), cylZ(0.018, 0.16, M, 0, 0.08, -0.44), box(0.045, 0.15, 0.07, M, 0, -0.04, 0.14, -0.2), box(0.08, 0.04, 0.2, B, 0, 0.0, -0.25), grip(-0.08)] }),
  sniper: () => ({ fore: -0.28, parts: [cylZ(0.018, 0.58, M, 0, 0.1, -0.56), box(0.06, 0.09, 0.5, M, 0, 0.08, -0.06), box(0.066, 0.08, 0.25, W2, 0, 0.075, -0.25), box(0.05, 0.15, 0.3, W2, 0, 0.05, 0.32), cylZ(0.036, 0.34, B, 0, 0.19, -0.06), cylZ(0.042, 0.03, 0x6fd3ff, 0, 0.19, -0.24), box(0.03, 0.05, 0.03, B, 0, 0.14, -0.13), box(0.03, 0.05, 0.03, B, 0, 0.14, 0.03), box(0.04, 0.14, 0.07, M2, 0, -0.03, -0.04), grip(0.06)] }),
  grenade: () => ({ fore: -0.3, parts: [cylZ(0.11, 0.17, M2, 0, 0.06, -0.06, 10), cylZ(0.056, 0.36, M, 0, 0.08, -0.33), cylZ(0.064, 0.05, B, 0, 0.08, -0.5), box(0.03, 0.07, 0.3, M, 0, 0.1, 0.24), box(0.04, 0.12, 0.05, B, 0, -0.03, -0.3), grip(0.08)] }),
  hmg: () => ({ fore: -0.36, parts: [box(0.1, 0.13, 0.42, M, 0, 0.09, -0.02), cylZ(0.052, 0.36, M2, 0, 0.1, -0.4, 10), cylZ(0.026, 0.22, M, 0, 0.1, -0.68), box(0.14, 0.14, 0.18, O, 0.13, 0.02, -0.06), box(0.03, 0.05, 0.12, 0xc9a227, 0.06, 0.09, -0.1), box(0.02, 0.07, 0.14, B, 0, 0.2, -0.1), box(0.08, 0.04, 0.04, B, 0, 0.1, -0.58), grip(0.12)] }),
  bazooka: () => ({ fore: -0.3, parts: [cylZ(0.078, 1.05, O, 0, 0.16, -0.12, 14), cylZ(0.088, 0.05, M, 0, 0.16, 0.38, 14), cylZ(0.088, 0.05, M, 0, 0.16, -0.62, 14), P(new THREE.ConeGeometry(0.11, 0.28, 12), M2, 0, 0.16, -0.78, -Math.PI / 2), cylZ(0.06, 0.12, 0x7c8a4a, 0, 0.16, -0.66, 10), box(0.04, 0.12, 0.05, B, 0, 0.03, 0), box(0.04, 0.12, 0.05, B, 0, 0.03, -0.3), box(0.03, 0.08, 0.06, M, -0.09, 0.24, -0.2)] }),
  minigun: () => ({
    fore: -0.2,
    parts: [...Array.from({ length: 6 }, (_, i) => cylZ(0.017, 0.56, M, Math.cos((i / 6) * 6.28) * 0.047, 0.1 + Math.sin((i / 6) * 6.28) * 0.047, -0.4, 6)),
      cylZ(0.088, 0.26, M2, 0, 0.1, -0.02, 14), cylZ(0.072, 0.04, M, 0, 0.1, -0.52, 12), cylZ(0.072, 0.04, M, 0, 0.1, -0.32, 12), box(0.03, 0.06, 0.22, B, 0, 0.22, -0.05), box(0.15, 0.14, 0.2, O, 0.14, 0.02, 0.0), grip(0.08)],
  }),
  laser: () => ({ fore: -0.3, parts: [box(0.08, 0.12, 0.55, 0xe8edf5, 0, 0.08, -0.1), box(0.012, 0.03, 0.45, 0x2fe6ff, 0.043, 0.09, -0.1), box(0.012, 0.03, 0.45, 0x2fe6ff, -0.043, 0.09, -0.1), cylZ(0.03, 0.22, 0x2fe6ff, 0, 0.08, -0.47), cylZ(0.046, 0.05, M, 0, 0.08, -0.37), box(0.05, 0.1, 0.2, M2, 0, 0.06, 0.24), box(0.03, 0.04, 0.16, 0xe8edf5, 0, 0.16, -0.05), grip(0.03)] }),
  tesla: () => ({ fore: -0.25, parts: [box(0.08, 0.11, 0.4, M2, 0, 0.08, -0.05), cylZ(0.05, 0.3, 0xd08a2b, 0, 0.1, -0.36), cylZ(0.066, 0.025, 0xffc531, 0, 0.1, -0.26), cylZ(0.066, 0.025, 0xffc531, 0, 0.1, -0.34), cylZ(0.066, 0.025, 0xffc531, 0, 0.1, -0.42), sph(0.075, 0x9fe4ff, 0, 0.1, -0.56), cylZ(0.05, 0.2, 0x2f8bff, 0, 0.18, 0), grip(0.04)] }),
  plasma: () => ({ fore: -0.3, parts: [box(0.12, 0.15, 0.5, 0x3a2366, 0, 0.08, -0.08), cylZ(0.045, 0.3, 0xf0a0ff, 0, 0.17, -0.1), cylZ(0.062, 0.2, 0x5a3a99, 0, 0.08, -0.43), cylZ(0.078, 0.04, 0xf0a0ff, 0, 0.08, -0.54), box(0.125, 0.03, 0.3, 0xf0a0ff, 0, 0.02, -0.12), grip(0.06)] }),
};
const gunCache = {};
export function gunGeometry(id) {
  if (!gunCache[id]) { const g = GUNS[id](); gunCache[id] = { geo: merge(g.parts), fore: g.fore }; }
  return gunCache[id];
}
// big floating gun used for pickups / barrel rewards
export function gunMesh(index, scale = 3.2) {
  const { geo } = gunGeometry(WEAPONS[index].id);
  const m = new THREE.Mesh(geo, gunMaterial);
  m.scale.setScalar(scale);
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------ soldiers
// Everything faces -z. Returns geometries for: torso (static), legs and arms (animated around pivots).
export const HIP = [0.1, 0.44, 0];
export const SHOULDER = [0.25, 0.8, 0];
const GUN_AT = V(0.07, 0.6, -0.2), GUN_SCALE = 1.35;

export function soldierGeos(p) {
  const t = [];
  const skin = p.skin;
  t.push(sph(0.27, skin, 0, 1.0, 0, 1, 0.97, 1, 18));
  for (const s of [-1, 1]) {
    t.push(sph(0.06, skin, s * 0.265, 0.98, 0.01, 0.6, 1, 1, 8));
    t.push(sph(0.043, 0x1b1f2a, s * 0.095, 0.99, -0.236, 1, 1.25, 0.6, 10));
    t.push(sph(0.014, 0xffffff, s * 0.085, 1.01, -0.262, 1, 1, 1, 6));
    t.push(box(0.075, 0.022, 0.02, p.brow || 0x4a2f1d, s * 0.095, 1.075, -0.245, 0, 0, s * (p.angry ? 0.35 : -0.1)));
    if (p.cheeks) t.push(sph(0.04, 0xff9aa0, s * 0.15, 0.92, -0.22, 1, 0.6, 0.4, 8));
  }
  t.push(sph(0.038, p.nose || 0xf2b58c, 0, 0.95, -0.27, 1, 1, 1, 8));
  t.push(box(0.08, 0.018, 0.02, 0x7a3a2a, 0, 0.885, -0.255));
  const hat = p.hat || 'helmet';
  if (hat === 'helmet' || hat === 'spiked') {
    t.push(P(new THREE.SphereGeometry(0.285, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), p.helmet, 0, 1.08, 0.01, 0, 0, 0, 1, 0.85, 1.04));
    t.push(cylY(0.305, 0.04, p.helmet2 || p.helmet, 0, 1.08, -0.01, 22, 0.315));
    t.push(cylY(0.289, 0.045, p.band || 0x2a2a2a, 0, 1.11, 0.01, 20));
    if (hat === 'spiked') t.push(P(new THREE.ConeGeometry(0.07, 0.22, 8), 0xc0c6d0, 0, 1.4, 0));
  } else if (hat === 'bandana') {
    t.push(P(new THREE.SphereGeometry(0.285, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), p.helmet, 0, 1.03, 0.0));
    t.push(cylY(0.284, 0.07, p.helmet, 0, 1.1, 0, 18));
    t.push(box(0.1, 0.08, 0.16, p.helmet, 0, 1.1, 0.3, 0.5));
  } else if (hat === 'beret') {
    t.push(sph(0.29, p.helmet, 0.05, 1.2, 0.02, 1.05, 0.38, 1.05, 16));
    t.push(sph(0.05, 0xffffff, -0.16, 1.2, -0.2, 1, 1, 0.5, 8));
  } else if (hat === 'cap') {
    t.push(P(new THREE.SphereGeometry(0.29, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), p.helmet, 0, 1.05, 0.01));
    t.push(box(0.3, 0.025, 0.2, p.helmet, 0, 1.08, -0.3, -0.12));
  } else if (hat === 'bald') {
    t.push(sph(0.06, p.helmet, 0, 1.28, 0, 1, 1, 1, 8));
  }
  t.push(P(new THREE.CapsuleGeometry(0.215, 0.24, 4, 14), p.shirt, 0, 0.64, 0));
  t.push(cylY(0.232, 0.3, p.vest, 0, 0.67, 0, 16, 0.226));
  for (const s of [-1, 1]) t.push(box(0.09, 0.08, 0.04, p.pouch || 0x4a4f3a, s * 0.1, 0.62, -0.225));
  t.push(cylY(0.236, 0.06, p.belt || 0x3b2a1a, 0, 0.5, 0, 16));
  t.push(box(0.07, 0.05, 0.03, 0xd9b44a, 0, 0.5, -0.236));
  if (p.pack !== false) {
    t.push(box(0.3, 0.32, 0.16, p.pack || 0x5d6b3a, 0, 0.68, 0.25));
    t.push(cylX(0.07, 0.32, p.roll || 0x8a7a5a, 0, 0.87, 0.25, 10));
  }
  if (p.belly) t.push(sph(0.22, p.shirt, 0, 0.58, -0.08, 1, 0.9, 0.9, 12));
  if (p.pads) for (const s of [-1, 1]) t.push(sph(0.11, p.helmet, s * 0.25, 0.82, 0, 1, 0.7, 1, 10));
  if (p.shield) {
    t.push(box(0.5, 0.66, 0.05, 0x8a94a6, -0.05, 0.66, -0.36));
    t.push(box(0.54, 0.05, 0.06, 0x3b414d, -0.05, 0.98, -0.36));
    t.push(box(0.54, 0.05, 0.06, 0x3b414d, -0.05, 0.34, -0.36));
    t.push(box(0.04, 0.12, 0.02, 0x26ccff, -0.05, 0.78, -0.39));
  }
  const leg = merge([box(0.155, 0.27, 0.17, p.pants, 0, -0.13, 0), box(0.172, 0.13, 0.27, p.boots || 0x3b2a1f, 0, -0.33, -0.04), box(0.172, 0.03, 0.27, 0x1a120c, 0, -0.39, -0.04)]);
  const arm = merge([limb(V(0, 0, 0), V(0, -0.27, 0), 0.072, p.sleeve || p.shirt), sph(0.075, skin, 0, -0.36, 0, 1, 1, 1, 10)]);
  return { torso: merge(t), leg, arm, pal: p };
}
const armedCache = new Map();
export function armedGeometry(pal, weaponIndex, key) {
  const k = key + ':' + weaponIndex;
  if (armedCache.has(k)) return armedCache.get(k);
  const { geo, fore } = gunGeometry(WEAPONS[weaponIndex].id);
  const gun = geo.clone().applyMatrix4(new THREE.Matrix4().compose(GUN_AT, new THREE.Quaternion(), V(GUN_SCALE, GUN_SCALE, GUN_SCALE)));
  const rh = GUN_AT.clone().add(V(0, 0.02, 0.02));
  const lh = GUN_AT.clone().add(V(fore > -0.1 ? -0.07 : -0.02, 0.07, fore * GUN_SCALE));
  const g = merge([
    limb(V(SHOULDER[0], SHOULDER[1], 0), rh, 0.07, pal.sleeve || pal.shirt), sph(0.075, pal.skin, rh.x, rh.y, rh.z, 1, 1, 1, 10),
    limb(V(-SHOULDER[0], SHOULDER[1], 0), lh, 0.07, pal.sleeve || pal.shirt), sph(0.075, pal.skin, lh.x, lh.y, lh.z, 1, 1, 1, 10),
    gun,
  ]);
  armedCache.set(k, g);
  return g;
}

// Instanced renderer for a crowd of one soldier type.
const _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _r = new THREE.Matrix4(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export class UnitRenderer {
  constructor(scene, geos, max, { armed = null, pose = 'run', key = 'u' } = {}) {
    this.max = max;
    this.n = 0;
    this.pose = pose;
    this.geos = geos;
    this.key = key;
    const mk = (geo) => {
      const im = new THREE.InstancedMesh(geo, unitMaterial, max);
      im.castShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
      scene.add(im);
      return im;
    };
    this.torso = mk(geos.torso);
    this.legL = mk(geos.leg);
    this.legR = mk(geos.leg);
    if (armed !== null) this.arms = mk(armedGeometry(geos.pal, armed, key));
    else { this.armL = mk(geos.arm); this.armR = mk(geos.arm); }
    this.all = [this.torso, this.legL, this.legR, this.arms, this.armL, this.armR].filter(Boolean);
  }
  setWeapon(i) {
    if (this.arms) this.arms.geometry = armedGeometry(this.geos.pal, i, this.key);
  }
  begin() { this.n = 0; }
  add(x, y, z, yaw, s, phase, flash = 0, run = 1) {
    if (this.n >= this.max) return;
    const i = this.n++;
    _e.set(0, yaw, 0);
    _q.setFromEuler(_e);
    _s.set(s, s, s);
    _p.set(x, y + Math.abs(Math.sin(phase)) * 0.07 * s * run, z);
    _b.compose(_p, _q, _s);
    const sw = Math.sin(phase) * 0.85 * run;
    const f = 1 + flash * 2.2;
    _c.setRGB(f, f, f);
    this.torso.setMatrixAt(i, _b);
    _l.makeTranslation(-HIP[0], HIP[1], HIP[2]).multiply(_r.makeRotationX(sw));
    this.legL.setMatrixAt(i, _m.multiplyMatrices(_b, _l));
    _l.makeTranslation(HIP[0], HIP[1], HIP[2]).multiply(_r.makeRotationX(-sw));
    this.legR.setMatrixAt(i, _m.multiplyMatrices(_b, _l));
    if (this.arms) {
      this.arms.setMatrixAt(i, _b);
      this.arms.setColorAt(i, _c);
    } else {
      let a1, a2, rz = 0;
      if (this.pose === 'wave') { a1 = Math.PI + 0.4 + Math.sin(phase * 0.7) * 0.5; a2 = Math.PI + 0.4 - Math.sin(phase * 0.7) * 0.5; rz = 0.35; }
      else if (this.pose === 'brute') { a1 = -1.2 + sw * 0.4; a2 = -1.2 - sw * 0.4; rz = 0.25; }
      else { a1 = -sw * 1.1 - 0.15; a2 = sw * 1.1 - 0.15; }
      _l.makeTranslation(-SHOULDER[0], SHOULDER[1], 0).multiply(_r.makeRotationX(a1)).multiply(_m.makeRotationZ(-rz));
      this.armL.setMatrixAt(i, _m.multiplyMatrices(_b, _l));
      _l.makeTranslation(SHOULDER[0], SHOULDER[1], 0).multiply(_r.makeRotationX(a2)).multiply(_m.makeRotationZ(rz));
      this.armR.setMatrixAt(i, _m.multiplyMatrices(_b, _l));
      this.armL.setColorAt(i, _c);
      this.armR.setColorAt(i, _c);
    }
    this.torso.setColorAt(i, _c);
    this.legL.setColorAt(i, _c);
    this.legR.setColorAt(i, _c);
  }
  end() {
    for (const im of this.all) {
      im.count = this.n;
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    }
  }
}

export const PALETTES = {
  ally:    { skin: 0xffcfa3, shirt: 0xf0dfbd, vest: 0xd9c49a, pants: 0x2f6fd8, helmet: 0x2f8bff, helmet2: 0x2577e0, band: 0x1a4fa8, pack: 0x6b5a3a, boots: 0x4a3524, cheeks: true },
  hero:    { skin: 0xffcfa3, shirt: 0xffffff, vest: 0x2b3a6b, pants: 0x1d2a5a, helmet: 0xc0182c, hat: 'beret', pack: 0x8a1f2b, boots: 0x222222, cheeks: true },
  grunt:   { skin: 0xffcfa3, shirt: 0xf3e6d6, vest: 0xe2d2bd, pants: 0xb8252f, helmet: 0xe8343f, helmet2: 0xd12a35, band: 0x7a1020, pack: false, boots: 0x3b2a1f, angry: true },
  runner:  { skin: 0xf2c08c, shirt: 0x3b3f4a, vest: 0x2e323b, pants: 0x3b3f4a, helmet: 0xff8a1f, hat: 'bandana', pack: false, boots: 0x222222, angry: true },
  armored: { skin: 0xe8b98c, shirt: 0x50565f, vest: 0x2e333a, pants: 0x3b414d, helmet: 0x30343c, helmet2: 0x23262c, band: 0xe8343f, pack: false, boots: 0x16181c, angry: true, shield: true, pads: true },
  giant:   { skin: 0xe8a98c, shirt: 0x8a1f2b, vest: 0x5c1520, pants: 0x3a1f1a, helmet: 0x5c1520, hat: 'spiked', pack: false, boots: 0x16181c, angry: true, belly: true, pads: true },
  brute:   { skin: 0x8fd16a, shirt: 0x6b3fbf, vest: 0x4a2a8a, pants: 0x3a1f5c, helmet: 0x2a1040, hat: 'spiked', pack: false, boots: 0x16181c, angry: true, belly: true, pads: true, nose: 0x6fb04e },
  recruit: { skin: 0xffcfa3, shirt: 0xd8dde6, vest: 0xb5bdcb, pants: 0x7a8496, helmet: 0x9aa4b4, helmet2: 0x8893a3, band: 0x5a6476, pack: 0x7a7060, boots: 0x4a3524, cheeks: true },
};

// ------------------------------------------------------------ canvas labels
export function makeLabel(w = 256, h = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex, text: null };
}
export function drawLabel(L, text, { fill = '#fff', stroke = 'rgba(10,20,50,.85)', size = 0.72, sub = null } = {}) {
  const key = text + fill + stroke + (sub || '');
  if (L.text === key) return;
  L.text = key;
  const { ctx, canvas } = L;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  let fs = h * size;
  const font = (s) => `${s}px "Lilita One", "Arial Black", sans-serif`;
  ctx.font = font(fs);
  while (ctx.measureText(text).width > w * 0.9 && fs > 10) { fs *= 0.9; ctx.font = font(fs); }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const y = sub ? h * 0.4 : h * 0.54;
  ctx.lineWidth = fs * 0.18;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, w / 2, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, w / 2, y);
  if (sub) {
    ctx.font = font(h * 0.24);
    ctx.lineWidth = h * 0.05;
    ctx.strokeText(sub, w / 2, h * 0.8);
    ctx.fillText(sub, w / 2, h * 0.8);
  }
  L.tex.needsUpdate = true;
}
export function labelPlane(L, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: L.tex, transparent: true, depthWrite: false, fog: false }));
  m.renderOrder = 5;
  return m;
}
export function drawIcon(R, emoji, text, color) {
  const key = emoji + text + color;
  if (R.text === key) return;
  R.text = key;
  const { ctx, canvas } = R;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (emoji) {
    const grd = ctx.createRadialGradient(s / 2, s * 0.4, 10, s / 2, s * 0.4, s * 0.42);
    grd.addColorStop(0, color + 'dd');
    grd.addColorStop(1, color + '00');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    ctx.font = `${s * 0.42}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(emoji, s / 2, s * 0.4);
  }
  let fs = s * 0.17;
  ctx.font = `${fs}px "Lilita One", sans-serif`;
  while (ctx.measureText(text).width > s * 0.96 && fs > 8) { fs *= 0.9; ctx.font = `${fs}px "Lilita One", sans-serif`; }
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.035;
  ctx.strokeStyle = 'rgba(10,20,50,.9)';
  ctx.strokeText(text, s / 2, s * 0.84);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, s / 2, s * 0.84);
  R.tex.needsUpdate = true;
}

// ------------------------------------------------------------ textures
export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function noise(g, w, h, n, alpha, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`;
    const s = size * (0.5 + Math.random());
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
function drawRoad(g, w, h, base) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 30 + Math.random() * 120, Math.random() * 3, 0, 7);
    g.fill();
  }
  for (const x of [0.27, 0.73]) {
    const grd = g.createLinearGradient(w * x - 30, 0, w * x + 30, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,.09)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(w * x - 30, 0, 60, h);
  }
  noise(g, w, h, 9000, 0.09, 2);
  g.strokeStyle = 'rgba(0,0,0,.18)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 25; g.lineTo(x, y); }
    g.stroke();
  }
  g.fillStyle = '#f6f7fb';
  g.fillRect(18, 0, 12, h);
  g.fillRect(w - 30, 0, 12, h);
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.fillRect(w / 2 - 7, h * 0.06, 14, h * 0.32);
  g.fillRect(w / 2 - 7, h * 0.56, 14, h * 0.32);
  g.fillStyle = 'rgba(0,0,0,.1)';
  g.fillRect(0, 0, 18, h);
  g.fillRect(w - 18, 0, 18, h);
}
const GROUND_TEX = {
  sand: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d9a964'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '150,100,40' : '255,230,180'},.25)`; g.lineWidth = 3; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 20, w * 0.6, y - 20, w, y); g.stroke(); }
    noise(g, w, h, 3000, 0.08);
  }),
  snow: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3f8ff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(160,190,230,.18)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 30, 10, 0, 0, 7); g.fill(); }
    noise(g, w, h, 1500, 0.05);
  }),
  neon: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1a1036'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,63,210,.35)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
  }),
  lava: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a1512'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(255,${80 + Math.random() * 100},20,.85)`; g.lineWidth = 2 + Math.random() * 4; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    noise(g, w, h, 2000, 0.15);
  }),
  water: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2b86d6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.25})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = Math.random() * w, y = Math.random() * h, l = 10 + Math.random() * 30; g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4, x + l, y); g.stroke(); }
    for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(10,60,140,.15)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 40, 14, 0, 0, 7); g.fill(); }
  }),
};
const windowTex = () => canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#1d1640'; g.fillRect(0, 0, w, h);
  for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) {
    const r = Math.random();
    g.fillStyle = r < 0.35 ? '#ffdf6b' : r < 0.5 ? '#6be8ff' : r < 0.6 ? '#ff6bd5' : '#2a2255';
    g.fillRect(x, y, 6, 6);
  }
});

// ------------------------------------------------------------ props
const woodTex = canvasTex(256, 64, (g) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#b8743a' : '#c98546';
    g.fillRect(i * 32, 0, 32, 64);
    g.fillStyle = 'rgba(70,35,10,.4)'; g.fillRect(i * 32, 0, 3, 64);
    g.fillStyle = 'rgba(255,220,170,.15)'; g.fillRect(i * 32 + 8, 0, 6, 64);
    for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(90,50,20,.25)'; g.fillRect(i * 32 + 4 + Math.random() * 24, Math.random() * 64, 2, 10); }
  }
}, false);
woodTex.wrapS = THREE.RepeatWrapping;
const barrelMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75 });
const ringMat = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.3, metalness: 0.8 });
export function buildBarrel() {
  const g = new THREE.Group();
  const roll = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.86 + Math.sin(t * Math.PI) * 0.12, -0.95 + t * 1.9)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), barrelMat);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  roll.add(body);
  const capGeo = new THREE.CircleGeometry(0.86, 24);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, barrelMat);
    cap.rotation.y = s * Math.PI / 2;
    cap.position.x = s * 0.95;
    roll.add(cap);
  }
  for (const x of [-0.72, -0.25, 0.25, 0.72]) {
    const rr = 0.86 + Math.sin(((x + 0.95) / 1.9) * Math.PI) * 0.12 + 0.02;
    const r = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.045, 6, 28), ringMat);
    r.rotation.y = Math.PI / 2;
    r.position.x = x;
    roll.add(r);
  }
  roll.position.y = 1.0;
  g.add(roll);
  g.userData.roll = roll;
  const L = makeLabel(256, 128);
  const lab = labelPlane(L, 2.2, 1.1);
  lab.position.set(0, 1.05, 1.15);
  g.add(lab);
  const R = makeLabel(256, 256);
  const icon = labelPlane(R, 1.9, 1.9);
  icon.position.set(0, 3.0, 0);
  g.add(icon);
  Object.assign(g.userData, { label: L, icon: R, iconMesh: icon });
  return g;
}

const gateTex = canvasTex(64, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(255,255,255,.95)');
  grd.addColorStop(0.5, 'rgba(255,255,255,.45)');
  grd.addColorStop(1, 'rgba(255,255,255,.75)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y, w, 2); }
}, false);
export function buildGate(width) {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x3aa0ff, map: gateTex, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.35, 2.4), panelMat);
  panel.position.y = 1.4;
  g.add(panel);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2f8bff, roughness: 0.35, metalness: 0.4 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.34), frameMat);
    p.position.set(s * (width / 2 - 0.13), 1.45, 0);
    p.castShadow = true;
    g.add(p);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.36), lightMat);
    strip.position.set(s * (width / 2 - 0.13), 1.45, 0);
    g.add(strip);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.6), frameMat);
    foot.position.set(s * (width / 2 - 0.13), 0.09, 0);
    g.add(foot);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, 0.36), frameMat);
  top.position.y = 2.82;
  top.castShadow = true;
  g.add(top);
  const L = makeLabel(256, 128);
  const lw = Math.min(width - 0.5, 3.6);
  const lab = labelPlane(L, lw, lw / 2);
  lab.position.set(0, 1.5, 0.06);
  g.add(lab);
  g.userData = { panel, panelMat, frameMat, lightMat, label: L, labelMesh: lab };
  return g;
}

// floating pickup token: glowing ring + spinning coin with an icon, or a 3D gun
const ringGeo = new THREE.RingGeometry(0.75, 1.0, 32);
export function buildPickup(color, weaponIndex = -1) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 2.4, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 1.2;
  g.add(beam);
  const spin = new THREE.Group();
  spin.position.y = 1.4;
  g.add(spin);
  if (weaponIndex >= 0) {
    const gun = gunMesh(weaponIndex, 2.6);
    gun.rotation.y = Math.PI / 2;
    gun.position.y = -0.2;
    spin.add(gun);
  } else {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 }));
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    spin.add(coin);
    const L = makeLabel(128, 128);
    for (const s of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ map: L.tex, transparent: true }));
      face.position.z = s * 0.1;
      if (s < 0) face.rotation.y = Math.PI;
      spin.add(face);
    }
    g.userData.face = L;
  }
  const T = makeLabel(256, 96);
  const tag = labelPlane(T, 2.6, 0.95);
  tag.position.y = 2.75;
  g.add(tag);
  Object.assign(g.userData, { spin, ring, beam, tag: T });
  return g;
}
export function drawEmoji(L, emoji) {
  if (L.text === emoji) return;
  L.text = emoji;
  const { ctx, canvas } = L;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.47, 0, 7); ctx.fill();
  ctx.font = `${s * 0.6}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, s / 2, s * 0.54);
  L.tex.needsUpdate = true;
}

// ------------------------------------------------------------ vehicles
export const std = (color, r = 0.5, m = 0.2) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m });
export function addMesh(g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}
export function buildTank(color = 0xc23b3b, s = 1) {
  const g = new THREE.Group();
  const body = std(color, 0.5, 0.3), dark = std(0x2b2d36, 0.8, 0.1), metal = std(0x7a8291, 0.35, 0.8);
  addMesh(g, new THREE.BoxGeometry(3.6, 1.1, 4.6), body, 0, 1.2, 0);
  addMesh(g, new THREE.BoxGeometry(3.6, 0.8, 1.0), body, 0, 1.05, 2.6, 0.5);
  addMesh(g, new THREE.BoxGeometry(3.8, 0.12, 4.8), dark, 0, 1.78, 0);
  for (const sx of [-1, 1]) {
    addMesh(g, new THREE.BoxGeometry(0.9, 1.0, 5.2), dark, sx * 2.1, 0.6, 0);
    for (let i = 0; i < 5; i++) addMesh(g, new THREE.CylinderGeometry(0.42, 0.42, 0.95, 14), metal, sx * 2.1, 0.55, -2 + i, 0, 0, Math.PI / 2);
  }
  const turret = new THREE.Group();
  addMesh(turret, new THREE.CylinderGeometry(1.3, 1.5, 0.9, 18), body);
  addMesh(turret, new THREE.CylinderGeometry(0.45, 0.45, 0.2, 14), metal, 0.4, 0.5, -0.3);
  addMesh(turret, new THREE.CylinderGeometry(0.2, 0.26, 3.4, 12), metal, 0, 0.1, 2.1, Math.PI / 2);
  addMesh(turret, new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12), dark, 0, 0.1, 3.8, Math.PI / 2);
  addMesh(turret, new THREE.BoxGeometry(0.15, 0.15, 0.9), dark, -0.8, 0.55, 0.3);
  turret.position.y = 2.2;
  g.add(turret);
  g.scale.setScalar(s);
  Object.assign(g.userData, { turret, radius: 2.6 * s, height: 3.2 * s });
  return g;
}
export function buildShark() {
  const g = new THREE.Group();
  const blue = std(0x4f8fe0, 0.6, 0), belly = std(0xf1f5ff, 0.7, 0), skin = std(0xffd2a8, 0.6, 0), dark = std(0x1b2340), pink = std(0xff8fa8);
  addMesh(g, new THREE.CapsuleGeometry(1.25, 1.6, 6, 18), blue, 0, 2.3, 0);
  const bel = addMesh(g, new THREE.SphereGeometry(1.0, 18, 14), belly, 0, 2.0, 0.85); bel.scale.set(0.9, 1.2, 0.5);
  const face = addMesh(g, new THREE.SphereGeometry(0.62, 18, 14), skin, 0, 3.15, 1.0); face.scale.set(1, 1, 0.55);
  for (const s of [-1, 1]) {
    addMesh(g, new THREE.SphereGeometry(0.1, 10, 10), dark, s * 0.22, 3.25, 1.32);
    const ch = addMesh(g, new THREE.SphereGeometry(0.1, 8, 8), pink, s * 0.38, 3.02, 1.28); ch.scale.set(1, 0.6, 0.4);
    addMesh(g, new THREE.CapsuleGeometry(0.28, 0.8, 4, 10), blue, s * 1.45, 2.4, 0.2, 0, 0, s * 0.6);
    g.userData['leg' + s] = addMesh(g, new THREE.CapsuleGeometry(0.34, 0.5, 4, 10), blue, s * 0.6, 0.55, 0);
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
    addMesh(g, new THREE.ConeGeometry(0.1, 0.22, 4), belly, Math.cos(a) * 0.68, 3.15 + Math.sin(a) * 0.68, 1.12, 0, 0, a + Math.PI / 2);
  }
  const fin = addMesh(g, new THREE.ConeGeometry(0.5, 1.2, 4), blue, 0, 4.3, -0.4, -0.3); fin.scale.z = 0.35;
  const tail = addMesh(g, new THREE.ConeGeometry(0.5, 1.4, 4), blue, 0, 1.2, -1.4, -2.2); tail.scale.x = 0.35;
  Object.assign(g.userData, { radius: 1.6, height: 4.6 });
  return g;
}
export function buildDrone() {
  const g = new THREE.Group();
  addMesh(g, new THREE.SphereGeometry(0.28, 14, 10), std(0x3d4b66, 0.4, 0.6));
  addMesh(g, new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x5ff2ff }), 0, -0.05, -0.25);
  for (const s of [-1, 1]) {
    addMesh(g, new THREE.BoxGeometry(0.7, 0.05, 0.08), std(0x9fb4d8), s * 0.35, 0, 0);
    addMesh(g, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }), s * 0.7, 0.06, 0);
  }
  return g;
}
export function buildPlane() {
  const g = new THREE.Group();
  const body = std(0x5a6b7d, 0.4, 0.5), accent = std(0xffc531);
  addMesh(g, new THREE.CapsuleGeometry(0.5, 3.4, 4, 14), body, 0, 0, 0, Math.PI / 2);
  addMesh(g, new THREE.BoxGeometry(6.5, 0.12, 1.3), body, 0, 0, 0.2);
  addMesh(g, new THREE.BoxGeometry(2.4, 0.1, 0.7), body, 0, 0, 2.0);
  addMesh(g, new THREE.BoxGeometry(0.1, 1.0, 0.8), accent, 0, 0.5, 2.0);
  addMesh(g, new THREE.ConeGeometry(0.5, 0.8, 14), accent, 0, 0, -2.5, -Math.PI / 2);
  return g;
}
export function buildHeli(color = 0x3f6b3a) {
  const g = new THREE.Group();
  const body = std(color, 0.5, 0.3), glass = std(0x9fe0ff, 0.1, 0.2), dark = std(0x222831, 0.6, 0.5);
  const b = addMesh(g, new THREE.SphereGeometry(1, 18, 14), body); b.scale.set(0.9, 0.8, 1.4);
  const c = addMesh(g, new THREE.SphereGeometry(0.6, 14, 10), glass, 0, 0.15, -0.9); c.scale.set(1, 0.8, 0.9);
  addMesh(g, new THREE.CylinderGeometry(0.18, 0.1, 2.6, 8), body, 0, 0.2, 2.2, Math.PI / 2);
  addMesh(g, new THREE.BoxGeometry(0.08, 0.7, 0.4), body, 0, 0.5, 3.4);
  for (const s of [-1, 1]) {
    addMesh(g, new THREE.BoxGeometry(0.08, 0.08, 2.2), dark, s * 0.7, -0.95, 0);
    addMesh(g, new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8), dark, s * 1.05, -0.2, -0.6, Math.PI / 2);
  }
  const rotor = new THREE.Group();
  addMesh(rotor, new THREE.BoxGeometry(5.5, 0.04, 0.25), dark);
  addMesh(rotor, new THREE.BoxGeometry(0.25, 0.04, 5.5), dark);
  rotor.position.y = 0.95;
  g.add(rotor);
  g.userData.rotor = rotor;
  return g;
}

// ------------------------------------------------------------ environment
export const BIOMES = [
  { name: 'Ocean Bridge', top: 0x3f9bff, horizon: 0xcfeaff, fog: 0xbfe2ff, ground: 'water', rail: 'bridge', road: '#8b909c', deco: ['buoy'], far: ['island'], landmark: 'tower' },
  { name: 'Desert Highway', top: 0x5fb0ff, horizon: 0xffe2b0, fog: 0xf3d6a6, ground: 'sand', rail: 'jersey', road: '#86868c', deco: ['cactus', 'rock'], far: ['mesa'] },
  { name: 'Frozen Pass', top: 0x7cb8ff, horizon: 0xeaf6ff, fog: 0xe3f2ff, ground: 'snow', rail: 'fence', road: '#9ea6b5', deco: ['pine'], far: ['mountain'] },
  { name: 'Neon City', top: 0x0b0628, horizon: 0x5a1f7a, fog: 0x2b1a5c, ground: 'neon', rail: 'neon', road: '#3a3650', deco: ['crystal'], far: ['tower'] },
  { name: 'Lava Fields', top: 0x2a0d0a, horizon: 0xc2491c, fog: 0x7a2e1c, ground: 'lava', rail: 'metal', road: '#4a4446', deco: ['rock', 'lavaRock'], far: ['volcano'] },
];

function decoGeo(kind) {
  switch (kind) {
    case 'buoy': return merge([cylY(0.5, 1.0, 0xff5a4f, 0, 0.3, 0, 12, 0.7), cylY(0.52, 0.25, 0xffffff, 0, 0.75, 0, 12), P(new THREE.ConeGeometry(0.35, 0.8, 10), 0xff5a4f, 0, 1.25, 0), sph(0.12, 0xfff36b, 0, 1.7, 0)]);
    case 'cactus': return merge([P(new THREE.CapsuleGeometry(0.42, 2.4, 4, 12), 0x4caf50, 0, 1.6, 0), P(new THREE.CapsuleGeometry(0.24, 0.9, 4, 10), 0x43a047, 0.62, 1.9, 0), P(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), 0x43a047, -0.58, 1.5, 0), box(0.5, 0.2, 0.1, 0x43a047, 0.42, 1.45, 0), box(0.4, 0.2, 0.1, 0x43a047, -0.4, 1.2, 0), sph(0.12, 0xff6bab, 0, 3.05, 0)]);
    case 'rock': return merge([P(new THREE.DodecahedronGeometry(1.3, 0), 0x9c8a74, 0, 0.5, 0, 0, 0, 0, 1, 0.7, 1), P(new THREE.DodecahedronGeometry(0.7, 0), 0x8a7a66, 1.0, 0.3, 0.4)]);
    case 'pine': return merge([cylY(0.22, 1.2, 0x6b4a2b, 0, 0.6, 0, 8, 0.3), P(new THREE.ConeGeometry(1.6, 2.2, 10), 0x2e7d4f, 0, 2.0, 0), P(new THREE.ConeGeometry(1.25, 1.9, 10), 0x2f8a55, 0, 3.0, 0), P(new THREE.ConeGeometry(0.85, 1.5, 10), 0x34965c, 0, 3.9, 0), P(new THREE.ConeGeometry(0.5, 0.7, 10), 0xf2f8ff, 0, 4.5, 0)]);
    case 'crystal': return merge([P(new THREE.OctahedronGeometry(1.0, 0), 0x40f0ff, 0, 1.4, 0, 0, 0, 0, 0.6, 1.6, 0.6), P(new THREE.OctahedronGeometry(0.6, 0), 0xff4fd8, 0.8, 0.8, 0.3, 0, 0, 0.4, 0.6, 1.4, 0.6)]);
    case 'lavaRock': return merge([P(new THREE.DodecahedronGeometry(1.1, 0), 0xff6a1a, 0, 0.2, 0, 0, 0, 0, 1.4, 0.3, 1.4)]);
    case 'island': return merge([sph(6, 0xe8c98a, 0, -3.5, 0, 1.4, 0.7, 1, 16), P(new THREE.ConeGeometry(4.5, 5, 10), 0x4e9a5a, 0, 1.5, 0), cylY(0.25, 4, 0x8a6a4a, 3, 1, 1, 6), sph(1.2, 0x3f8f4a, 3, 3.2, 1, 1.4, 0.4, 1.4, 8)]);
    case 'mesa': return merge([cylY(9, 10, 0xc98b55, 0, 3, 0, 9, 11), cylY(9.05, 1.2, 0xb0703f, 0, 6.5, 0, 9), cylY(9.6, 1.0, 0xd99b62, 0, 0.5, 0, 9, 11)]);
    case 'mountain': return merge([P(new THREE.ConeGeometry(16, 22, 8), 0x7d8ea8, 0, 9, 0), P(new THREE.ConeGeometry(7.5, 10.5, 8), 0xf4f8ff, 0, 15.8, 0), P(new THREE.ConeGeometry(10, 14, 7), 0x6f7f98, 9, 5, 4)]);
    case 'volcano': return merge([cylY(4, 16, 0x3a2420, 0, 8, 0, 10, 14), cylY(4.05, 0.6, 0xff6a1a, 0, 15.8, 0, 10), cylY(2.2, 10, 0xff4a1a, 3.2, 8, 0, 6, 0.3)]);
  }
  return null;
}
const RAILS = {
  bridge: { post: () => box(0.24, 1.35, 0.24, 0xd84a3a, 0, 0.68, 0), bar: 0xd84a3a, bars: true },
  jersey: { post: () => merge([box(0.62, 0.42, 2.9, 0xb5b8bf, 0, 0.21, 0), box(0.34, 0.5, 2.9, 0xc8cbd2, 0, 0.66, 0), box(0.36, 0.06, 0.1, 0xffc531, 0, 0.6, 1.4)]), bar: 0, bars: false },
  fence: { post: () => merge([box(0.2, 1.3, 0.2, 0x7a5232, 0, 0.65, 0), box(0.24, 0.1, 0.24, 0xffffff, 0, 1.35, 0)]), bar: 0x8a5e3a, bars: true },
  neon: { post: () => merge([box(0.2, 1.3, 0.2, 0x2a2255, 0, 0.65, 0), box(0.24, 0.12, 0.24, 0xff3fd2, 0, 1.33, 0)]), bar: 0xff3fd2, bars: true, glow: true },
  metal: { post: () => box(0.22, 1.3, 0.22, 0x4a4f58, 0, 0.65, 0), bar: 0xff7a1a, bars: true, glow: true },
};

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.length = 300;
    this.zStart = 34;
    this.skyUniforms = { top: { value: new THREE.Color(BIOMES[0].top) }, horizon: { value: new THREE.Color(BIOMES[0].horizon) } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(360, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(horizon, top, smoothstep(-0.02, 0.45, h)); gl_FragColor = vec4(c,1.0);\n#include <colorspace_fragment>\n}',
    }));
    sky.renderOrder = -10;
    sky.position.z = -80;
    scene.add(sky);
    this.sky = sky;
    this.cloudGeo = merge([sph(5, 0xffffff, 0, 0, 0, 1.6, 0.8, 1, 10), sph(4, 0xffffff, 5, -0.8, 0, 1.4, 0.8, 1, 10), sph(3.5, 0xffffff, -5.5, -1, 0.5, 1.3, 0.8, 1, 10), sph(3, 0xffffff, 2, 2, 0, 1.4, 0.9, 1, 10)]);
    this.cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 0.92, fog: false });
    this.clouds = new THREE.InstancedMesh(this.cloudGeo, this.cloudMat, 14);
    this.clouds.frustumCulled = false;
    this.cloudItems = Array.from({ length: 14 }, () => ({ x: (Math.random() - 0.5) * 400, y: 45 + Math.random() * 40, z: -120 - Math.random() * 200, s: 0.8 + Math.random() * 1.2 }));
    scene.add(this.clouds);
    this.roadCanvas = document.createElement('canvas');
    this.roadCanvas.width = 512; this.roadCanvas.height = 1024;
    this.roadTex = new THREE.CanvasTexture(this.roadCanvas);
    this.roadTex.colorSpace = THREE.SRGBColorSpace;
    this.roadTex.wrapS = this.roadTex.wrapT = THREE.RepeatWrapping;
    this.roadTex.anisotropy = 8;
    this.roadTex.repeat.set(1, this.length / 26);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(11, this.length), new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.85 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, this.zStart - this.length / 2);
    road.receiveShadow = true;
    scene.add(road);
    this.slabMat = std(0x9da3b0, 0.8, 0.1);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(11.8, 1.4, this.length), this.slabMat);
    slab.position.set(0, -0.72, road.position.z);
    slab.receiveShadow = true;
    scene.add(slab);
    this.underMat = std(0x6f7684, 0.8, 0.2);
    const under = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, this.length), this.underMat);
    under.position.set(0, -1.9, road.position.z);
    scene.add(under);
    this.under = under;
    this.curbMat = std(0xc9ced8, 0.6, 0.1);
    this.barMat = std(0xd84a3a, 0.4, 0.4);
    this.bars = [];
    for (const s of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, this.length), this.curbMat);
      curb.position.set(s * 5.7, 0.14, road.position.z);
      curb.receiveShadow = true;
      scene.add(curb);
      for (const [y, t] of [[1.2, 0.17], [0.75, 0.12]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(t, t, this.length), this.barMat);
        bar.position.set(s * 5.72, y, road.position.z);
        scene.add(bar);
        this.bars.push(bar);
      }
    }
    this.postSpacing = 3;
    this.postCount = Math.ceil(this.length / this.postSpacing);
    this.posts = {};
    for (const [k, r] of Object.entries(RAILS)) {
      const im = new THREE.InstancedMesh(r.post(), propMaterial, this.postCount * 2);
      im.castShadow = true;
      im.frustumCulled = false;
      im.visible = false;
      scene.add(im);
      this.posts[k] = im;
    }
    this.groundTex = {};
    for (const k of Object.keys(GROUND_TEX)) { this.groundTex[k] = GROUND_TEX[k](); this.groundTex[k].repeat.set(60, 80); }
    this.groundMat = new THREE.MeshStandardMaterial({ map: this.groundTex.water, roughness: 0.9 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 900), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -3.5, -250);
    ground.receiveShadow = true;
    scene.add(ground);
    this.ground = ground;
    this.decos = {};
    for (const k of ['buoy', 'cactus', 'rock', 'pine', 'crystal', 'lavaRock']) this.decos[k] = this.makeDeco(decoGeo(k), 60, 9, 50, k === 'crystal' || k === 'lavaRock');
    for (const k of ['island', 'mesa', 'mountain', 'volcano']) this.decos[k] = this.makeDeco(decoGeo(k), 16, 45, 160, false, 1.0);
    const wt = windowTex();
    wt.repeat.set(2, 4);
    const tower = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 40, 8), new THREE.MeshStandardMaterial({ map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 }), 26);
    tower.frustumCulled = false;
    scene.add(tower);
    this.decos.tower = { im: tower, items: this.scatter(26, 28, 120, 0.6, 1.4), visible: false, tall: true };
    this.bridge = [];
    for (let i = 0; i < 3; i++) {
      const t = this.buildBridgeTower();
      t.position.z = -60 - i * 110;
      scene.add(t);
      this.bridge.push(t);
    }
    this.biome = -1;
    this.setBiome(0, true);
    this.scroll = 0;
    this.update(0);
  }
  buildBridgeTower() {
    const g = new THREE.Group();
    const red = std(0xd0453a, 0.45, 0.3);
    const span = 110;
    for (const s of [-1, 1]) {
      addMesh(g, new THREE.BoxGeometry(1.4, 34, 1.8), red, s * 7.2, 15, 0);
      addMesh(g, new THREE.BoxGeometry(2.2, 1.2, 2.6), red, s * 7.2, -1.6, 0);
      for (const dir of [-1, 1]) {
        const curve = new THREE.QuadraticBezierCurve3(V(s * 7.2, 31.5, 0), V(s * 6.4, 2, dir * span * 0.42), V(s * 6.2, 1.6, dir * span / 2));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.18, 6), red));
        for (let k = 1; k < 18; k++) {
          const p = curve.getPoint(k / 18);
          if (p.y < 2.2) continue;
          const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, p.y - 1.2, 0.05), red);
          h.position.set(p.x, (p.y + 1.2) / 2, p.z);
          g.add(h);
        }
      }
    }
    for (const y of [12, 22, 32]) addMesh(g, new THREE.BoxGeometry(15.8, 1.2, 1.4), red, 0, y, 0);
    return g;
  }
  scatter(n, xmin, xmax, smin, smax) {
    return Array.from({ length: n }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (xmin + Math.random() * (xmax - xmin)), z: this.zStart - Math.random() * this.length * (xmin > 40 ? 1.4 : 1), s: smin + Math.random() * (smax - smin), r: Math.random() * 6.28, xmin, xmax }));
  }
  makeDeco(geo, n, xmin, xmax, glow, sMul = 0.8) {
    const im = new THREE.InstancedMesh(geo, glow ? glowMaterial : propMaterial, n);
    im.castShadow = !glow && xmin < 30;
    im.frustumCulled = false;
    this.scene.add(im);
    return { im, items: this.scatter(n, xmin, xmax, 0.7 * sMul + 0.2, 1.5 * sMul + 0.2), visible: false };
  }
  setBiome(i, instant = false) {
    i = ((i % BIOMES.length) + BIOMES.length) % BIOMES.length;
    if (i === this.biome) return;
    this.biome = i;
    const b = BIOMES[i];
    this.target = b;
    this.blend = instant ? 1 : 0;
    if (instant) this.applyColors(1);
    this.groundY = b.ground === 'water' ? -4 : -1.3;
    this.ground.position.y = this.groundY;
    this.groundMat.map = this.groundTex[b.ground];
    this.groundMat.roughness = b.ground === 'water' ? 0.2 : b.ground === 'snow' ? 0.7 : 0.95;
    this.groundMat.metalness = b.ground === 'water' ? 0.15 : 0;
    this.groundMat.emissive = new THREE.Color(b.ground === 'lava' ? 0xffffff : b.ground === 'neon' ? 0x553388 : 0);
    this.groundMat.emissiveIntensity = b.ground === 'lava' ? 0.35 : 0.4;
    this.groundMat.emissiveMap = b.ground === 'lava' || b.ground === 'neon' ? this.groundMat.map : null;
    this.groundMat.needsUpdate = true;
    this.under.visible = b.ground === 'water';
    for (const [k, d] of Object.entries(this.decos)) {
      d.visible = b.deco.includes(k) || b.far.includes(k);
      d.im.visible = d.visible;
    }
    for (const t of this.bridge) t.visible = b.landmark === 'tower';
    for (const [k, im] of Object.entries(this.posts)) im.visible = k === b.rail;
    const r = RAILS[b.rail];
    for (const bar of this.bars) bar.visible = r.bars;
    this.barMat.color.setHex(r.bar || 0xffffff);
    this.barMat.emissive.setHex(r.glow ? r.bar : 0);
    this.clouds.visible = b.ground !== 'neon';
    this.cloudMat.color.setHex(b.ground === 'lava' ? 0x5a4040 : 0xffffff);
    drawRoad(this.roadCanvas.getContext('2d'), 512, 1024, b.road);
    this.roadTex.needsUpdate = true;
  }
  applyColors(t) {
    const b = this.target;
    this.skyUniforms.top.value.lerp(new THREE.Color(b.top), t);
    this.skyUniforms.horizon.value.lerp(new THREE.Color(b.horizon), t);
    if (this.scene.fog) this.scene.fog.color.lerp(new THREE.Color(b.fog), t);
  }
  update(dz, dt = 0.016, time = 0) {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * 0.6);
      this.applyColors(Math.min(1, dt * 2.5));
    }
    this.scroll += dz;
    this.roadTex.offset.y = (this.roadTex.offset.y + dz / 26) % 1;
    const gt = this.groundMat.map;
    gt.offset.y = (gt.offset.y + dz / (900 / 80)) % 1;
    if (this.target.ground === 'water') gt.offset.x = Math.sin(time * 0.3) * 0.02;
    const m = new THREE.Matrix4();
    const off = this.scroll % this.postSpacing;
    const posts = this.posts[this.target.rail];
    for (let i = 0; i < this.postCount; i++) {
      const z = this.zStart - i * this.postSpacing + off;
      m.makeTranslation(-5.72, 0, z); posts.setMatrixAt(i * 2, m);
      m.makeTranslation(5.72, 0, z); posts.setMatrixAt(i * 2 + 1, m);
    }
    posts.instanceMatrix.needsUpdate = true;
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (const d of Object.values(this.decos)) {
      if (!d.visible) continue;
      const far = d.items[0] && d.items[0].xmin > 25;
      const wrap = far ? this.length * 1.4 : this.length;
      d.items.forEach((it, i) => {
        it.z += dz * (far ? 0.6 : 1);
        if (it.z > this.zStart + 20) { it.z -= wrap; it.x = (Math.random() < 0.5 ? -1 : 1) * (it.xmin + Math.random() * (it.xmax - it.xmin)); }
        e.set(0, d.tall ? 0 : it.r, 0); q.setFromEuler(e);
        if (d.tall) s.set(it.s, it.s * (0.8 + (i % 5) * 0.25), it.s); else s.set(it.s, it.s, it.s);
        p.set(it.x, d.tall ? this.groundY + 20 * s.y : this.groundY, it.z);
        m.compose(p, q, s);
        d.im.setMatrixAt(i, m);
      });
      d.im.instanceMatrix.needsUpdate = true;
    }
    for (const t of this.bridge) {
      if (!t.visible) continue;
      t.position.z += dz;
      if (t.position.z > this.zStart + 30) t.position.z -= 330;
    }
    if (this.clouds.visible) {
      this.cloudItems.forEach((c, i) => {
        c.z += dz * 0.08;
        c.x += dt * 1.5;
        if (c.z > -60) c.z -= 260;
        if (c.x > 220) c.x -= 440;
        s.set(c.s, c.s, c.s); p.set(c.x, c.y, c.z); q.identity();
        m.compose(p, q, s);
        this.clouds.setMatrixAt(i, m);
      });
      this.clouds.instanceMatrix.needsUpdate = true;
    }
  }
}
