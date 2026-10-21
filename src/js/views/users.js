import { html } from '../core/html.js';
import * as store from '../core/store.js';
import { uid } from '../core/store.js';
import * as auth from '../services/auth.js';
import * as audit from '../services/audit.js';
import { ROLES, PERMS, ROLE_PERMS } from '../config/permissions.js';
import { tag, showErrors } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openDialog, flash } from '../components/dialog.js';

const roleOptions = (selected) => Object.entries(ROLES).map(([k, r]) => html`<option value="${k}" ${k === selected ? 'selected' : ''}>${r.label}</option>`);
const unitNames = (u) => (u.unitIds ?? []).map((id) => store.get().units.find((x) => x.id === id)?.name).filter(Boolean).join(', ');

/** Checkboxes das unidades pelas quais o Operador é responsável (RN03) */
const unitChecks = (selected = []) => html`<div class="field"><span class="lbl">Unidades sob responsabilidade (para Operador)</span>
  ${store.get().units.map((u) => html`<label class="check"><input type="checkbox" name="unit" value="${u.id}" ${selected.includes(u.id) ? 'checked' : ''}> ${u.name}</label>`)}
  <p class="hint">O Operador recebe alertas de limite e de sensor só destas unidades e registra leituras apenas nelas.</p><div data-e="units"></div></div>`;

const pickedUnits = (form) => [...form.querySelectorAll('input[name=unit]:checked')].map((i) => i.value);

export default {
  title: 'Usuários e perfis',

  render() {
    const me = auth.currentUser();
    return html`
      <button class="btn" data-action="new">${icon('plus')} Novo usuário</button>
      <section><h2>Usuários</h2>
        <div class="list">${store.get().users.map((u) => html`<button class="item" data-action="edit" data-id="${u.id}"><div class="grow">
          <div class="t">${u.name}${u.id === me.id ? ' (você)' : ''}</div><div class="small muted">${u.email}</div>
          ${u.role === 'operador' ? html`<div class="small muted">Unidades: ${unitNames(u) || 'nenhuma'}</div>` : ''}
          <div class="tags">${tag('info', ROLES[u.role].short)}${u.active ? '' : tag('warn', 'Inativo')}</div></div>${icon('chevron', 18)}</button>`)}</div></section>
      <section><h2>Permissões por nível de acesso</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>Permissão</th>${Object.values(ROLES).map((r) => html`<th class="c">${r.short}</th>`)}</tr></thead>
          <tbody>${Object.entries(PERMS).map(([k, label]) => html`<tr><td>${label}</td>${Object.keys(ROLES).map((r) => html`<td class="c">${ROLE_PERMS[r].includes(k) ? html`<span aria-label="Sim">${icon('check', 16)}</span>` : html`<span class="muted" aria-label="Não">–</span>`}</td>`)}</tr>`)}</tbody>
        </table></div>
        <p class="small muted" style="margin-top:8px">O nível de acesso de cada usuário define o que ele pode fazer. A regra definitiva é aplicada pela API.</p></section>`;
  },

  actions: {
    edit(el, ctx) {
      const u = store.get().users.find((x) => x.id === el.dataset.id);
      const self = u.id === auth.currentUser().id;
      openDialog({
        title: u.name,
        body: html`<p class="muted small">${u.email}</p>
          <form class="stack" data-form="edit" novalidate>
            <div class="field"><label for="u-role">Nível de acesso</label><select class="input" id="u-role" name="role" ${self ? 'disabled' : ''}>${roleOptions(u.role)}</select></div>
            ${unitChecks(u.unitIds)}
            <label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} ${self ? 'disabled' : ''}> Conta ativa</label>
            ${self ? html`<p class="small muted">Você não pode alterar o próprio nível de acesso nem desativar a própria conta.</p>` : ''}
            <button class="btn" type="submit">Salvar alterações</button>
          </form>`,
        forms: {
          edit(form, api) {
            const role = self ? u.role : form.elements.role.value;
            const active = self ? u.active : form.active.checked;
            const unitIds = role === 'operador' ? pickedUnits(form) : [];
            const errors = role === 'operador' && !unitIds.length ? { units: 'Selecione ao menos uma unidade para o Operador.' } : {};
            showErrors(form, errors);
            if (Object.keys(errors).length) return;

            const changes = [];
            if (role !== u.role) changes.push(`nível ${ROLES[u.role].short} → ${ROLES[role].short}`);
            if (active !== u.active) changes.push(active ? 'ativado' : 'desativado');
            if (JSON.stringify(unitIds) !== JSON.stringify(u.unitIds ?? [])) changes.push('unidades alteradas');
            store.save(() => { u.role = role; u.active = active; u.unitIds = unitIds; });
            if (changes.length) audit.log('user.update', `${u.name}: ${changes.join(', ')}`);
            api.close(); flash('Usuário atualizado.'); ctx.refresh();
          },
        },
      });
    },

    new(el, ctx) {
      openDialog({
        title: 'Novo usuário',
        body: html`<form class="stack" data-form="new" novalidate>
          <div class="field"><label for="n-name">Nome completo</label><input class="input" id="n-name" name="fullname"><div data-e="name"></div></div>
          <div class="field"><label for="n-email">E-mail</label><input class="input" id="n-email" name="email" type="email" inputmode="email"><div data-e="email"></div></div>
          <div class="field"><label for="n-role">Nível de acesso</label><select class="input" id="n-role" name="role">${roleOptions('operador')}</select></div>
          ${unitChecks()}
          <button class="btn" type="submit">Criar usuário</button></form>`,
        forms: {
          new(form, api) {
            const name = form.fullname.value.trim();
            const email = form.email.value.trim().toLowerCase();
            const role = form.elements.role.value;
            const unitIds = role === 'operador' ? pickedUnits(form) : [];
            const errors = {};
            if (!name) errors.name = 'Informe o nome completo.';
            if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Informe um e-mail válido.';
            else if (store.get().users.some((x) => x.email === email)) errors.email = 'Já existe um usuário com este e-mail.';
            if (role === 'operador' && !unitIds.length) errors.units = 'Selecione ao menos uma unidade para o Operador.';
            showErrors(form, errors);
            if (Object.keys(errors).length) return;

            store.save((s) => { s.users.push({ id: uid('u'), name, email, role, active: true, unitIds }); });
            audit.log('user.create', `${name} criado com nível ${ROLES[role].label}`);
            api.close(); flash('Usuário criado.'); ctx.refresh();
          },
        },
      });
    },
  },
};
