/* Alertas calculados na hora a partir do estado atual (R03/RN03, R08, sensores, licenças).
   No backend viram eventos persistidos, com notificação push e e-mail. */
import { get } from '../core/store.js';
import { fmtM3, fmtDate, dayDiff } from '../core/format.js';
import { ALERT_KINDS } from '../config/permissions.js';
import * as T from './telemetry.js';
import * as waste from './waste.js';
import * as auth from './auth.js';

export const KIND_LABEL = { limite: 'Consumo', residuo: 'Resíduos', sensor: 'Sensores', licenca: 'Licenças' };

/** level: crit (vermelho cheio) ou warn (vermelho contornado) */
export function list() {
  const user = auth.currentUser();
  if (!user) return [];
  const s = get();
  const out = [];

  const limit = (id, name, used, max, unitId) => {
    const r = used / max;
    if (r >= 1) out.push({ id: `${id}-100`, unitId, kind: 'limite', level: 'crit', title: `Limite excedido: ${name}`, body: `Consumo de hoje em ${fmtM3(used)}, acima do limite de ${fmtM3(max)}.` });
    else if (r >= 0.8) out.push({ id: `${id}-80`, unitId, kind: 'limite', level: 'warn', title: `Perto do limite: ${name}`, body: `${Math.round(r * 100)}% do limite diário (${fmtM3(used)} de ${fmtM3(max)}).` });
  };
  s.units.forEach((u) => limit(u.id, u.name, T.unitToday(u.id), u.limit, u.id));
  limit('geral', 'consumo geral', T.totalToday(), s.limits.general);

  s.batches.forEach((b) => {
    const d = waste.deadline(b);
    const name = waste.typeOf(b.typeId).name;
    if (d.state === 'overdue') out.push({ id: `venc-${b.id}`, kind: 'residuo', level: 'crit', title: `Lote ${b.id} sem destinação`, body: `${name} (${waste.unitOf(b.unitId).name}): prazo venceu há ${-d.days} dia(s).` });
    else if (d.state === 'soon') out.push({ id: `prazo-${b.id}`, kind: 'residuo', level: 'warn', title: `Lote ${b.id} perto do prazo`, body: `${name}: restam ${d.days} dia(s) para registrar a destinação.` });
  });

  s.sensors.filter((x) => x.status === 'offline').forEach((x) => {
    out.push({ id: `sensor-${x.id}`, unitId: x.unitId, kind: 'sensor', level: 'warn', title: `Sensor offline: ${x.name}`, body: `${waste.unitOf(x.unitId).name}, ${x.system}. O consumo desta linha não está sendo medido.` });
  });

  s.companies.forEach((c) => {
    const left = dayDiff(c.licenseUntil, Date.now());
    if (left < 0) out.push({ id: `lic-${c.id}`, kind: 'licenca', level: 'crit', title: `Licença vencida: ${c.name}`, body: `${c.license} venceu em ${fmtDate(c.licenseUntil)}. Não é possível destinar resíduos a esta empresa.` });
    else if (left <= 60) out.push({ id: `lic-${c.id}`, kind: 'licenca', level: 'warn', title: `Licença vence em ${left} dias: ${c.name}`, body: `${c.license} válida até ${fmtDate(c.licenseUntil)}.` });
  });

  // RN03: o Operador só recebe alertas das unidades pelas quais é responsável
  const mine = new Set(auth.myUnits().map((u) => u.id));
  const visible = out.filter((a) => ALERT_KINDS[user.role].includes(a.kind) && (user.role !== 'operador' || (a.unitId && mine.has(a.unitId))));
  return visible.sort((a, b) => (a.level === 'crit' ? 0 : 1) - (b.level === 'crit' ? 0 : 1));
}
