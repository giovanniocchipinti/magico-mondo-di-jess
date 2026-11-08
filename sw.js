// Service worker: tiene sul telefono una copia dei file dell'app, così si apre subito
// anche con poca rete.
//
// Strategia per i file dell'app: "prima la rete". Se c'è connessione si chiede sempre
// la versione nuova (con "no-cache" il server risponde in fretta "non è cambiato niente"
// se il file è uguale), quindi gli aggiornamenti arrivano subito. Senza rete: la copia salvata.
// I dati (Supabase) non passano di qui: arrivano sempre dalla rete.

const CACHE = 'jess-v1';

// Librerie e font: hanno la versione nell'indirizzo, non cambiano, si usano dalla copia
const LIBRARIES = ['https://cdn.jsdelivr.net/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.json'])));
  self.skipWaiting(); // la versione nuova del service worker entra in funzione subito
});

self.addEventListener('activate', (event) => {
  // eliminiamo le copie delle versioni precedenti (es. 'jess-v0')
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (LIBRARIES.some((prefix) => request.url.startsWith(prefix))) {
    event.respondWith(cacheFirst(request));
  } else if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
  // tutto il resto (Supabase) non viene toccato
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' }));
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // senza rete: la copia salvata (per la pagina, anche se l'indirizzo ha un #ancora o ?parametri)
    const cached = await cache.match(request, { ignoreSearch: true })
      ?? (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    return cached ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // "opaque" = risposta di un altro sito senza CORS (es. i file dei font): si può salvare ma non leggere
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
