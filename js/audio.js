// Tiny synthesized sound effects (no audio files needed).
import { save } from './save.js';

let ctx = null, master = null;
const last = {};

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.4, freq = 800, delay = 0) {
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

const throttle = { shoot: 0.06, hit: 0.05, die: 0.05, coin: 0.06, lose: 0.08 };

export function sfx(name) {
  if (!ctx || save.mute) return;
  const now = ctx.currentTime;
  if (throttle[name] && last[name] && now - last[name] < throttle[name]) return;
  last[name] = now;
  switch (name) {
    case 'shoot': tone('square', 900 + Math.random() * 200, 300, 0.05, 0.05); break;
    case 'laser': tone('sawtooth', 1800, 400, 0.08, 0.05); break;
    case 'rocket': noise(0.15, 0.15, 1200); break;
    case 'hit': tone('triangle', 300, 120, 0.05, 0.08); break;
    case 'die': noise(0.08, 0.2, 2000); break;
    case 'lose': tone('square', 220, 80, 0.12, 0.08); break;
    case 'gateGood': tone('sine', 520, 1040, 0.15, 0.25); tone('sine', 780, 1560, 0.2, 0.2, 0.08); break;
    case 'gateBad': tone('sawtooth', 300, 90, 0.3, 0.2); break;
    case 'barrel': noise(0.25, 0.5, 900); tone('triangle', 200, 60, 0.25, 0.3); break;
    case 'powerup': [0, 0.07, 0.14, 0.21].forEach((d, i) => tone('square', 440 * Math.pow(1.26, i), 880 * Math.pow(1.26, i), 0.1, 0.1, d)); break;
    case 'explode': noise(0.5, 0.6, 600); tone('sine', 120, 30, 0.5, 0.5); break;
    case 'nuke': noise(1.6, 0.9, 400); tone('sine', 80, 20, 1.6, 0.7); break;
    case 'coin': tone('square', 1200, 1800, 0.06, 0.05); break;
    case 'wave': [0, 0.1, 0.2].forEach((d, i) => tone('triangle', 523 * Math.pow(1.25, i), 523 * Math.pow(1.25, i), 0.18, 0.25, d)); break;
    case 'boss': tone('sawtooth', 110, 55, 1.0, 0.3); tone('sawtooth', 116, 58, 1.0, 0.25); break;
    case 'stomp': noise(0.3, 0.7, 300); tone('sine', 90, 30, 0.3, 0.5); break;
    case 'death': [0, 0.15, 0.3].forEach((d, i) => tone('triangle', 440 / Math.pow(1.3, i), 200 / Math.pow(1.3, i), 0.3, 0.25, d)); break;
    case 'buy': tone('sine', 660, 1320, 0.12, 0.25); tone('sine', 990, 1980, 0.15, 0.2, 0.06); break;
    case 'deny': tone('square', 160, 120, 0.12, 0.12); break;
    case 'click': tone('sine', 800, 900, 0.04, 0.12); break;
  }
}

// ------------------------------------------------------------ music
// A small synthesized battle loop (Am-F-C-G). Intensity 0..2 speeds it up and adds layers.
let musicGain = null, musicTimer = null, step = 0, nextT = 0, intensity = 0, noiseBuf = null;
const BPM = [118, 128, 142];
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function getNoise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function env(node, t, vol, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  node.connect(g).connect(musicGain);
  return g;
}
function kick(t) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(o, t, 0.55, 0.25);
  o.start(t); o.stop(t + 0.3);
}
function hiss(t, vol, dur, type, freq) {
  const s = ctx.createBufferSource();
  s.buffer = getNoise();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  s.connect(f);
  env(f, t, vol, dur);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function note(type, freq, t, dur, vol, cutoff = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  let src = o;
  if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); src = f; }
  env(src, t, vol, dur);
  o.start(t); o.stop(t + dur + 0.05);
}
function playStep(s, t, spb) {
  const bar = Math.floor(s / 16) % 4, i = s % 16;
  const chord = PROG[bar];
  if (i % 4 === 0) kick(t);
  if (intensity >= 2 && (i === 6 || i === 14)) kick(t);
  if (i === 4 || i === 12) { hiss(t, 0.22, 0.14, 'highpass', 1400); note('triangle', 190, t, 0.08, 0.12); }
  if (i % 2 === 1 || intensity >= 1) hiss(t, i % 2 ? 0.07 : 0.035, 0.035, 'highpass', 7500);
  if (i % 2 === 0) note('sawtooth', mtof(chord[0] - 24 + (i % 8 === 6 ? 12 : 0)), t, spb * 1.7, 0.16, 380 + intensity * 260);
  if (intensity >= 1 || bar % 2 === 1) note('square', mtof(chord[i % 3] + 12 + (i % 6 === 5 ? 12 : 0)), t, spb * 0.9, 0.035, 2400);
  if (intensity >= 2 && i % 8 === 0) note('sawtooth', mtof(chord[0] + 24), t, spb * 6, 0.05, 1800);
}
function schedule() {
  if (!ctx || !musicGain) return;
  const spb = 60 / BPM[intensity] / 4;
  while (nextT < ctx.currentTime + 0.12) {
    if (!save.mute && ctx.state === 'running') playStep(step, nextT, spb);
    nextT += spb;
    step = (step + 1) % 64;
  }
}
export function musicStart() {
  if (!ctx || musicTimer) return;
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.45;
  musicGain.connect(master);
  step = 0;
  nextT = ctx.currentTime + 0.1;
  musicTimer = setInterval(schedule, 25);
}
export function musicStop() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (musicGain) {
    const g = musicGain;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => g.disconnect(), 1200);
    musicGain = null;
  }
}
export function musicIntensity(i) { intensity = Math.max(0, Math.min(2, i)); }
