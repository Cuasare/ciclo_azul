import { html } from '../core/html.js';
import * as alerts from '../services/alerts.js';
import * as T from '../services/telemetry.js';
import { tag } from '../components/ui.js';
import { icon } from '../components/icons.js';

let unsub;

export default {
  title: 'Alertas',
  start(ctx) { unsub = T.subscribe(ctx.refresh); },
  stop() { unsub?.(); },

  render() {
    const list = alerts.list();
    return html`
      <p class="muted">Limites de consumo, lotes sem destinação, sensores e licenças. A lista se atualiza sozinha quando a situação muda.</p>
      ${list.length ? html`<div class="list">${list.map((a) => html`<div class="item">${icon('alert', 20)}<div class="grow">
        <div class="row wrap">${tag(a.level, a.level === 'crit' ? 'Crítico' : 'Atenção')}<span class="small muted">${alerts.KIND_LABEL[a.kind]}</span></div>
        <div class="t" style="margin-top:4px">${a.title}</div><div class="small muted">${a.body}</div></div></div>`)}</div>`
      : html`<div class="empty">${icon('check', 28)}<p>Nenhum alerta em aberto.</p></div>`}`;
  },
};
