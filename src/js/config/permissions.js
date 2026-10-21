/* Perfis e permissões fixos por nível de acesso (R01). No backend, a checagem real é feita na API. */

export const ROLES = {
  admin: { label: 'Administrador', short: 'Admin' },
  gestor: { label: 'Gestor Ambiental', short: 'Gestor' },
  operador: { label: 'Operador de Infraestrutura', short: 'Operador' },
  diretoria: { label: 'Diretoria', short: 'Diretoria' },
};

export const PERMS = {
  'water.monitor': 'Monitorar consumo de água em tempo real (R05)',
  'water.limits': 'Definir limites de consumo (R03)',
  'sensors.manage': 'Conectar sensores e registrar leituras manuais (R04)',
  'waste.types': 'Cadastrar e classificar tipos de resíduo (R07)',
  'waste.register': 'Criar lotes, registrar e retificar destinação (R06)',
  'waste.confirm': 'Confirmar destinação de resíduo perigoso (RN04)',
  'waste.view': 'Ver dados de destinação: Gestor e Diretoria (RN05)',
  'insights.view': 'Ver oportunidades de reuso (R02)',
  'insights.apply': 'Aplicar oportunidades de reuso (R02)',
  'reports.generate': 'Gerar relatórios de conformidade (R09)',
  'users.manage': 'Gerenciar usuários e perfis (R01)',
  'audit.view': 'Consultar histórico de auditoria (RNF02)',
};

export const ROLE_PERMS = {
  admin: ['users.manage', 'audit.view'],
  gestor: ['water.monitor', 'water.limits', 'waste.types', 'waste.register', 'waste.confirm', 'waste.view', 'insights.view', 'insights.apply', 'reports.generate'],
  operador: ['water.monitor', 'sensors.manage'],
  diretoria: ['waste.view'],
};

/** Tipos de alerta recebidos por perfil */
export const ALERT_KINDS = {
  admin: [],
  gestor: ['limite', 'residuo', 'sensor', 'licenca'],
  operador: ['limite', 'sensor'], // só das unidades pelas quais é responsável (RN03)
  diretoria: [],
};

/** Barra inferior. `perm` ausente = todos os perfis. */
export const NAV = [
  { path: '/painel', label: 'Painel', icon: 'home' },
  { path: '/agua', label: 'Água', icon: 'drop', perm: 'water.monitor' },
  { path: '/residuos', label: 'Resíduos', icon: 'flask', perm: 'waste.view' },
  { path: '/sensores', label: 'Sensores', icon: 'sensor', perm: 'sensors.manage' },
  { path: '/insights', label: 'Reuso', icon: 'bulb', perm: 'insights.view' },
  { path: '/relatorios', label: 'Relatórios', icon: 'file', perm: 'reports.generate' },
  { path: '/usuarios', label: 'Usuários', icon: 'users', perm: 'users.manage' },
  { path: '/auditoria', label: 'Auditoria', icon: 'list', perm: 'audit.view' },
];

