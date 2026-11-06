// The Lirium Craft Bar: service worker
// Guarda la carta, las fotos y las fuentes en el celular para abrir rápido y funcionar sin internet.
// Si alguna vez hace falta forzar que todos descarguen todo de nuevo, cambiar el número de VERSION.
const VERSION = 'lirium-v1';
const NUCLEO = ['./', 'index.html', 'fondovertical.webp', 'logo.webp', 'loading-page.png', 'favicon.png', 'apple-touch-icon.png'];
const ES_FUENTE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(VERSION).then(function(cache) {
            // cada archivo por separado: si alguno no existe (por ejemplo, el favicon), no se cae el resto
            return Promise.all(NUCLEO.map(function(u) { return cache.add(u).catch(function() {}); }));
        }).then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(claves) {
            return Promise.all(claves.filter(function(c) { return c !== VERSION; }).map(function(c) { return caches.delete(c); }));
        }).then(function() { return self.clients.claim(); })
    );
});

// Página: primero la red (así los cambios llegan enseguida); si tarda más de 3 s o no hay internet, la guardada
function paginaRedPrimero(req) {
    return caches.open(VERSION).then(function(cache) {
        const red = fetch(req).then(function(resp) {
            if (resp && resp.ok) cache.put(req, resp.clone());
            return resp;
        });
        const plazo = new Promise(function(_, rechazo) { setTimeout(function() { rechazo(new Error('lento')); }, 3000); });
        return Promise.race([red, plazo]).catch(function() {
            return cache.match(req, { ignoreSearch: true }).then(function(g) {
                if (g) return g;
                return cache.match('index.html').then(function(i) { return i || red; });
            });
        });
    });
}

// Fotos, fondo y fuentes: se muestra la guardada al instante y por detrás se actualiza para la próxima visita
function guardadaYActualizar(req) {
    return caches.open(VERSION).then(function(cache) {
        return cache.match(req).then(function(guardada) {
            const red = fetch(req).then(function(resp) {
                // solo se guardan las respuestas buenas (no los 404 de las fotos que no existen)
                if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
                return resp;
            }).catch(function() { return guardada; });
            return guardada || red;
        });
    });
}

self.addEventListener('fetch', function(e) {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (ES_FUENTE.test(req.url)) { e.respondWith(guardadaYActualizar(req)); return; }
    if (url.origin !== self.location.origin) return; // la planilla de Google y todo lo demás pasa directo

    if (req.mode === 'navigate' || req.destination === 'document') { e.respondWith(paginaRedPrimero(req)); return; }
    if (/\.(webp|png|jpe?g|gif|svg|ico)$/i.test(url.pathname)) e.respondWith(guardadaYActualizar(req));
});
