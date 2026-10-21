/* Peças visuais reutilizadas pelas telas */
import { html } from '../core/html.js';
import { icon } from './icons.js';

const TAG_ICON = { ok: 'check', info: 'info', warn: 'alert', crit: 'alert', none: null };

/** Etiqueta de estado. Sempre ícone + texto, nunca só cor. level: none | ok | info | warn | crit */
export const tag = (level, text) => html`<span class="tag ${level}">${TAG_ICON[level] ? icon(TAG_ICON[level], 14) : ''}${text}</span>`;

export const bar = (ratio, level = 'ok') => html`<div class="bar ${level}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(ratio, 1) * 100)}"><i style="width:${Math.min(ratio, 1) * 100}%"></i></div>`;

export const empty = (text) => html`<div class="empty">${text}</div>`;

export const errorLine = (text) => html`<p class="error">${icon('alert', 16)}${text}</p>`;

export const options = (list, selected, label = (x) => x.name) => list.map((x) => html`<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${label(x)}</option>`);

/** Mostra erros por campo em elementos [data-e="campo"] do formulário (e limpa os anteriores) */
export function showErrors(form, errors) {
  form.querySelectorAll('[data-e]').forEach((e) => { e.innerHTML = ''; });
  Object.entries(errors ?? {}).forEach(([k, msg]) => {
    const target = form.querySelector(`[data-e="${k}"]`);
    if (target) target.innerHTML = String(errorLine(msg));
  });
}
