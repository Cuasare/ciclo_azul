import { html } from '../core/html.js';
import { fmtDec, fmtDate, fmtDateTime, fmtM3, toInputDate, fromInputDate } from '../core/format.js';
import * as store from '../core/store.js';
import { uid } from '../core/store.js';
import * as auth from '../services/auth.js';
import * as audit from '../services/audit.js';
import * as readings from '../services/readings.js';
import * as T from '../services/telemetry.js';
import { tag, empty, options, showErrors } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openDialog, flash } from '../components/dialog.js';

const PROTOCOLS = ['MQTT', 'API HTTP', 'LoRaWAN', 'Modbus TCP'];
const SYSTEMS = ['Torre de resfriamento A', 'Torre de resfriamento B', 'Torre de resfriamento C', 'Chiller 1', 'Chiller 2', 'Trocador de calor'];
const userName = (id) => store.get().users.find((u) => u.id === id)?.name ?? '—';

export default {
  title: 'Sensores IoT',

  render() {
    const { units, sensors } = store.get();
    const mine = new Set(auth.myUnits().map((u) => u.id));
    const online = sensors.filter((s) => s.status === 'online').length;
    const manual = readings.list().slice(0, 8);
    return html`
      <p class="muted">${online} de ${sensors.length} dispositivos enviando leituras. Você é responsável por: ${auth.myUnits().map((u) => u.name).join(', ') || 'nenhuma unidade'}.</p>
      <div class="stack">
        <button class="btn" data-action="connect">${icon('plus')} Conectar sensor</button>
        <button class="btn sec" data-action="manual">${icon('plus')} Registrar leitura manual (sem sensor)</button>
      </div>

      ${units.map((u) => html`<section><h2>${u.name}</h2><div class="list">${sensors.filter((s) => s.unitId === u.id).map((s) => html`
        <div class="item"><div class="grow">
          <div class="t">${s.name}</div>
          <div class="small muted">${s.system} · ${s.protocol}</div>
          <div class="tags">${s.status === 'online' ? tag('ok', `Online · ${fmtDec(T.sensorNow(s.id))} m³/h`) : tag('warn', `Offline${s.lastSeen ? ` desde ${fmtDateTime(s.lastSeen)}` : ''}`)}</div></div>
          ${mine.has(u.id) ? html`<button class="btn sec small" data-action="toggle" data-id="${s.id}">${s.status === 'online' ? 'Desconectar' : 'Reconectar'}</button>` : ''}</div>`)}</div></section>`)}

      <section><h2>Leituras manuais</h2>
        ${manual.length ? html`<div class="list">${manual.map((r) => html`<div class="item"><div class="grow">
          <div class="t">${units.find((u) => u.id === r.unitId).name} · ${r.system}</div>
          <div class="small muted">${fmtDate(r.date)} · registrada por ${userName(r.by)}</div>
          <div class="tags"><b class="num">${fmtM3(r.volume)}</b>${r.history.length ? tag('info', 'Retificada') : ''}</div>
          ${r.history.length ? html`<div class="small muted" style="margin-top:6px"><b>Valor original: ${fmtM3(r.original)}</b>${r.history.map((h) => html`<br>${fmtDateTime(h.at)} · ${userName(h.by)}: ${fmtM3(h.from)} → ${fmtM3(h.to)}. ${h.reason}`)}</div>` : ''}</div>
          ${mine.has(r.unitId) ? html`<button class="btn sec small" data-action="rectify" data-id="${r.id}">Retificar</button>` : ''}</div>`)}</div>`
        : empty('Nenhuma leitura manual registrada.')}
        <p class="small muted" style="margin-top:8px">Leituras não podem ser editadas nem excluídas. Para corrigir, use "Retificar", com justificativa; o valor original fica preservado.</p>
      </section>`;
  },

  actions: {
    toggle(el, ctx) {
      const s = store.get().sensors.find((x) => x.id === el.dataset.id);
      const next = s.status === 'online' ? 'offline' : 'online';
      store.save(() => { s.status = next; if (next === 'offline') s.lastSeen = Date.now(); });
      audit.log('sensor.status', `${s.name} (${store.get().units.find((u) => u.id === s.unitId).name}) ${next === 'online' ? 'reconectado' : 'desconectado'}`);
      ctx.refresh();
    },

    connect(el, ctx) {
      openDialog({
        title: 'Conectar sensor',
        body: html`<form class="stack" data-form="connect" novalidate>
          <div class="field"><label for="s-name">Nome do dispositivo</label><input class="input" id="s-name" name="name" placeholder="Ex.: Hidrômetro Torre C"><div data-e="name"></div></div>
          <div class="field"><label for="s-unit">Unidade</label><select class="input" id="s-unit" name="unitId">${options(auth.myUnits())}</select></div>
          <div class="field"><label for="s-sys">Sistema de refrigeração</label><input class="input" id="s-sys" name="system" list="systems" placeholder="Escolha ou digite"><datalist id="systems">${SYSTEMS.map((s) => html`<option value="${s}">`)}</datalist><div data-e="system"></div></div>
          <div class="field"><label for="s-proto">Protocolo</label><select class="input" id="s-proto" name="protocol">${PROTOCOLS.map((p) => html`<option>${p}</option>`)}</select></div>
          <button class="btn" type="submit">Conectar</button></form>`,
        forms: {
          connect(form, api) {
            const name = form.elements.name.value.trim();
            const system = form.system.value.trim();
            const errors = {};
            if (!name) errors.name = 'Informe o nome do dispositivo.';
            if (!system) errors.system = 'Informe o sistema de refrigeração.';
            showErrors(form, errors);
            if (Object.keys(errors).length) return;

            const sensor = { id: uid('sn'), name, unitId: form.unitId.value, system, protocol: form.protocol.value, baseFlow: 10 + Math.round(Math.random() * 10), status: 'online' };
            store.save((s) => { s.sensors.push(sensor); });
            audit.log('sensor.connect', `Sensor "${name}" conectado em ${store.get().units.find((u) => u.id === sensor.unitId).name} via ${sensor.protocol}`);
            const token = `ca_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 27);
            api.setBody(html`<div class="notice info">${icon('check', 20)}<span><b>Sensor conectado.</b> As leituras já aparecem no monitoramento.</span></div>
              <div class="field"><span class="lbl">Integração via API (exemplo)</span>
                <pre class="code">POST /api/v1/readings
Authorization: Bearer ${token}

{ "sensorId": "${sensor.id}",
  "flow_m3h": 12.4,
  "ts": "${new Date().toISOString()}" }</pre>
                <p class="hint">Exemplo ilustrativo: a ingestão real será ativada com o backend.</p></div>
              <button class="btn" data-action="done">Concluir</button>`);
            ctx.refresh();
          },
        },
        actions: { done: (e, api) => { api.close(); flash('Sensor adicionado.'); } },
      });
    },

    manual(el, ctx) {
      openDialog({
        title: 'Registrar leitura manual',
        body: html`<p class="small muted">Use quando o sistema de refrigeração não tem sensor. O volume entra no consumo do dia informado.</p>
          <form class="stack" data-form="manual" novalidate>
            <div class="field"><label for="m-unit">Unidade</label><select class="input" id="m-unit" name="unitId">${options(auth.myUnits())}</select><div data-e="unitId"></div></div>
            <div class="field"><label for="m-sys">Sistema de refrigeração</label><input class="input" id="m-sys" name="system" list="systems-m" placeholder="Ex.: Chiller 2"><datalist id="systems-m">${SYSTEMS.map((s) => html`<option value="${s}">`)}</datalist><div data-e="system"></div></div>
            <div class="field"><label for="m-vol">Volume consumido (m³)</label><input class="input" id="m-vol" name="volume" type="number" min="0" step="any" inputmode="decimal"><div data-e="volume"></div></div>
            <div class="field"><label for="m-date">Data da leitura</label><input class="input" id="m-date" name="date" type="date" value="${toInputDate(Date.now())}" max="${toInputDate(Date.now())}"><div data-e="date"></div></div>
            <button class="btn" type="submit">Registrar leitura</button></form>`,
        forms: {
          manual(form, api) {
            const r = readings.create({ unitId: form.unitId.value, system: form.system.value, volume: Number(form.volume.value), date: fromInputDate(form.date.value) });
            showErrors(form, r.errors);
            if (!r.ok) return;
            api.close(); flash('Leitura manual registrada.'); ctx.refresh();
          },
        },
      });
    },

    rectify(el, ctx) {
      const r = store.get().readings.find((x) => x.id === el.dataset.id);
      openDialog({
        title: 'Retificar leitura manual',
        body: html`<dl class="kv"><dt>Unidade</dt><dd>${store.get().units.find((u) => u.id === r.unitId).name}</dd><dt>Sistema</dt><dd>${r.system}</dd><dt>Data</dt><dd>${fmtDate(r.date)}</dd><dt>Valor original</dt><dd>${fmtM3(r.original)}</dd><dt>Valor atual</dt><dd>${fmtM3(r.volume)}</dd></dl>
          <form class="stack" data-form="rectify" novalidate>
            <div class="field"><label for="r-vol">Novo valor (m³)</label><input class="input" id="r-vol" name="volume" type="number" min="0" step="any" inputmode="decimal" value="${r.volume}"><div data-e="volume"></div></div>
            <div class="field"><label for="r-why">Justificativa (obrigatória)</label><textarea class="input" id="r-why" name="reason" placeholder="Explique o motivo da correção"></textarea><div data-e="reason"></div></div>
            <p class="hint">O valor atual não é apagado: fica registrado no histórico da leitura e na auditoria.</p>
            <button class="btn" type="submit">Registrar retificação</button></form>`,
        forms: {
          rectify(form, api) {
            const res = readings.rectify(r.id, { volume: Number(form.volume.value), reason: form.reason.value });
            showErrors(form, res.errors);
            if (!res.ok) return;
            api.close(); flash('Leitura retificada. O valor original foi preservado.'); ctx.refresh();
          },
        },
      });
    },
  },
};
