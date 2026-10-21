import { html, $ } from '../core/html.js';
import { fmtDate, fmtDateTime, toInputDate, fromInputDate } from '../core/format.js';
import * as store from '../core/store.js';
import * as auth from '../services/auth.js';
import * as waste from '../services/waste.js';
import { tag, errorLine, empty, options, showErrors } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openDialog, flash } from '../components/dialog.js';

const ui = { tab: 'lotes', filter: 'todos' };

const FILTERS = [['todos', 'Todos'], ['pendente', 'Sem destinação'], ['aguardando', 'Aguardando 2ª confirmação'], ['destinado', 'Destinados'], ['vencido', 'Vencidos']];
const matches = (b) => ui.filter === 'todos' || (ui.filter === 'vencido' ? waste.deadline(b).state === 'overdue' : b.status === ui.filter);

const hazardTag = (klass) => (waste.CLASSES[klass].hazardous ? tag('warn', 'Perigoso') : tag('none', waste.CLASSES[klass].label));

function deadlineTag(b) {
  const d = waste.deadline(b);
  if (d.state === 'overdue') return tag('crit', `Vencido há ${-d.days} d`);
  if (d.state === 'soon') return tag('warn', `Vence em ${d.days} d`);
  return d.state === 'ok' ? html`<span class="small muted">Prazo ${fmtDate(d.due)}</span>` : '';
}

export default {
  title: 'Resíduos',

  render() {
    const s = store.get();
    const lots = s.batches.filter(matches);
    return html`
      <div class="tabs" role="tablist">
        <button role="tab" data-action="tab" data-tab="lotes" aria-selected="${ui.tab === 'lotes'}">Lotes</button>
        <button role="tab" data-action="tab" data-tab="tipos" aria-selected="${ui.tab === 'tipos'}">Tipos de resíduo</button>
      </div>
      ${ui.tab === 'lotes' ? html`
        <div class="field"><label for="filter">Filtrar</label><select class="input" id="filter" data-change="filter">${FILTERS.map(([v, l]) => html`<option value="${v}" ${ui.filter === v ? 'selected' : ''}>${l}</option>`)}</select></div>
        ${auth.can('waste.register') ? html`<button class="btn" data-action="new-batch">${icon('plus')} Novo lote</button>` : ''}
        ${lots.length ? html`<div class="list">${lots.map((b) => {
          const t = waste.typeOf(b.typeId);
          const st = waste.STATUS[b.status];
          return html`<button class="item" data-action="open" data-id="${b.id}"><div class="grow">
            <div class="t">${t.name}</div>
            <div class="small muted">${b.id} · ${waste.unitOf(b.unitId).name} · ${b.qty} ${b.unit}</div>
            <div class="tags">${hazardTag(t.klass)}${tag(st.level, st.label)}${deadlineTag(b)}</div></div>${icon('chevron', 18)}</button>`;
        })}</div>` : empty('Nenhum lote neste filtro.')}`
      : html`
        ${auth.can('waste.types') ? html`<button class="btn" data-action="new-type">${icon('plus')} Novo tipo de resíduo</button>` : ''}
        <div class="list">${s.wasteTypes.map((t) => html`<div class="item"><div class="grow"><div class="t">${t.name}</div><div class="small muted">${t.category}</div></div>${hazardTag(t.klass)}</div>`)}</div>`}`;
  },

  changes: { filter(el, ctx) { ui.filter = el.value; ctx.refresh(); } },

  actions: {
    tab(el, ctx) { ui.tab = el.dataset.tab; ctx.refresh(); },
    open(el, ctx) { openBatch(el.dataset.id, ctx); },
    'new-batch'(el, ctx) { openNewBatch(ctx); },
    'new-type'(el, ctx) { openNewType(ctx); },
  },
};

/* ---------- Detalhe do lote e registro de destinação ---------- */

function openBatch(id, ctx) {
  const b = store.get().batches.find((x) => x.id === id);
  const t = waste.typeOf(b.typeId);
  const me = auth.currentUser();
  const st = waste.STATUS[b.status];

  const destination = () => {
    const d = b.destination;
    if (!d) return '';
    if (!auth.can('waste.view')) return html`<div class="card">${icon('lock', 16)} Dados de destinação restritos ao Gestor Ambiental e à Diretoria.</div>`;
    const c = waste.companyOf(d.companyId);
    return html`<div class="card stack"><h3>Destinação</h3><dl class="kv">
      <dt>Empresa receptora</dt><dd>${c.name}</dd>
      <dt>Licença</dt><dd>${d.license.number} (até ${fmtDate(d.license.until)})</dd>
      <dt>Local</dt><dd>${d.local}</dd>
      <dt>Data</dt><dd>${fmtDate(d.date)}</dd>
      <dt>Quantidade destinada</dt><dd>${d.qty} ${b.unit}</dd>
      <dt>Comprovante</dt><dd>${d.proof.name}</dd>
      <dt>Registrado por</dt><dd>${waste.userOf(d.registeredBy)?.name}</dd>
      ${d.confirmedBy ? html`<dt>Confirmado por</dt><dd>${waste.userOf(d.confirmedBy)?.name}</dd>` : ''}</dl>
      ${d.history.length ? html`<h3>Retificações (valores originais preservados)</h3><div class="list">${d.history.map((h) => html`<div class="item"><div class="grow">
        <div class="small muted">${fmtDateTime(h.at)} · ${waste.userOf(h.by)?.name}</div>
        <div>${h.reason}</div>
        ${Object.entries(h.changes).map(([k, v]) => html`<div class="small"><b>${k}:</b> ${v.from} → ${v.to}</div>`)}</div></div>`)}</div>` : ''}
      ${auth.can('waste.register') ? html`<button class="btn sec" data-action="rectify">Retificar destinação</button>` : ''}
    </div>`;
  };

  const action = () => {
    if (b.status === 'aguardando') {
      if (auth.can('waste.confirm') && b.destination.registeredBy !== me.id) return html`<div data-e="confirm"></div><button class="btn" data-action="confirm">${icon('check')} Confirmar destinação</button>`;
      return html`<div class="notice info">${icon('info', 20)}<span>Resíduo perigoso: a destinação só conclui depois que <b>outro</b> Gestor Ambiental confirmar.</span></div>`;
    }
    if (b.status !== 'pendente') return '';
    if (!auth.can('waste.register')) return html`<p class="muted small">Sem destinação registrada. Apenas o Gestor Ambiental pode registrar.</p>`;
    return html`<form class="stack" data-form="dest" novalidate>
      <h3>Registrar destinação</h3>
      ${waste.isHazardous(b) ? html`<div class="notice info">${icon('info', 20)}<span>Resíduo <b>perigoso</b>: depois do registro, outro Gestor Ambiental precisa confirmar.</span></div>` : ''}
      <div class="field"><label for="d-co">Empresa receptora</label>
        <select class="input" id="d-co" name="companyId" data-change="company"><option value="">Selecione…</option>
          ${store.get().companies.map((c) => html`<option value="${c.id}" ${waste.licenseValid(c) ? '' : 'disabled'}>${c.name}${waste.licenseValid(c) ? '' : ' (licença vencida)'}</option>`)}</select>
        <p class="hint" id="lic-info"></p><div data-e="companyId"></div></div>
      <div class="field"><label for="d-local">Local de destinação</label><input class="input" id="d-local" name="local" placeholder="Cidade/UF ou endereço"><div data-e="local"></div></div>
      <div class="field-row row"><div class="field grow"><label for="d-date">Data</label><input class="input" id="d-date" name="date" type="date" value="${toInputDate(Date.now())}" max="${toInputDate(Date.now())}"><div data-e="date"></div></div>
        <div class="field grow"><label for="d-qty">Quantidade (${b.unit})</label><input class="input" id="d-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" value="${b.qty}"><div data-e="qty"></div></div></div>
      <div class="field"><label for="d-proof">Comprovante de destinação (obrigatório)</label><input class="input" id="d-proof" name="proof" type="file" accept="application/pdf,image/*"><div data-e="proof"></div></div>
      <button class="btn" type="submit">Registrar destinação</button></form>`;
  };

  openDialog({
    title: `Lote ${b.id}`,
    body: html`
      <div class="row wrap">${hazardTag(t.klass)}${tag(st.level, st.label)}${deadlineTag(b)}</div>
      <dl class="kv"><dt>Resíduo</dt><dd>${t.name}</dd><dt>Categoria</dt><dd>${t.category}</dd><dt>Unidade</dt><dd>${waste.unitOf(b.unitId).name}</dd><dt>Quantidade do lote</dt><dd>${b.qty} ${b.unit}</dd><dt>Gerado em</dt><dd>${fmtDate(b.generatedAt)}</dd><dt>Prazo para destinar</dt><dd>${fmtDate(waste.deadline(b).due)}</dd></dl>
      ${destination()}${action()}`,
    actions: {
      confirm(el, api) {
        const r = waste.confirmDestination(b.id);
        if (!r.ok) { $('[data-e=confirm]', api.el).innerHTML = String(errorLine(r.error)); return; }
        api.close(); flash(`Lote ${b.id} destinado.`); ctx.refresh();
      },
      rectify(el, api) { api.close(); openRectify(b.id, ctx); },
    },
    changes: {
      company(el, api) {
        const c = waste.companyOf(el.value);
        if (c) api.el.querySelector('[name=local]').value = c.city;
        api.el.querySelector('#lic-info').textContent = c ? `Licença ${c.license}, válida até ${fmtDate(c.licenseUntil)}.` : '';
      },
    },
    forms: {
      dest(form, api) {
        const file = form.proof.files[0];
        const r = waste.registerDestination(b.id, {
          companyId: form.companyId.value,
          local: form.local.value,
          date: fromInputDate(form.date.value),
          qty: Number(form.qty.value),
          proof: file ? { name: file.name, size: file.size } : null,
        });
        showErrors(form, r.errors);
        if (!r.ok) return;
        api.close();
        flash(r.hazardous ? `Lote ${b.id} enviado para confirmação de outro usuário.` : `Lote ${b.id} destinado.`);
        ctx.refresh();
      },
    },
  });
}

/* ---------- Retificação justificada da destinação (RNF02) ---------- */

function openRectify(id, ctx) {
  const b = store.get().batches.find((x) => x.id === id);
  const d = b.destination;
  openDialog({
    title: `Retificar destinação · ${b.id}`,
    body: html`<p class="small muted">Os valores atuais não são apagados: ficam no histórico do lote, com a justificativa.${waste.isHazardous(b) ? ' Em resíduo perigoso, outro Gestor Ambiental precisa confirmar de novo.' : ''}</p>
      <form class="stack" data-form="rectify" novalidate>
        <div class="field"><label for="r-co">Empresa receptora</label><select class="input" id="r-co" name="companyId">
          ${store.get().companies.map((c) => html`<option value="${c.id}" ${c.id === d.companyId ? 'selected' : ''} ${waste.licenseValid(c, d.date) ? '' : 'disabled'}>${c.name}${waste.licenseValid(c, d.date) ? '' : ' (licença vencida)'}</option>`)}</select><div data-e="companyId"></div></div>
        <div class="field"><label for="r-local">Local de destinação</label><input class="input" id="r-local" name="local" value="${d.local}"><div data-e="local"></div></div>
        <div class="field-row row"><div class="field grow"><label for="r-date">Data</label><input class="input" id="r-date" name="date" type="date" value="${toInputDate(d.date)}" max="${toInputDate(Date.now())}"><div data-e="date"></div></div>
          <div class="field grow"><label for="r-qty">Quantidade (${b.unit})</label><input class="input" id="r-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" value="${d.qty}"><div data-e="qty"></div></div></div>
        <div class="field"><label for="r-why">Justificativa (obrigatória)</label><textarea class="input" id="r-why" name="reason" placeholder="Explique o motivo da retificação"></textarea><div data-e="reason"></div></div>
        <div data-e="form"></div>
        <button class="btn" type="submit">Registrar retificação</button></form>`,
    forms: {
      rectify(form, api) {
        const r = waste.rectifyDestination(b.id, {
          companyId: form.companyId.value, local: form.local.value, date: fromInputDate(form.date.value), qty: Number(form.qty.value), reason: form.reason.value,
        });
        showErrors(form, r.errors);
        if (!r.ok) return;
        api.close();
        flash(r.hazardous ? 'Retificação registrada. Aguarda nova confirmação de outro usuário.' : 'Retificação registrada. Os valores originais foram preservados.');
        ctx.refresh();
      },
    },
  });
}

/* ---------- Novo lote / novo tipo ---------- */

function openNewBatch(ctx) {
  const { wasteTypes, units } = store.get();
  openDialog({
    title: 'Novo lote de resíduo',
    body: html`<form class="stack" data-form="batch" novalidate>
      <div class="field"><label for="b-type">Tipo de resíduo</label><select class="input" id="b-type" name="typeId">${options(wasteTypes, null, (t) => `${t.name} (${waste.CLASSES[t.klass].label})`)}</select></div>
      <div class="field"><label for="b-unit">Unidade geradora</label><select class="input" id="b-unit" name="unitId">${options(units)}</select></div>
      <div class="field-row row"><div class="field grow"><label for="b-qty">Quantidade</label><input class="input" id="b-qty" name="qty" type="number" min="0" step="any" inputmode="decimal"><div data-e="qty"></div></div>
        <div class="field"><label for="b-m">Medida</label><select class="input" id="b-m" name="measure"><option>kg</option><option>L</option><option>un</option></select></div></div>
      <button class="btn" type="submit">Criar lote</button></form>`,
    forms: {
      batch(form, api) {
        const qty = Number(form.qty.value);
        showErrors(form, qty > 0 ? {} : { qty: 'Informe uma quantidade maior que zero.' });
        if (!(qty > 0)) return;
        const b = waste.createBatch({ typeId: form.typeId.value, unitId: form.unitId.value, qty, unit: form.measure.value });
        api.close(); flash(`Lote ${b.id} criado.`); ctx.refresh();
      },
    },
  });
}

function openNewType(ctx) {
  openDialog({
    title: 'Novo tipo de resíduo',
    body: html`<form class="stack" data-form="type" novalidate>
      <div class="field"><label for="t-name">Nome</label><input class="input" id="t-name" name="name" placeholder="Ex.: Óleo lubrificante usado"><div data-e="name"></div></div>
      <div class="field"><label for="t-class">Classificação (ABNT NBR 10004)</label><select class="input" id="t-class" name="klass">${Object.entries(waste.CLASSES).map(([k, c]) => html`<option value="${k}">${c.label}</option>`)}</select><p class="hint">Classe I exige confirmação de um 2º Gestor Ambiental na destinação.</p></div>
      <div class="field"><label for="t-cat">Categoria</label><input class="input" id="t-cat" name="category" placeholder="Químico, Metal pesado, Efluente…"></div>
      <button class="btn" type="submit">Cadastrar tipo</button></form>`,
    forms: {
      type(form, api) {
        const name = form.elements.name.value;
        showErrors(form, name.trim() ? {} : { name: 'Informe o nome do resíduo.' });
        if (!name.trim()) return;
        waste.createType({ name, klass: form.klass.value, category: form.category.value });
        api.close(); flash('Tipo de resíduo cadastrado.'); ctx.refresh();
      },
    },
  });
}
