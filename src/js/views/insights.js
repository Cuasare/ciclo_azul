import { html } from '../core/html.js';
import { fmtInt } from '../core/format.js';
import * as insights from '../services/insights.js';
import * as auth from '../services/auth.js';
import { tag } from '../components/ui.js';
import { flash } from '../components/dialog.js';

const EFFORT_LEVEL = { Baixo: 'ok', Médio: 'none', Alto: 'warn' };

const card = (i, canApply) => html`<article class="card stack">
  <div class="row between wrap"><span class="label">${i.kind} · ${i.unit.name}</span>${i.applied ? tag('ok', 'Aplicada') : ''}</div>
  <h3>${i.title}</h3>
  <p class="small muted">${i.desc}</p>
  <p class="small"><b>Evidência:</b> ${i.evidence}</p>
  <div class="row between wrap"><div><div class="big num">~${fmtInt(i.saving)} <small>m³/mês</small></div>${tag(EFFORT_LEVEL[i.effort], `Esforço ${i.effort.toLowerCase()}`)}</div>
    ${!i.applied && canApply ? html`<button class="btn small" data-action="apply" data-id="${i.id}">Aplicar</button>` : ''}</div>
</article>`;

export default {
  title: 'Reuso e economia',

  render() {
    const list = insights.list();
    const open = list.filter((i) => !i.applied);
    const applied = list.filter((i) => i.applied);
    const canApply = auth.can('insights.apply');
    return html`
      <section class="kpi">
        <span class="label">Potencial de economia</span>
        <span class="val num">${fmtInt(insights.potential())} <small>m³/mês</small></span>
        <span class="small muted">${open.length} oportunidade(s) em aberto, calculadas sobre o consumo medido.</span>
      </section>
      <section class="stack">${open.map((i) => card(i, canApply))}</section>
      ${applied.length ? html`<section class="stack"><h2>Já aplicadas</h2>${applied.map((i) => card(i, false))}</section>` : ''}`;
  },

  actions: {
    apply(el, ctx) {
      insights.apply(el.dataset.id);
      flash('Oportunidade marcada como aplicada.');
      ctx.refresh();
    },
  },
};
