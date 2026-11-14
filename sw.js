/* Service worker del simulador (v1.3): guarda la página para que funcione sin conexión (helicóptero, zonas sin cobertura).
   VERSION cambia con cada build: así el navegador detecta la versión nueva y la página ofrece «Actualizar». */
const VERSION = '322f35dcbf53';
const CORE = 'simsva-' + VERSION, RUNTIME = 'simsva-externos';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('simsva-') && k !== CORE && k !== RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // la página y sus archivos: primero la copia guardada, que arranca al instante y sin cobertura
    e.respondWith(caches.open(CORE).then(async c => (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && await c.match('./index.html')) || fetch(req)));
    return;
  }
  if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com)$/.test(url.hostname)) {
    // tipografías y la librería del enlace con el instructor: lo guardado si lo hay, y se renueva por detrás
    e.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
