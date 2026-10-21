/* Leituras manuais de consumo (R04), para sistemas sem sensor. Não se edita nem exclui:
   alterar um valor é uma retificação justificada que preserva o original (RNF02). */
import * as store from '../core/store.js';
import { get, uid } from '../core/store.js';
import { dayDiff, fmtDate, fmtM3 } from '../core/format.js';
import * as T from './telemetry.js';
import * as audit from './audit.js';
import * as auth from './auth.js';

const unitName = (id) => get().units.find((u) => u.id === id)?.name;

export const list = () => [...get().readings].sort((a, b) => b.date - a.date || b.at - a.at);

export function create({ unitId, system, volume, date }) {
  const errors = {};
  system = system.trim();
  if (!auth.myUnits().some((u) => u.id === unitId)) errors.unitId = 'Você não é responsável por esta unidade.';
  if (!system) errors.system = 'Informe o sistema de refrigeração.';
  else if (get().sensors.some((s) => s.unitId === unitId && s.status === 'online' && s.system.toLowerCase() === system.toLowerCase())) {
    errors.system = 'Este sistema já tem sensor online. A leitura manual só vale quando não há sensor.';
  }
  if (!(volume > 0)) errors.volume = 'Informe um volume maior que zero.';
  const age = dayDiff(Date.now(), date);
  if (!(age >= 0 && age <= 28)) errors.date = 'Use uma data entre hoje e 28 dias atrás.';
  if (Object.keys(errors).length) return { ok: false, errors };

  store.save((s) => { s.readings.push({ id: uid('lm'), unitId, system, volume, original: volume, date, at: Date.now(), by: auth.currentUser().id, history: [] }); });
  T.applyManual(unitId, date, volume);
  audit.log('reading.manual', `Leitura manual registrada: ${unitName(unitId)}, ${system}, ${fmtM3(volume)} em ${fmtDate(date)}`);
  return { ok: true };
}

/** Retificação: exige justificativa; o valor anterior fica guardado no histórico da leitura. */
export function rectify(id, { volume, reason }) {
  const r = get().readings.find((x) => x.id === id);
  const errors = {};
  if (!auth.myUnits().some((u) => u.id === r.unitId)) errors.volume = 'Você não é responsável por esta unidade.';
  else if (!(volume > 0)) errors.volume = 'Informe um volume maior que zero.';
  else if (volume === r.volume) errors.volume = 'O novo valor é igual ao atual.';
  if (!audit.validReason(reason)) errors.reason = `Descreva a justificativa (mínimo ${audit.MIN_REASON} caracteres).`;
  if (Object.keys(errors).length) return { ok: false, errors };

  const from = r.volume;
  store.save(() => { r.history.push({ at: Date.now(), by: auth.currentUser().id, from, to: volume, reason: reason.trim() }); r.volume = volume; });
  T.applyManual(r.unitId, r.date, volume - from);
  audit.log('reading.rectify', `Leitura manual de ${unitName(r.unitId)} (${r.system}, ${fmtDate(r.date)}) retificada de ${fmtM3(from)} para ${fmtM3(volume)}. Justificativa: ${reason.trim()}`);
  return { ok: true };
}
