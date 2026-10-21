import { html } from '../core/html.js';
import { fmtDateTime, fmtInt, download } from '../core/format.js';
import * as store from '../core/store.js';
import * as reports from '../services/reports.js';
import { tag } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { flash } from '../components/dialog.js';

const ui = { type: 'full', days: 30, format: 'pdf', report: null };

const select = (name, label, items, value) => html`<div class="field"><label for="${name}">${label}</label>
  <select class="input" id="${name}" data-change="${name}">${items.map(([v, l]) => html`<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${l}</option>`)}</select></div>`;

function preview(r) {
  const ok = r.checks.filter((c) => c.ok).length;
  return html`<section class="card stack">
    <div class="row between wrap"><h2>${r.meta.title}</h2>${r.checks.length ? tag(ok === r.checks.length ? 'ok' : 'warn', `${ok} de ${r.checks.length} itens atendidos`) : ''}</div>
    <p class="small muted">Últimos ${r.meta.days} dias · gerado em ${fmtDateTime(r.meta.generatedAt)}</p>
    ${r.checks.length ? html`<div class="list">${r.checks.map((c) => html`<div class="item"><div class="grow"><div>${c.label}</div><div class="small muted">${c.detail}</div></div>${c.ok ? tag('ok', 'Atende') : tag('crit', 'Não atende')}</div>`)}</div>` : ''}
    ${r.water.length ? html`<div class="table-wrap"><table><thead><tr><th>Unidade</th><th>Consumo (m³)</th><th>Reuso</th></tr></thead><tbody>${r.water.map((w) => html`<tr><td>${w.unidade}</td><td class="num">${fmtInt(w['consumo (m³)'])}</td><td class="num">${w['reuso (%)']}%</td></tr>`)}</tbody></table></div>` : ''}
    ${r.waste.length ? html`<p class="small muted">${r.waste.length} lote(s) de resíduos incluídos.</p>` : ''}
    <button class="btn" data-action="download">${icon('download')} Baixar ${ui.format.toUpperCase()}</button>
  </section>`;
}

export default {
  title: 'Relatórios',

  render() {
    const history = store.get().reports.slice(0, 5);
    return html`
      <section class="stack">
        ${select('type', 'Tipo de relatório', Object.entries(reports.TYPES), ui.type)}
        ${select('days', 'Período', [[7, 'Últimos 7 dias'], [30, 'Últimos 30 dias']], ui.days)}
        ${select('format', 'Formato', [['pdf', 'PDF (imprimir)'], ['csv', 'CSV (planilha)']], ui.format)}
        <button class="btn" data-action="generate">Gerar relatório</button>
      </section>
      ${ui.report ? preview(ui.report) : ''}
      ${history.length ? html`<section><h2>Exportados recentemente</h2><div class="list">${history.map((r) => html`<div class="item"><div class="grow"><div class="t">${r.title}</div><div class="small muted">${r.days} dias · ${r.format.toUpperCase()} · ${r.by}</div></div><span class="small muted">${fmtDateTime(r.at)}</span></div>`)}</div></section>` : ''}`;
  },

  changes: {
    type(el, ctx) { ui.type = el.value; ui.report = null; ctx.refresh(); },
    days(el, ctx) { ui.days = Number(el.value); ui.report = null; ctx.refresh(); },
    format(el, ctx) { ui.format = el.value; ctx.refresh(); },
  },

  actions: {
    generate(el, ctx) { ui.report = reports.build(ui.type, ui.days); ctx.refresh(); },

    download(el, ctx) {
      const r = ui.report;
      const base = `ciclo-azul-${r.meta.type}-${new Date().toISOString().slice(0, 10)}`;
      if (ui.format === 'csv') download(`${base}.csv`, reports.toCSV(r), 'text/csv;charset=utf-8');
      else { document.getElementById('print-area').innerHTML = reports.toPrintHTML(r); window.print(); }
      reports.record(r, ui.format);
      flash('Relatório exportado e registrado no histórico de auditoria.');
      ctx.refresh();
    },
  },
};
