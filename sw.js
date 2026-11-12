/* Oflayn ishlash: barcha fayllar birinchi ochilishda keshga olinadi */
var CACHE = "kitobcha-v4";
var FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "core.js", "convert.js", "app.js",
  "pdf-lib.min.js", "pdf.min.js", "pdf.worker.min.js", "mammoth.browser.min.js", "html2canvas.min.js",
  "icon-192.png", "icon-512.png"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request).catch(function () { return caches.match("index.html"); });
  }));
});
