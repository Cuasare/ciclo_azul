/* Histórico de ações (RNF02). Só existe `log` e leitura: nada é editado nem excluído.
   No backend, a imutabilidade é garantida por tabela somente de inserção. */
import * as store from '../core/store.js';

/** Retificações exigem justificativa (RNF02) */
export const MIN_REASON = 10;
export const validReason = (text) => (text ?? '').trim().length >= MIN_REASON;

export const LABELS = {
  'auth.login': 'Acesso',
  'auth.logout': 'Saída',
  'user.create': 'Usuário criado',
  'user.update': 'Usuário alterado',
  'sensor.connect': 'Sensor conectado',
  'sensor.status': 'Status do sensor',
  'limit.update': 'Limite alterado',
  'waste.type': 'Tipo de resíduo',
  'waste.batch': 'Lote criado',
  'waste.register': 'Destinação registrada',
  'waste.confirm': 'Destinação confirmada',
  'waste.rectify': 'Destinação retificada',
  'reading.manual': 'Leitura manual',
  'reading.rectify': 'Leitura retificada',
  'insight.apply': 'Oportunidade aplicada',
  'report.export': 'Relatório exportado',
};

export function log(action, detail) {
  const s = store.get();
  const u = s.users.find((x) => x.id === s.session?.userId);
  store.save((st) => {
    st.audit.push({ id: st.audit.length + 1, ts: Date.now(), actorId: u?.id ?? 'system', actorName: u?.name ?? 'Sistema', action, detail });
  });
}

export const all = () => store.get().audit;
