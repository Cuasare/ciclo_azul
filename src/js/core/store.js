/* Estado em localStorage. No backend real isto vira API + banco de dados. */
const KEY = 'ciclo-azul:v5';

let state = null;

export function load(seed) {
  try { state = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { state = null; }
  if (!state) { state = seed(); persist(); }
  return state;
}

export const get = () => state;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage cheio ou bloqueado */ }
}

/** Aplica a mutação e salva. */
export function save(mutator = () => {}) {
  mutator(state);
  persist();
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  location.href = location.pathname;
}

export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
