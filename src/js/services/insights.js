/* Oportunidades de reuso e redução de desperdício (R02), calculadas sobre o consumo medido. */
import * as store from '../core/store.js';
import { get } from '../core/store.js';
import * as T from './telemetry.js';
import * as audit from './audit.js';

const CATALOG = [
  { key: 'purge', kind: 'Reuso', effort: 'Médio', pct: 0.06, title: 'Reaproveitar a água de purga das torres', desc: (u) => `Tratar e direcionar a purga de ${u.name} para irrigação e descarga sanitária, em vez de descartá-la.`, evidence: 'Cerca de 6% da água captada sai como purga.' },
  { key: 'cycles', kind: 'Redução', effort: 'Baixo', pct: 0.08, title: 'Aumentar os ciclos de concentração de 3 para 5', desc: (u) => `Ajustar o controle de condutividade nas torres de ${u.name} reduz a reposição de água.`, evidence: 'Unidade com o maior consumo médio.', pick: (units, month) => units.reduce((a, b) => (month[a.id] > month[b.id] ? a : b)).id },
  { key: 'night', kind: 'Desperdício', effort: 'Baixo', pct: 0.03, title: 'Investigar vazão noturna acima da base', desc: (u) => `${u.name} mantém vazão alta de madrugada, fora do padrão de carga térmica. Possível vazamento ou válvula presa.`, evidence: 'Vazão noturna 14% acima da base.', pick: (units) => units.reduce((a, b) => (a.todayRatio > b.todayRatio ? a : b)).id },
  { key: 'rain', kind: 'Reuso', effort: 'Alto', pct: 0.05, title: 'Captar água de chuva para reposição', desc: (u) => `A cobertura de ${u.name} permite abastecer parte da reposição das torres com água pluvial.`, evidence: 'Grande área de cobertura e chuva sazonal.', pick: (units) => units.at(-1).id },
];

export function list() {
  const { units, insights } = get();
  const month = Object.fromEntries(units.map((u) => [u.id, T.daily(30, u.id).reduce((a, d) => a + d.value, 0)]));
  const out = [];
  CATALOG.forEach((c) => {
    const targets = c.pick ? [units.find((u) => u.id === c.pick(units, month))] : units;
    targets.forEach((u) => out.push({
      id: `${c.key}-${u.id}`, unit: u, kind: c.kind, effort: c.effort, title: c.title, desc: c.desc(u), evidence: c.evidence,
      saving: month[u.id] * c.pct, applied: insights[`${c.key}-${u.id}`] ?? null,
    }));
  });
  return out.sort((a, b) => b.saving - a.saving);
}

export const potential = () => list().filter((i) => !i.applied).reduce((a, i) => a + i.saving, 0);
export const appliedSavings = () => list().filter((i) => i.applied).reduce((a, i) => a + i.saving, 0);

export function apply(id) {
  const item = list().find((i) => i.id === id);
  if (!item || item.applied) return;
  store.save((s) => { s.insights[id] = { at: Date.now() }; });
  audit.log('insight.apply', `"${item.title}" aplicada em ${item.unit.name} (economia estimada de ${Math.round(item.saving)} m³/mês)`);
}
