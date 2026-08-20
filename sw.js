// ══════════════════════════════════════════════════════════
//  SERVICE WORKER — cache offline para PWA
// ═══════════════════════════════════════════════════════

const CACHE = 'familia-v3';
const ASSETS = [
  '/pwa/',
  '/pwa/index.html',
  '/pwa/style.css',
  '/pwa/config.js',
  '/pwa/financas.js',
  '/pwa/sheets.js',
  '/pwa/pages.js',
  '/pwa/app.js',
  '/pwa/manifest.json',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
];

// Instalação: pré-cache dos assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos (de versões anteriores do CACHE)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch:
//  - API Google: sempre vai para a rede (dados precisam ser frescos)
//  - App shell (HTML/CSS/JS): network-first — busca a versão mais nova
//    na rede e só cai para o cache se estiver offline. Isso garante que
//    atualizações do app.js/index.html/style.css cheguem ao usuário
//    assim que ele reabrir o app, em vez de ficar preso numa versão
//    antiga que nunca mais é revalidada.
//  - Outros assets (ícones, fontes): cache-first, já que raramente mudam.
self.addEventListener('fetch', e => {
  const url = e.request.url;

  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('offline', { status: 503 })));
    return;
  }

  const isAppShell = e.request.destination === 'document' ||
                      e.request.destination === 'script' ||
                      e.request.destination === 'style';

  if (isAppShell) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') return caches.match('/pwa/index.html');
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
