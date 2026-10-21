/* Login e controle de acesso (RNF01). Protótipo: no backend, autenticação com token e TLS. */
import * as store from '../core/store.js';
import { ROLES, ROLE_PERMS, NAV, ALERT_KINDS } from '../config/permissions.js';
import { DEMO_PASSWORD } from '../data/seed.js';
import * as audit from './audit.js';

const SESSION_MS = 8 * 3600e3;

export function currentUser() {
  const { session, users } = store.get();
  if (!session || Date.now() - session.at > SESSION_MS) return null;
  const u = users.find((x) => x.id === session.userId);
  return u?.active ? u : null;
}

export function login(email, password) {
  const u = store.get().users.find((x) => x.email === email.trim().toLowerCase());
  if (!u || password !== DEMO_PASSWORD) return { ok: false, error: 'E-mail ou senha incorretos.' };
  if (!u.active) return { ok: false, error: 'Usuário desativado. Procure o administrador.' };
  store.save((s) => { s.session = { userId: u.id, at: Date.now() }; });
  audit.log('auth.login', `${u.name} entrou como ${ROLES[u.role].label}`);
  return { ok: true };
}

export function logout() {
  const u = currentUser();
  if (u) audit.log('auth.logout', `${u.name} saiu`);
  store.save((s) => { s.session = null; });
}

export const can = (perm) => (ROLE_PERMS[currentUser()?.role] ?? []).includes(perm);
export const navItems = () => NAV.filter((n) => !n.perm || can(n.perm));
export const hasAlerts = () => (ALERT_KINDS[currentUser()?.role] ?? []).length > 0;
export const routeAllowed = (path) => (path === '/alertas' ? hasAlerts() : navItems().some((n) => n.path === path));

/** Unidades do usuário: o Operador só enxerga as que são de sua responsabilidade (RN03). */
export function myUnits() {
  const u = currentUser();
  const all = store.get().units;
  return u?.role === 'operador' ? all.filter((x) => (u.unitIds ?? []).includes(x.id)) : all;
}
