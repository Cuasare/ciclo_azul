/* Regras de resíduos: RN01 comprovante, RN02 licença válida, RN04 segundo usuário, RNF02 retificação.
   Tudo aqui deve ser reaplicado no backend; o frontend só antecipa o erro.
   RN05: o histórico de auditoria NÃO registra empresa, local nem licença. */
import * as store from '../core/store.js';
import { get, uid } from '../core/store.js';
import { dayDiff, startOfDay, fmtDate } from '../core/format.js';
import * as audit from './audit.js';
import * as auth from './auth.js';

const DAY = 86400000;

export const CLASSES = {
  I: { label: 'Classe I · Perigoso', hazardous: true },
  IIA: { label: 'Classe IIA · Não inerte', hazardous: false },
  IIB: { label: 'Classe IIB · Inerte', hazardous: false },
};

export const STATUS = {
  pendente: { label: 'Sem destinação', level: 'none' },
  aguardando: { label: 'Aguardando 2ª confirmação', level: 'info' },
  destinado: { label: 'Destinado', level: 'ok' },
};

export const typeOf = (id) => get().wasteTypes.find((t) => t.id === id);
export const unitOf = (id) => get().units.find((u) => u.id === id);
export const companyOf = (id) => get().companies.find((c) => c.id === id);
export const userOf = (id) => get().users.find((u) => u.id === id);
export const isHazardous = (b) => CLASSES[typeOf(b.typeId)?.klass]?.hazardous ?? false;
export const licenseValid = (company, on = Date.now()) => company.licenseUntil >= startOfDay(on);

/** Prazo de destinação (R08). state: overdue | soon | ok | done */
export function deadline(b) {
  const due = b.generatedAt + b.deadlineDays * DAY;
  if (b.status !== 'pendente') return { due, days: null, state: 'done' };
  const days = dayDiff(due, Date.now());
  return { due, days, state: days < 0 ? 'overdue' : days <= 5 ? 'soon' : 'ok' };
}

export function createType({ name, klass, category }) {
  const t = { id: uid('wt'), name: name.trim(), klass, category: category.trim() || 'Outros' };
  store.save((s) => { s.wasteTypes.push(t); });
  audit.log('waste.type', `Tipo "${t.name}" cadastrado (${CLASSES[klass].label})`);
}

export function createBatch({ typeId, unitId, qty, unit }) {
  const max = get().batches.reduce((m, b) => Math.max(m, Number(b.id.split('-')[1])), 0);
  const b = { id: `L-${String(max + 1).padStart(4, '0')}`, typeId, unitId, qty, unit, generatedAt: Date.now(), deadlineDays: CLASSES[typeOf(typeId).klass].hazardous ? 30 : 60, status: 'pendente', destination: null };
  store.save((s) => { s.batches.unshift(b); });
  audit.log('waste.batch', `Lote ${b.id} (${typeOf(typeId).name}, ${qty} ${unit}) criado em ${unitOf(unitId).name}`);
  return b;
}

/** Valida os campos da destinação (R06): empresa com licença válida na data, local, data, quantidade. */
function validateDestination({ companyId, local, date, qty }) {
  const errors = {};
  const company = companyOf(companyId);
  if (!company) errors.companyId = 'Selecione a empresa receptora.';
  else if (!licenseValid(company, date)) errors.companyId = `Licença de ${company.name} vencida em ${fmtDate(company.licenseUntil)} (RN02).`;
  if (!local?.trim()) errors.local = 'Informe o local de destinação.';
  if (!(qty > 0)) errors.qty = 'Informe a quantidade destinada.';
  if (!Number.isFinite(date) || startOfDay(date) > startOfDay(Date.now())) errors.date = 'A data não pode ser futura.';
  return errors;
}

/** Perigosos ficam "aguardando" até outro usuário confirmar (RN04). */
export function registerDestination(batchId, { companyId, local, date, qty, proof }) {
  const b = get().batches.find((x) => x.id === batchId);
  const errors = validateDestination({ companyId, local, date, qty });
  if (!proof) errors.proof = 'Anexe o comprovante de destinação (RN01).';
  if (Object.keys(errors).length) return { ok: false, errors };

  const company = companyOf(companyId);
  const hazardous = isHazardous(b);
  store.save(() => {
    b.destination = { companyId, license: { number: company.license, until: company.licenseUntil }, local: local.trim(), date, qty, proof, registeredBy: auth.currentUser().id, confirmedBy: null, history: [] };
    b.status = hazardous ? 'aguardando' : 'destinado';
  });
  audit.log('waste.register', hazardous ? `Lote ${b.id} enviado para 2ª confirmação` : `Lote ${b.id} destinado`);
  return { ok: true, hazardous };
}

/** Retificação justificada (RNF02): o valor anterior de cada campo fica no histórico da destinação.
    Em lote perigoso, quem retifica passa a ser o "registrante" e outro usuário precisa confirmar de novo (RN04). */
export function rectifyDestination(batchId, { companyId, local, date, qty, reason }) {
  const b = get().batches.find((x) => x.id === batchId);
  const d = b.destination;
  const errors = validateDestination({ companyId, local, date, qty });
  if (!audit.validReason(reason)) errors.reason = `Descreva a justificativa (mínimo ${audit.MIN_REASON} caracteres).`;

  const company = companyOf(companyId);
  const changes = {};
  if (companyId !== d.companyId) changes.Empresa = { from: companyOf(d.companyId).name, to: company?.name };
  if (local.trim() !== d.local) changes.Local = { from: d.local, to: local.trim() };
  if (startOfDay(date) !== startOfDay(d.date)) changes.Data = { from: fmtDate(d.date), to: fmtDate(date) };
  if (qty !== d.qty) changes.Quantidade = { from: `${d.qty} ${b.unit}`, to: `${qty} ${b.unit}` };
  if (!Object.keys(changes).length) errors.form = 'Nenhum campo foi alterado.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const me = auth.currentUser();
  const hazardous = isHazardous(b);
  store.save(() => {
    d.history.push({ at: Date.now(), by: me.id, reason: reason.trim(), changes });
    Object.assign(d, { companyId, license: { number: company.license, until: company.licenseUntil }, local: local.trim(), date, qty });
    if (hazardous) { d.registeredBy = me.id; d.confirmedBy = null; b.status = 'aguardando'; }
  });
  audit.log('waste.rectify', `Lote ${b.id}: destinação retificada (${Object.keys(changes).join(', ')}). Justificativa: ${reason.trim()}${hazardous ? ' Requer nova confirmação de outro usuário.' : ''}`);
  return { ok: true, hazardous };
}

export function confirmDestination(batchId) {
  const b = get().batches.find((x) => x.id === batchId);
  const me = auth.currentUser();
  if (b.status !== 'aguardando') return { ok: false, error: 'Este lote não está aguardando confirmação.' };
  if (b.destination.registeredBy === me.id) return { ok: false, error: 'A confirmação deve ser feita por outro usuário (RN04).' };
  store.save(() => { b.destination.confirmedBy = me.id; b.status = 'destinado'; });
  audit.log('waste.confirm', `Lote ${b.id} destinado (confirmado por ${me.name})`);
  return { ok: true };
}

export function summary() {
  const { batches } = get();
  const done = batches.filter((b) => b.status === 'destinado').length;
  return {
    total: batches.length,
    done,
    open: batches.length - done,
    overdue: batches.filter((b) => deadline(b).state === 'overdue').length,
    pct: batches.length ? (done / batches.length) * 100 : 0,
  };
}
