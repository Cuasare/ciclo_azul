/* Diálogo modal (elemento <dialog> nativo: foco preso, Esc fecha) e mensagem rápida */
import { esc } from '../core/html.js';
import { icon } from './icons.js';
import { wire } from '../core/wire.js';

/** handlers = { actions, forms, changes }, chamados com (el, api). api = { close, el, setBody } */
export function openDialog({ title, body, ...handlers }) {
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = `<div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></div><div class="sheet-body">${body}</div>`;
  document.body.appendChild(d);

  const content = d.querySelector('.sheet-body');
  const api = { el: content, close: () => d.close(), setBody: (html) => { content.innerHTML = String(html); } };
  wire(content, () => handlers, () => api);
  d.querySelector('[data-close]').addEventListener('click', api.close);
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // clique fora
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return api;
}

let timer;
/** Faixa de aviso logo abaixo do topo. level: info | warn */
export function flash(message, level = 'info') {
  const el = document.getElementById('flash');
  el.textContent = message;
  el.className = `flash ${level}`;
  clearTimeout(timer);
  timer = setTimeout(() => { el.className = 'flash hide'; }, 4000);
}
