/* Oflayn ishlash.
   - Kitobcha fayllari (html, css, js, rasm): avval tarmoqdan olinadi (yangilanish darrov tushadi),
     internet yoʻq boʻlsa yoki sekin boʻlsa, xotiradan ochiladi.
   - Katta kutubxonalar (oʻzgarmaydi): xotiradan. */
var CACHE = "kitobcha-v7";
var FILES = [
  "./", "index.html", "yoriqnoma.html", "style.css", "manifest.webmanifest",
  "core.js", "olddoc.js", "convert.js", "ui.js", "app.js",
  "pdf-lib.min.js", "pdf.min.js", "pdf.worker.min.js", "mammoth.browser.min.js", "html2canvas.min.js",
  "icon-192.png", "icon-512.png",
  "shots/s1.webp", "shots/s2.webp", "shots/s3.webp"
];
var LIBS = /(pdf-lib|pdf\.min|pdf\.worker\.min|mammoth\.browser\.min|html2canvas\.min)\.js$/;

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match("index.html"); });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (LIBS.test(url.pathname)) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) { return r || fetch(req); }));
    return;
  }

  // Avval tarmoq (4 soniyagacha), keyin xotira
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      fromCache(req).then(function (r) { if (r && !done) { done = true; resolve(r); } });
    }, 4000);
    fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" })).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (r) { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  }));
});
