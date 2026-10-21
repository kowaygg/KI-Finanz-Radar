// Offline-Modus: Alles zuerst aus dem Netz holen, bei fehlender Verbindung die zuletzt geladene Fassung zeigen.
// (Der Hinweis „Neue Version verfügbar“ kommt mit Meilenstein 7.)
const VERSION = '0.6.0';
const SPEICHER = `radar-${VERSION}`;
const GRUNDGERUEST = ['./', 'index.html', 'styles.css', 'app.js', 'zeit.js', 'diagramm.js', 'watchlist.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(GRUNDGERUEST)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((namen) => Promise.all(namen.filter((n) => n.startsWith('radar-') && n !== SPEICHER).map((n) => caches.delete(n)))),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((antwort) => {
        const kopie = antwort.clone();
        if (antwort.ok) caches.open(SPEICHER).then((c) => c.put(e.request, kopie));
        return antwort;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
