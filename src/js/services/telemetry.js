/* Leituras dos sensores IoT, SIMULADAS. No backend, chegam por MQTT/HTTP (RNF03).
   Tempo acelerado: cada tick de 2 s equivale a 4 min de operação. */
import * as store from '../core/store.js';
import { startOfDay } from '../core/format.js';

export const TICK_MS = 2000;
const SPEEDUP = 120;
const WINDOW = 60;
const DAY = 86400000;

const listeners = new Set();
let timer = null;

const T = { day: startOfDay(), sensor: {}, unit: {}, today: {}, series: {}, history: {}, boost: {}, total: 0 };

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

function sensorFlow(s, t) {
  if (s.status !== 'online') return 0;
  const ph = (Math.abs(hashStr(s.id)) % 628) / 100;
  const wave = 1 + 0.14 * Math.sin(t / 25000 + ph) + 0.06 * Math.sin(t / 7000 + ph * 2) + (Math.random() - 0.5) * 0.05;
  return Math.max(0, s.baseFlow * wave * ((T.boost[s.unitId] ?? 0) > t ? 4 : 1));
}

export function init() {
  const { units, sensors } = store.get();
  const now = Date.now();
  units.forEach((u) => {
    const mine = sensors.filter((s) => s.unitId === u.id);
    const base = mine.filter((s) => s.status === 'online').reduce((a, s) => a + s.baseFlow, 0) * 24;
    const rand = rng(hashStr(u.id));
    T.history[u.id] = Array.from({ length: 29 }, (_, k) => {
      const date = startOfDay(now - (29 - k) * DAY);
      const weekend = [0, 6].includes(new Date(date).getDay()) ? 0.94 : 1;
      const value = base * (0.86 + rand() * 0.24) * weekend;
      return { date, value, reuse: value * (0.15 + k * 0.0018 + rand() * 0.02) };
    });
    T.today[u.id] = u.limit * u.todayRatio;
    T.series[u.id] = Array.from({ length: WINDOW }, (_, k) => {
      const t = now - (WINDOW - 1 - k) * TICK_MS;
      return { t, v: mine.reduce((a, s) => a + sensorFlow(s, t), 0) };
    });
  });
  store.get().readings.forEach((r) => applyManual(r.unitId, r.date, r.volume));
  tick(false);
}

/** Soma (ou subtrai, em retificação) uma leitura manual no dia correspondente */
export function applyManual(unitId, date, delta) {
  if (startOfDay(date) === T.day) T.today[unitId] = (T.today[unitId] ?? 0) + delta;
  else { const h = T.history[unitId]?.find((d) => d.date === startOfDay(date)); if (h) h.value += delta; }
}

function tick(emit = true) {
  const { units, sensors } = store.get();
  const now = Date.now();

  if (startOfDay(now) !== T.day) { // virou o dia
    units.forEach((u) => {
      T.history[u.id] = [...T.history[u.id], { date: T.day, value: T.today[u.id], reuse: T.today[u.id] * 0.2 }].slice(-29);
      T.today[u.id] = 0;
    });
    T.day = startOfDay(now);
  }

  T.total = 0;
  units.forEach((u) => {
    let sum = 0;
    sensors.filter((s) => s.unitId === u.id).forEach((s) => { T.sensor[s.id] = sensorFlow(s, now); sum += T.sensor[s.id]; });
    T.unit[u.id] = sum;
    T.total += sum;
    T.today[u.id] = (T.today[u.id] ?? 0) + (sum * TICK_MS * SPEEDUP) / 1000 / 3600;
    (T.series[u.id] ??= []).push({ t: now, v: sum });
    if (T.series[u.id].length > WINDOW) T.series[u.id].shift();
  });
  if (emit) listeners.forEach((fn) => fn());
}

export function start() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const sensorNow = (id) => T.sensor[id] ?? 0;
export const unitFlow = (id) => T.unit[id] ?? 0;
export const totalFlow = () => T.total;
export const unitToday = (id) => T.today[id] ?? 0;
export const totalToday = () => Object.values(T.today).reduce((a, b) => a + b, 0);

/** Janela rolante de vazão (m³/h). scope = 'all' ou id da unidade */
export function series(scope = 'all') {
  if (scope !== 'all') return T.series[scope] ?? [];
  const ids = Object.keys(T.series);
  const len = Math.min(...ids.map((u) => T.series[u].length));
  return Array.from({ length: len }, (_, i) => ({
    t: T.series[ids[0]].at(i - len).t,
    v: ids.reduce((a, u) => a + T.series[u].at(i - len).v, 0),
  }));
}

/** Totais diários dos últimos `days` (≤ 30) dias; o último é hoje (parcial). */
export function daily(days = 7, scope = 'all') {
  const ids = scope === 'all' ? Object.keys(T.history) : [scope];
  const out = [];
  for (let i = days - 2; i >= 0; i--) {
    const at = (u) => T.history[u].at(-1 - i);
    out.push({ date: at(ids[0]).date, value: ids.reduce((a, u) => a + at(u).value, 0), reuse: ids.reduce((a, u) => a + at(u).reuse, 0) });
  }
  const today = ids.reduce((a, u) => a + (T.today[u] ?? 0), 0);
  out.push({ date: T.day, value: today, reuse: today * 0.2, partial: true });
  return out;
}

/** Simula um pico de consumo na unidade (demonstração do alerta de limite). */
export function boost(unitId, ms = 40000) { T.boost[unitId] = Date.now() + ms; }
