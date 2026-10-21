import { html, $ } from '../core/html.js';
import * as store from '../core/store.js';
import * as auth from '../services/auth.js';
import { DEMO_PASSWORD } from '../data/seed.js';
import { ROLES } from '../config/permissions.js';
import { errorLine } from '../components/ui.js';

export default {
  title: 'Entrar',

  render() {
    const demo = Object.keys(ROLES).map((r) => store.get().users.find((u) => u.role === r && u.active)).filter(Boolean);
    return html`<div class="login">
      <div><h1>Ciclo Azul</h1><p class="muted">Monitoramento de água e rastreamento de resíduos em data centers.</p></div>
      <form class="stack" data-form="login" novalidate>
        <div class="field"><label for="email">E-mail</label><input class="input" id="email" name="email" type="email" autocomplete="username" inputmode="email"></div>
        <div class="field"><label for="pw">Senha</label><input class="input" id="pw" name="password" type="password" autocomplete="current-password"></div>
        <div id="login-error" aria-live="polite"></div>
        <button class="btn" type="submit">Entrar</button>
      </form>
      <div class="stack">
        <p class="small muted">Modo demonstração. Senha: <b>${DEMO_PASSWORD}</b>. Toque para preencher:</p>
        <div class="row wrap">${demo.map((u) => html`<button type="button" class="btn sec small" data-action="fill" data-email="${u.email}">${ROLES[u.role].short}</button>`)}</div>
      </div>
    </div>`;
  },

  actions: {
    fill(el) {
      $('#email').value = el.dataset.email;
      $('#pw').value = DEMO_PASSWORD;
    },
  },

  forms: {
    login(form, ctx) {
      const res = auth.login(form.email.value, form.password.value);
      if (res.ok) ctx.go('/painel');
      else $('#login-error').innerHTML = String(errorLine(res.error));
    },
  },
};
