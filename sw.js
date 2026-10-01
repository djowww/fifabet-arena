/* Only anonymous installation assets are stored. App pages and API data stay on the network. */
const CACHE_NAME = 'fifago-pwa-v1';
const PUBLIC_ASSETS = new Set([
  '/offline.html',
  '/manifest.webmanifest',
  '/assets/pwa/icons-192.png',
  '/assets/pwa/icons-512.png',
  '/assets/pwa/icons-maskable-512.png',
  '/assets/pwa/icons-apple-180.png'
]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    [...PUBLIC_ASSETS].map(path => new Request(path, { credentials: 'omit', cache: 'reload' }))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('fifago-pwa-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'PWA_APPLY_UPDATE') return;
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(self.skipWaiting());
});

async function publicAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(new Request(request, { credentials: 'omit', cache: 'no-store' }));
    if (response.ok && !response.redirected && new URL(response.url).origin === self.location.origin) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Invitation/auth query strings, other origins, mutations and all API requests are untouched.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || url.pathname.startsWith('/api/')) return;
  if (PUBLIC_ASSETS.has(url.pathname)) {
    event.respondWith(publicAsset(request));
    return;
  }
  if (request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })).catch(async () => {
      const offline = await caches.match('/offline.html', { cacheName: CACHE_NAME });
      return offline || new Response('Sem conexão. Reconecte-se e tente novamente.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }));
  }
});
