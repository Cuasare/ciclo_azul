import { html } from '../core/html.js';
import { fmtM3, fmtPct, fmtInt, fmtWeekday, fmtDate } from '../core/format.js';
import * as auth from '../services/auth.js';
import * as kpis from '../services/kpis.js';
import * as waste from '../services/waste.js';
import * as alerts from '../services/alerts.js';
import * as T from '../services/telemetry.js';
import * as store from '../core/store.js';
import { barChart } from '../components/charts.js';
import { tag, bar } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { ROLES } from '../config/permissions.js';

let unsub;

export default {
  title: 'Painel',
  start(ctx) { unsub = T.subscribe(ctx.refresh); },
  stop() { unsub?.(); },

  render() {
    const user = auth.currentUser();
    const w = kpis.water();
    const level = kpis.levelOf(w.ratio);
    const ws = waste.summary();
    const open = alerts.list();
    const sensors = store.get().sensors;
    const links = [
      auth.can('waste.register') && ['/residuos', 'upload', 'Registrar destinação de lote'],
      auth.can('sensors.manage') && ['/sensores', 'sensor', 'Conectar sensor ou registrar leitura manual'],
      auth.can('waste.view') && !auth.can('waste.register') && ['/residuos', 'flask', 'Ver lotes e destinações'],
      auth.can('insights.view') && ['/insights', 'bulb', 'Ver oportunidades de reuso'],
      auth.can('reports.generate') && ['/relatorios', 'file', 'Gerar relatório'],
      auth.can('users.manage') && ['/usuarios', 'users', 'Gerenciar usuários'],
    ].filter(Boolean);

    return html`
      <section>
        <h2>Olá, ${user.name.split(' ')[0]}</h2>
        <p class="muted small">${ROLES[user.role].label} · ${fmtDate(Date.now())}</p>
      </section>

      ${open.length ? html`<section class="stack">
        ${open.slice(0, 3).map((a) => html`<div class="notice ${a.level}">${icon('alert', 20)}<div><div>${tag(a.level, a.level === 'crit' ? 'Crítico' : 'Atenção')}</div><b>${a.title}</b><div class="small">${a.body}</div></div></div>`)}
        <a class="btn sec small" href="#/alertas">Ver todos os alertas (${open.length})</a>
      </section>` : ''}

      <section class="kpis">
        <div class="kpi wide">
          <span class="label">Consumo de água hoje</span>
          <span class="val num">${fmtM3(w.today)}</span><span class="small muted">de ${fmtM3(w.limit)} (limite geral)</span>
          ${bar(w.ratio, level)}
          <div class="row between"><span class="small muted">${fmtPct(w.ratio * 100)} do limite</span>${tag(level, kpis.LEVEL_TEXT[level])}</div>
        </div>
        <div class="kpi"><span class="label">Reuso de água</span><span class="val num">${fmtPct(w.reusePct)}</span><span class="small muted">últimos 30 dias</span></div>
        <div class="kpi"><span class="label">Água economizada</span><span class="val num">${fmtInt(w.saved)}</span><span class="small muted">m³/mês (estimativa)</span></div>
        <div class="kpi"><span class="label">Resíduos destinados corretamente</span><span class="val num">${fmtPct(ws.pct)}</span><span class="small muted">${ws.open} em aberto${ws.overdue ? `, ${ws.overdue} vencido(s)` : ''}</span></div>
        <div class="kpi"><span class="label">Sensores online</span><span class="val num">${sensors.filter((s) => s.status === 'online').length}/${sensors.length}</span><span class="small muted">${open.length} alerta(s) aberto(s)</span></div>
      </section>

      <section>
        <h2>Últimos 7 dias</h2>
        ${barChart(T.daily(7).map((d) => ({ label: fmtWeekday(d.date), value: d.value, partial: d.partial, title: `${fmtDate(d.date)}: ${fmtM3(d.value)}${d.partial ? ' (hoje, parcial)' : ''}` })), { limit: w.limit, limitLabel: 'Limite geral', fmt: fmtInt, label: 'Consumo diário de água nos últimos 7 dias' })}
        <div class="legend"><span><i></i>Dentro do limite</span><span><i class="red"></i>Acima do limite</span><span><i class="line"></i>Limite geral</span></div>
      </section>

      ${links.length ? html`<section><h2>Atalhos</h2><div class="list">${links.map(([to, ic, text]) => html`<a class="item" href="#${to}">${icon(ic)}<span class="grow">${text}</span>${icon('chevron', 18)}</a>`)}</div></section>` : ''}
    `;
  },
};
