// Nom du cache aligné sur APP_VERSION (sly-todo.jsx) : change à chaque build,
// ce qui suffit à invalider l'ancien cache automatiquement — plus besoin de
// penser à un compteur séparé.
const CACHE_NAME = "toutdoux-cache-2026-08-27-streaks";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Stratégie : réseau d'abord (pour avoir la dernière version dès qu'on est en ligne),
// avec repli sur le cache si hors-ligne ou requête en échec.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match("./index.html")))
  );
});
