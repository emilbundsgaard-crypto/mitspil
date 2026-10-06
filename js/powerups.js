// Pickups, rescues, buffs and friendly vehicles. STUB — being implemented. See API.md for the contract.
export const BUFFS = {
  rage: { icon: '🔥', name: 'RAGE', color: '#ff7a1a' },
  power: { icon: '💪', name: 'POWER', color: '#ff4d5e' },
  shield: { icon: '🛡️', name: 'SHIELD', color: '#7fe8ff' },
  freeze: { icon: '❄️', name: 'FREEZE', color: '#bfe6ff' },
  coins: { icon: '💰', name: 'GOLD RUSH', color: '#ffc531' },
  giant: { icon: '🦍', name: 'GIANTS', color: '#a46bff' },
};
export function initRun(G) {}
export function clear(G) {}
export function update(G, dt) {
  for (const k of Object.keys(G.S.buffs)) G.S.buffs[k] = Math.max(0, G.S.buffs[k] - dt);
}
export function spawnPickup(G, x) {}
export function spawnRecruits(G, x, count) {}
export function barrelReward(G) {
  const n = Math.round(4 + G.S.wave * 1.1);
  return { icon: '🧍', text: `+${n}`, color: '#2f8bff', apply(G) { G.addAllies(n); } };
}
export function absorbHit(G, enemy) { return false; }
