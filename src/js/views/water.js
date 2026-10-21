import { html, $ } from '../core/html.js';
import { fmtM3, fmtDec, fmtInt, fmtTime, fmtPct, download } from '../core/format.js';
import * as store from '../core/store.js';
import * as auth from '../services/auth.js';
import * as T from '../services/telemetry.js';
import * as kpis from '../services/kpis.js';
import * as audit from '../services/audit.js';
import * as reports from '../services/reports.js';
import { lineChart } from '../components/charts.js';
import { tag, bar, errorLine, options } from '../components/ui.js';
import { openDialog, flash } from '../components/dialog.js';

const ui = { scope: 'all' };
let unsub;

/** Bloco que se atualiza a cada leitura (fora dele ficam select e botões, para não perder o foco) */
function live() {
  const { units, limits, sensors } = store.get();
  const flow = ui.scope === 'all' ? T.totalFlow() : T.unitFlow(ui.scope);
  const today = ui.scope === 'all' ? T.totalToday() : T.unitToday(ui.scope);
  const rows = [{ name: 'Geral', used: T.totalToday(), limit: limits.general }, ...units.map((u) => ({ name: u.name, used: T.unitToday(u.id), limit: u.limit }))];
  const list = sensors.filter((s) => ui.scope === 'all' || s.unitId === ui.scope);

  return html`
    <section class="card">
      <span class="label">Vazão agora</span>
      <div class="big num">${fmtDec(flow)} <small>m³/h</small></div>
      <p class="small muted">Consumo hoje: ${fmtM3(today)}</p>
      ${lineChart(T.series(ui.scope), { fmt: fmtInt, fmtX: fmtTime, label: 'Vazão em m³ por hora nos últimos 2 minutos' })}
      <p class="small muted">Últimos 2 minutos.</p>
    </section>

    <section>
      <h2>Limites diários</h2>
      <div class="list">${rows.map((r) => {
        const ratio = r.used / r.limit;
        const level = kpis.levelOf(ratio);
        return html`<div class="item"><div class="grow stack" style="gap:6px">
          <div class="row between"><b>${r.name}</b>${tag(level, `${fmtPct(ratio * 100)} · ${kpis.LEVEL_TEXT[level]}`)}</div>
          ${bar(ratio, level)}
          <span class="small muted num">${fmtM3(r.used)} de ${fmtM3(r.limit)}</span></div></div>`;
      })}</div>
    </section>

    <section>
      <h2>Sensores</h2>
      <div class="list">${list.map((s) => html`<div class="item"><div class="grow"><div class="t">${s.name}</div><div class="small muted">${s.system} · ${units.find((u) => u.id === s.unitId).name}</div></div>
        <div style="text-align:right">${s.status === 'online' ? html`<b class="num">${fmtDec(T.sensorNow(s.id))}</b> <span class="small muted">m³/h</span>` : tag('warn', 'Offline')}</div></div>`)}</div>
    </section>`;
}

export default {
  title: 'Consumo de água',

  start(ctx) {
    unsub = T.subscribe(() => { const el = $('#live'); if (el) el.innerHTML = String(live()); });
  },
  stop() { unsub?.(); },

  render() {
    const { units } = store.get();
    return html`
      <div class="field"><label for="scope">Unidade</label>
        <select class="input" id="scope" data-change="scope"><option value="all">Todas as unidades</option>${options(units, ui.scope)}</select></div>
      <div id="live" class="stack" style="gap:20px">${live()}</div>
      <div class="stack">
        ${auth.can('water.limits') ? html`<button class="btn sec" data-action="limits">Definir limites de consumo</button>` : ''}
        <button class="btn sec" data-action="export">Exportar histórico de consumo (CSV, 30 dias)</button>
        <button class="btn sec" data-action="spike">Simular pico de consumo (demonstração)</button>
        <p class="small muted">Dados simulados em tempo acelerado: cada atualização de 2 s equivale a 4 min.</p>
      </div>`;
  },

  changes: { scope(el, ctx) { ui.scope = el.value; ctx.refresh(); } },

  actions: {
    export() {
      download(`ciclo-azul-consumo-${new Date().toISOString().slice(0, 10)}.csv`, '\ufeff' + reports.csvOf(reports.consumptionRows(30, ui.scope)), 'text/csv;charset=utf-8');
      audit.log('report.export', 'Histórico de consumo (30 dias) exportado em CSV');
    },

    spike() {
      const { units } = store.get();
      const target = ui.scope === 'all' ? units[1] : units.find((u) => u.id === ui.scope);
      T.boost(target.id);
      flash(`Pico simulado em ${target.name} por cerca de 40 s.`, 'warn');
    },

    limits(el, ctx) {
      const { units, limits } = store.get();
      openDialog({
        title: 'Limites diários de consumo',
        body: html`<p class="small muted">Ao passar de 80% e de 100% do limite do dia, o sistema gera alerta.</p>
          <form class="stack" data-form="limits" novalidate>
            <div class="field"><label for="lim-general">Geral (todas as unidades), m³/dia</label><input class="input" id="lim-general" name="general" inputmode="numeric" value="${limits.general}"></div>
            ${units.map((u) => html`<div class="field"><label for="lim-${u.id}">${u.name}, m³/dia</label><input class="input" id="lim-${u.id}" name="${u.id}" inputmode="numeric" value="${u.limit}"></div>`)}
            <div id="lim-error"></div>
            <button class="btn" type="submit">Salvar limites</button>
          </form>`,
        forms: {
          limits(form, api) {
            const read = (name) => Number(String(form.elements[name].value).replace(',', '.'));
            const next = { general: read('general'), ...Object.fromEntries(units.map((u) => [u.id, read(u.id)])) };
            if (Object.values(next).some((v) => !Number.isFinite(v) || v <= 0)) { $('#lim-error', api.el).innerHTML = String(errorLine('Informe valores numéricos maiores que zero.')); return; }
            const changes = [];
            if (next.general !== limits.general) changes.push(`geral ${limits.general} → ${next.general}`);
            units.forEach((u) => { if (next[u.id] !== u.limit) changes.push(`${u.name} ${u.limit} → ${next[u.id]}`); });
            store.save((s) => { s.limits.general = next.general; s.units.forEach((u) => { u.limit = next[u.id]; }); });
            if (changes.length) audit.log('limit.update', `Limites alterados (m³/dia): ${changes.join('; ')}`);
            api.close();
            flash('Limites atualizados.');
            ctx.refresh();
          },
        },
      });
    },
  },
};
