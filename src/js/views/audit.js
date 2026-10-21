import { html } from '../core/html.js';
import { fmtDateTime, download } from '../core/format.js';
import * as audit from '../services/audit.js';
import * as reports from '../services/reports.js';
import { icon } from '../components/icons.js';

const rows = () => audit.all().map((e) => ({ id: e.id, 'data e hora': new Date(e.ts).toISOString(), usuário: e.actorName, ação: audit.LABELS[e.action] ?? e.action, detalhe: e.detail }));

export default {
  title: 'Auditoria',

  render() {
    const list = [...audit.all()].reverse();
    return html`
      <p class="muted">Histórico de acessos, consumo e destinação. Os registros não podem ser excluídos. Correções só entram como retificação justificada, com o valor original preservado.</p>
      <div class="row">
        <button class="btn sec grow" data-action="csv">${icon('download')} CSV</button>
        <button class="btn sec grow" data-action="pdf">${icon('download')} PDF</button>
      </div>
      <div class="list">${list.map((e) => html`<div class="item"><div class="grow">
        <div class="row between"><b>${audit.LABELS[e.action] ?? e.action}</b><span class="small muted">${fmtDateTime(e.ts)}</span></div>
        <div class="small">${e.detail}</div>
        <div class="small muted">#${e.id} · ${e.actorName}</div></div></div>`)}</div>`;
  },

  actions: {
    csv() { download(`ciclo-azul-auditoria-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + reports.csvOf(rows()), 'text/csv;charset=utf-8'); },
    pdf() {
      document.getElementById('print-area').innerHTML = reports.printDoc('Histórico de auditoria', `Ciclo Azul · ${audit.all().length} registros · gerado em ${fmtDateTime(Date.now())}`, [{ heading: 'Registros', rows: rows() }]);
      window.print();
    },
  },
};
