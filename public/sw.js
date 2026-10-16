/* Service worker Contrôle Car : coquille de l'app disponible hors-ligne.
   Les données (API) ne sont JAMAIS mises en cache ici : elles vivent dans le stockage de l'appareil. */
const VERSION = 'cc-v1';
const STATIQUE = `${VERSION}-statique`;
const PAGES = `${VERSION}-pages`;
const PAGES_MISES_EN_CACHE = ['/etudiant', '/controleur', '/connexion', '/activation'];
const REPLI = ['/etudiant', '/controleur', '/connexion'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(PAGES).then((c) => c.add('/hors-ligne')).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic' && PAGES_MISES_EN_CACHE.includes(url.pathname)) {
            const copie = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copie));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          for (const chemin of [url.pathname, ...REPLI, '/hors-ligne']) {
            const hit = await cache.match(chemin);
            if (hit) return hit;
          }
          return new Response('Hors-ligne', { status: 503 });
        }),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copie = res.clone(); caches.open(STATIQUE).then((c) => c.put(req, copie)); }
        return res;
      })),
    );
  }
});
