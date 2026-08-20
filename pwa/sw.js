// ══════════════════════════════════════════════════════════
//  SERVICE WORKER — cache offline para PWA
// ══════════════════════════════════════════════════════════

const CACHE = 'familia-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/config.js',
  '/sheets.js',
  '/pages.js',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
];

// Instalação: pré-cache dos assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first para API do Google, cache-first para assets
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API Google — sempre vai para a rede (dados precisam ser frescos)
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('offline', { status: 503 })));
    return;
  }

  // Assets estáticos — cache-first, fallback para rede
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Fallback offline: retorna index.html para navegação SPA
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
