/* Indicadores de água (R10) */
import { get } from '../core/store.js';
import * as T from './telemetry.js';
import * as insights from './insights.js';

/** ok | warn (≥ 80% do limite) | crit (≥ 100%) */
export const levelOf = (ratio) => (ratio >= 1 ? 'crit' : ratio >= 0.8 ? 'warn' : 'ok');
export const LEVEL_TEXT = { ok: 'Dentro do limite', warn: 'Perto do limite', crit: 'Limite excedido' };

export function water() {
  const s = get();
  const today = T.totalToday();
  const d30 = T.daily(30);
  const consumed = d30.reduce((a, d) => a + d.value, 0);
  const reused = d30.reduce((a, d) => a + d.reuse, 0);
  return {
    today,
    limit: s.limits.general,
    ratio: today / s.limits.general,
    reusePct: consumed ? (reused / consumed) * 100 : 0,
    saved: s.savedBaseline + insights.appliedSavings(),
    units: s.units.map((u) => ({ unit: u, used: T.unitToday(u.id), ratio: T.unitToday(u.id) / u.limit })),
  };
}
