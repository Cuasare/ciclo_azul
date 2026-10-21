/* Dados fictícios iniciais. No backend, vêm da API. */
import { daysFromNow } from '../core/format.js';

export const DEMO_PASSWORD = 'ciclo123';

export function seed() {
  const companies = [
    { id: 'co-eco', name: 'EcoQuímica Ambiental', license: 'LO-2043/2025', licenseUntil: daysFromNow(420), city: 'Paulínia/SP' },
    { id: 'co-metais', name: 'Recicla Metais Brasil', license: 'LO-8812/2024', licenseUntil: daysFromNow(58), city: 'Cubatão/SP' },
    { id: 'co-hidro', name: 'Hidro Reuso Soluções', license: 'LO-1190/2023', licenseUntil: daysFromNow(-20), city: 'Fortaleza/CE' },
    { id: 'co-verde', name: 'Verde Destino Resíduos', license: 'LO-5531/2025', licenseUntil: daysFromNow(280), city: 'Campinas/SP' },
  ];
  const dest = (companyId, local, daysAgo, qty, proof, by, confirmedBy = null) => {
    const c = companies.find((x) => x.id === companyId);
    return { companyId, license: { number: c.license, until: c.licenseUntil }, local, date: daysFromNow(-daysAgo), qty, proof: { name: proof, size: 184320 }, registeredBy: by, confirmedBy, history: [] };
  };

  const entry = (id, daysAgo, actorId, actorName, action, detail) => ({ id, ts: daysFromNow(-daysAgo), actorId, actorName, action, detail });

  return {
    session: null,
    users: [
      { id: 'u-ana', name: 'Ana Souza', email: 'ana@ciclo.azul', role: 'admin', active: true },
      { id: 'u-marina', name: 'Marina Costa', email: 'marina@ciclo.azul', role: 'gestor', active: true },
      { id: 'u-rafael', name: 'Rafael Lima', email: 'rafael@ciclo.azul', role: 'gestor', active: true },
      { id: 'u-diego', name: 'Diego Alves', email: 'diego@ciclo.azul', role: 'operador', active: true, unitIds: ['dc-sp1', 'dc-cps'] },
      { id: 'u-paulo', name: 'Paulo Nunes', email: 'paulo@ciclo.azul', role: 'operador', active: true, unitIds: ['dc-for'] },
      { id: 'u-helena', name: 'Helena Prado', email: 'helena@ciclo.azul', role: 'diretoria', active: true },
    ],
    limits: { general: 3000 },
    units: [
      { id: 'dc-sp1', name: 'DC São Paulo 1', city: 'São Paulo/SP', limit: 1200, todayRatio: 0.74 },
      { id: 'dc-cps', name: 'DC Campinas', city: 'Campinas/SP', limit: 900, todayRatio: 0.86 },
      { id: 'dc-for', name: 'DC Fortaleza', city: 'Fortaleza/CE', limit: 1100, todayRatio: 0.41 },
    ],
    sensors: [
      { id: 'sn-01', name: 'Hidrômetro Torre A', unitId: 'dc-sp1', system: 'Torre de resfriamento A', protocol: 'MQTT', baseFlow: 22, status: 'online' },
      { id: 'sn-02', name: 'Hidrômetro Torre B', unitId: 'dc-sp1', system: 'Torre de resfriamento B', protocol: 'MQTT', baseFlow: 18, status: 'online' },
      { id: 'sn-03', name: 'Vazão Chiller 1', unitId: 'dc-cps', system: 'Chiller 1', protocol: 'API HTTP', baseFlow: 18, status: 'online' },
      { id: 'sn-04', name: 'Hidrômetro Torre 1', unitId: 'dc-cps', system: 'Torre de resfriamento 1', protocol: 'LoRaWAN', baseFlow: 16, status: 'online' },
      { id: 'sn-05', name: 'Vazão Chiller 1', unitId: 'dc-for', system: 'Chiller 1', protocol: 'Modbus TCP', baseFlow: 20, status: 'online' },
      { id: 'sn-06', name: 'Hidrômetro Torre 1', unitId: 'dc-for', system: 'Torre de resfriamento 1', protocol: 'MQTT', baseFlow: 16, status: 'online' },
      { id: 'sn-07', name: 'Vazão Chiller 2', unitId: 'dc-for', system: 'Chiller 2', protocol: 'LoRaWAN', baseFlow: 12, status: 'offline' },
    ],
    wasteTypes: [
      { id: 'wt-glicol', name: 'Líquido de arrefecimento (glicol com inibidores)', klass: 'I', category: 'Químico' },
      { id: 'wt-lodo', name: 'Lodo de torre (cromo e zinco)', klass: 'I', category: 'Metal pesado' },
      { id: 'wt-bateria', name: 'Baterias chumbo-ácido', klass: 'I', category: 'Metal pesado' },
      { id: 'wt-biocida', name: 'Biocidas e anticorrosivos', klass: 'I', category: 'Químico' },
      { id: 'wt-filtro', name: 'Filtros e elementos filtrantes usados', klass: 'IIA', category: 'Sólido' },
      { id: 'wt-resina', name: 'Resina de troca iônica esgotada', klass: 'IIA', category: 'Sólido' },
      { id: 'wt-purga', name: 'Água de purga tratada', klass: 'IIB', category: 'Efluente' },
    ],
    companies,
    batches: [
      { id: 'L-0141', typeId: 'wt-lodo', unitId: 'dc-sp1', qty: 340, unit: 'kg', generatedAt: daysFromNow(-12), deadlineDays: 30, status: 'pendente', destination: null },
      { id: 'L-0138', typeId: 'wt-bateria', unitId: 'dc-cps', qty: 120, unit: 'kg', generatedAt: daysFromNow(-35), deadlineDays: 30, status: 'pendente', destination: null },
      { id: 'L-0140', typeId: 'wt-glicol', unitId: 'dc-for', qty: 800, unit: 'L', generatedAt: daysFromNow(-8), deadlineDays: 15, status: 'aguardando', destination: dest('co-eco', 'Paulínia/SP', 1, 800, 'comprovante-mtr-0140.pdf', 'u-rafael') },
      { id: 'L-0142', typeId: 'wt-purga', unitId: 'dc-for', qty: 5000, unit: 'L', generatedAt: daysFromNow(-3), deadlineDays: 15, status: 'pendente', destination: null },
      { id: 'L-0143', typeId: 'wt-biocida', unitId: 'dc-sp1', qty: 60, unit: 'L', generatedAt: daysFromNow(-27), deadlineDays: 30, status: 'pendente', destination: null },
      { id: 'L-0129', typeId: 'wt-filtro', unitId: 'dc-sp1', qty: 90, unit: 'kg', generatedAt: daysFromNow(-20), deadlineDays: 30, status: 'destinado', destination: dest('co-verde', 'Campinas/SP', 11, 90, 'mtr-0129.pdf', 'u-marina') },
      { id: 'L-0121', typeId: 'wt-resina', unitId: 'dc-cps', qty: 200, unit: 'kg', generatedAt: daysFromNow(-40), deadlineDays: 30, status: 'destinado', destination: dest('co-verde', 'Campinas/SP', 22, 200, 'mtr-0121.pdf', 'u-marina') },
      { id: 'L-0112', typeId: 'wt-lodo', unitId: 'dc-cps', qty: 280, unit: 'kg', generatedAt: daysFromNow(-50), deadlineDays: 30, status: 'destinado', destination: dest('co-metais', 'Cubatão/SP', 30, 280, 'mtr-0112.pdf', 'u-marina', 'u-rafael') },
    ],
    readings: [
      { id: 'lm-seed', unitId: 'dc-for', system: 'Chiller 2', volume: 96, original: 90, date: daysFromNow(-2), at: daysFromNow(-2), by: 'u-paulo',
        history: [{ at: daysFromNow(-1), by: 'u-paulo', from: 90, to: 96, reason: 'Erro de digitação na leitura do hidrômetro manual' }] },
    ],
    insights: {},
    reports: [],
    savedBaseline: 2400, // m³/mês economizados antes do app (referência fictícia)
    audit: [
      entry(1, 30, 'u-marina', 'Marina Costa', 'waste.confirm', 'Lote L-0112 destinado (confirmado por Rafael Lima)'),
      entry(2, 22, 'u-marina', 'Marina Costa', 'waste.register', 'Lote L-0121 destinado'),
      entry(3, 11, 'u-marina', 'Marina Costa', 'waste.register', 'Lote L-0129 destinado'),
      entry(4, 1, 'u-rafael', 'Rafael Lima', 'waste.register', 'Lote L-0140 enviado para 2ª confirmação'),
    ],
  };
}
