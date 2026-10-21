/* Topo, barra de navegação e menu do usuário */
import * as store from '../core/store.js';
import { html, $, $$ } from '../core/html.js';
import { initials } from '../core/format.js';
import { icon } from './icons.js';
import { openDialog } from './dialog.js';
import { go } from '../core/router.js';
import * as auth from '../services/auth.js';
import * as alerts from '../services/alerts.js';
import { ROLES } from '../config/permissions.js';

let navUser = null;

export function updateBell() {
  $('#bell').classList.toggle('hide', !auth.hasAlerts());
  const n = alerts.list().length;
  const count = $('#bell-count');
  count.textContent = n;
  count.classList.toggle('hide', n === 0);
}

/** Atualiza título, contador de alertas e item ativo da navegação. */
export function paint(view, path) {
  const user = auth.currentUser();
  const isAuth = path === '/login';
  $('#app').classList.toggle('auth', isAuth);
  document.title = `${view.title} · Ciclo Azul`;
  if (isAuth || !user) return;

  $('#title').textContent = view.title;
  $('#user-btn').textContent = initials(user.name);
  updateBell();

  if (navUser !== user.id) {
    navUser = user.id;
    $('#nav').innerHTML = String(html`${auth.navItems().map((i) => html`<a href="#${i.path}" data-path="${i.path}">${icon(i.icon)}<span>${i.label}</span></a>`)}`);
  }
  $$('#nav a').forEach((a) => (a.dataset.path === path ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}

export function bindShell() {
  $('#user-btn').addEventListener('click', () => {
    const u = auth.currentUser();
    openDialog({
      title: 'Minha conta',
      body: html`<dl class="kv"><dt>Nome</dt><dd>${u.name}</dd><dt>E-mail</dt><dd>${u.email}</dd><dt>Perfil</dt><dd>${ROLES[u.role].label}</dd></dl>
        <button class="btn block" data-action="logout">${icon('logout')} Sair</button>
        <button class="btn sec block small" data-action="reset">Restaurar dados de demonstração</button>`,
      actions: {
        logout: (el, api) => { api.close(); auth.logout(); navUser = null; go('/login'); },
        reset: () => store.reset(),
      },
    });
  });
}
