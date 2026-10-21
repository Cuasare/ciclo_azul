import * as store from './core/store.js';
import { startRouter } from './core/router.js';
import { seed } from './data/seed.js';
import * as auth from './services/auth.js';
import * as telemetry from './services/telemetry.js';
import * as shell from './components/shell.js';

const routes = {
  '/login': () => import('./views/login.js'),
  '/painel': () => import('./views/dashboard.js'),
  '/agua': () => import('./views/water.js'),
  '/residuos': () => import('./views/waste.js'),
  '/sensores': () => import('./views/sensors.js'),
  '/insights': () => import('./views/insights.js'),
  '/relatorios': () => import('./views/reports.js'),
  '/usuarios': () => import('./views/users.js'),
  '/auditoria': () => import('./views/audit.js'),
  '/alertas': () => import('./views/alerts.js'),
};

store.load(seed);
telemetry.init();
telemetry.start();

const router = startRouter({
  root: document.getElementById('view'),
  routes,
  onDraw: shell.paint,
  guard: (path) => {
    const logged = !!auth.currentUser();
    if (path === '/') return logged ? '/painel' : '/login';
    if (!logged) return path === '/login' ? null : '/login';
    if (path === '/login') return '/painel';
    return auth.routeAllowed(path) ? null : '/painel';
  },
});

shell.bindShell();
telemetry.subscribe(() => auth.currentUser() && shell.updateBell());
router.start();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
