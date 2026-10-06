// Persistent progress, stored in this browser only.
const KEY = 'squadrush-save-v1';
const fresh = () => ({ coins: 0, best: 0, tech: { core: 1 }, kills: 0, runs: 0, mute: false, startWave: 1 });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return fresh();
}
export const save = load();
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

export function fmt(v) {
  v = Math.floor(v);
  if (v < 1000) return String(v);
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + units[i];
}
