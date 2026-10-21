/* Service worker: guarda o app em cache para abrir offline.
   "Rede primeiro": com internet, sempre carrega a versão mais nova.
   Ao criar arquivos novos em src/, inclua-os em ASSETS e incremente CACHE. */
const CACHE = 'ciclo-azul-v3';

const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
  ...['base', 'layout', 'components'].map((n) => `src/css/${n}.css`),
  'src/js/main.js', 'src/js/config/permissions.js', 'src/js/data/seed.js',
  ...['html', 'wire', 'router', 'store', 'format'].map((n) => `src/js/core/${n}.js`),
  ...['alerts', 'audit', 'auth', 'insights', 'kpis', 'readings', 'reports', 'telemetry', 'waste'].map((n) => `src/js/services/${n}.js`),
  ...['charts', 'dialog', 'icons', 'shell', 'ui'].map((n) => `src/js/components/${n}.js`),
  ...['alerts', 'audit', 'dashboard', 'insights', 'login', 'reports', 'sensors', 'users', 'waste', 'water'].map((n) => `src/js/views/${n}.js`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
