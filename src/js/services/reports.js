/* Relatórios de conformidade (R09) e exportação (RNF03). No backend, gerados e assinados no servidor. */
import { get, save } from '../core/store.js';
import { fmtDate, fmtDateTime } from '../core/format.js';
import { esc } from '../core/html.js';
import * as T from './telemetry.js';
import * as waste from './waste.js';
import * as audit from './audit.js';
import * as auth from './auth.js';
import { ROLES } from '../config/permissions.js';

export const TYPES = { full: 'Conformidade ambiental completa', water: 'Consumo de água', waste: 'Destinação de resíduos' };

export function build(type, days) {
  const s = get();
  const water = s.units.map((u) => {
    const d = T.daily(Math.min(days, 30), u.id);
    const consumed = d.reduce((a, x) => a + x.value, 0);
    const reused = d.reduce((a, x) => a + x.reuse, 0);
    return { unidade: u.name, 'consumo (m³)': Math.round(consumed), 'reuso (m³)': Math.round(reused), 'reuso (%)': Math.round((reused / consumed) * 100), 'limite diário (m³)': u.limit, 'dias acima do limite': d.filter((x) => x.value > u.limit).length };
  });

  const cutoff = Date.now() - days * 86400000;
  const rows = s.batches.filter((b) => b.generatedAt >= cutoff || b.status !== 'destinado').map((b) => {
    const t = waste.typeOf(b.typeId);
    const c = b.destination && waste.companyOf(b.destination.companyId);
    return {
      lote: b.id, resíduo: t.name, classe: t.klass, quantidade: `${b.qty} ${b.unit}`, unidade: waste.unitOf(b.unitId).name,
      'gerado em': fmtDate(b.generatedAt), situação: waste.STATUS[b.status].label,
      empresa: c?.name ?? '', licença: b.destination ? `${b.destination.license.number} (até ${fmtDate(b.destination.license.until)})` : '', local: b.destination?.local ?? '',
      'qtd. destinada': b.destination ? `${b.destination.qty} ${b.unit}` : '', comprovante: b.destination?.proof.name ?? '', retificações: b.destination?.history.length ?? 0, 'confirmado por': waste.userOf(b.destination?.confirmedBy)?.name ?? '',
    };
  });

  const dest = s.batches.filter((b) => b.destination);
  const overdue = s.batches.filter((b) => waste.deadline(b).state === 'overdue').length;
  const over = water.reduce((a, w) => a + w['dias acima do limite'], 0);
  const offline = s.sensors.filter((x) => x.status !== 'online').length;
  const checks = [
    { ok: overdue === 0, label: 'Lotes dentro do prazo de destinação', detail: `${overdue} lote(s) vencido(s)` },
    { ok: dest.every((b) => b.destination.proof), label: 'Comprovante anexado em toda destinação', detail: `${dest.length} destinação(ões)` },
    { ok: dest.every((b) => waste.licenseValid(waste.companyOf(b.destination.companyId), b.destination.date)), label: 'Empresas receptoras com licença válida na data', detail: `${new Set(dest.map((b) => b.destination.companyId)).size} empresa(s)` },
    { ok: dest.filter(waste.isHazardous).every((b) => b.status !== 'destinado' || b.destination.confirmedBy), label: 'Resíduos perigosos com dupla confirmação', detail: `${dest.filter(waste.isHazardous).length} lote(s) perigoso(s)` },
    { ok: over === 0, label: 'Consumo de água dentro dos limites', detail: `${over} dia(s) acima do limite` },
    { ok: offline === 0, label: 'Medição contínua em todos os sensores', detail: `${offline} sensor(es) offline` },
  ];

  const me = auth.currentUser();
  return {
    meta: { title: TYPES[type], type, days, generatedAt: Date.now(), generatedBy: me.name, role: ROLES[me.role].label },
    water: type === 'waste' ? [] : water,
    waste: type === 'water' ? [] : rows,
    checks: type === 'full' ? checks : [],
  };
}

export function record(report, format) {
  save((s) => { s.reports.unshift({ id: report.meta.generatedAt, title: report.meta.title, days: report.meta.days, format, at: report.meta.generatedAt, by: report.meta.generatedBy }); });
  audit.log('report.export', `Relatório "${report.meta.title}" (${report.meta.days} dias) exportado em ${format.toUpperCase()}`);
}

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Linhas (objetos) para CSV com separador ; e BOM, para o Excel abrir com acentos */
export const csvOf = (rows) => (rows.length ? [Object.keys(rows[0]).map(cell).join(';'), ...rows.map((r) => Object.values(r).map(cell).join(';'))].join('\n') : '');

export function toCSV(r) {
  const parts = [`${cell(r.meta.title)};${cell(`Gerado em ${fmtDateTime(r.meta.generatedAt)} por ${r.meta.generatedBy}`)}`];
  if (r.water.length) parts.push('', 'CONSUMO DE ÁGUA', csvOf(r.water));
  if (r.waste.length) parts.push('', 'RESÍDUOS', csvOf(r.waste));
  if (r.checks.length) parts.push('', 'CONFORMIDADE', csvOf(r.checks.map((c) => ({ item: c.label, atende: c.ok ? 'Sim' : 'Não', detalhe: c.detail }))));
  return '\ufeff' + parts.join('\n');
}

const table = (rows) => (rows.length ? `<table><thead><tr>${Object.keys(rows[0]).map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${Object.values(r).map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '');

/** Documento para o diálogo de impressão (salvar como PDF). sections = [{ heading, rows | items }] */
export function printDoc(title, subtitle, sections) {
  return `<h1>${esc(title)}</h1><p>${esc(subtitle)}</p>${sections.filter((s) => (s.rows ?? s.items).length).map((s) => `<h2>${esc(s.heading)}</h2>${s.items ? `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : table(s.rows)}`).join('')}`;
}

export const toPrintHTML = (r) => printDoc(r.meta.title, `Ciclo Azul · últimos ${r.meta.days} dias · gerado em ${fmtDateTime(r.meta.generatedAt)} por ${r.meta.generatedBy}`, [
  { heading: 'Conformidade', items: r.checks.map((c) => `${c.ok ? 'Atende' : 'NÃO atende'}: ${c.label} (${c.detail})`) },
  { heading: 'Consumo de água', rows: r.water },
  { heading: 'Resíduos', rows: r.waste },
]);

/** Histórico de consumo por dia e unidade (RNF03: exportação de históricos) */
export function consumptionRows(days = 30, unitId = 'all') {
  return get().units.filter((u) => unitId === 'all' || u.id === unitId).flatMap((u) => T.daily(days, u.id).map((d) => ({
    data: fmtDate(d.date), unidade: u.name, 'consumo (m³)': Math.round(d.value), 'reuso (m³)': Math.round(d.reuse), situação: d.partial ? 'dia em andamento' : 'fechado',
  })));
}
