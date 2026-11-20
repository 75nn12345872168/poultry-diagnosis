// ============================================================
// Service Worker v2.1 - تخزين كامل لجميع تبويبات التطبيق ونموذج v2 للعمل بدون إنترنت
// ============================================================

const CACHE_VERSION = "poultry-diagnosis-v2.1-20261120";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./tracker.js",
  "./directory.js",
  "./directory-data.js",
  "./manifest.json",
  "./model/poultry_classifier.onnx",
  "./model/ood_config.json",
  "./model/class_config.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// عند التثبيت: جلب النسخة الجديدة من كل ملفات التطبيق ونموذج v2 متجاوزاً كاش HTTP القديم
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) =>
            cache.add(new Request(url, { cache: "reload" }))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// عند التفعيل: حذف جميع إصدارات الكاش القديمة فوراً
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// استراتيجية الجلب:
// - ملفات الكود والإعدادات (HTML/JS/JSON): Network First مع Fallback للكاش عند انقطاع الإنترنت
// - النموذج الثقيل والصور وملفات WASM من CDN: Cache First مع تحديث في الخلفية
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCodeOrConfig =
    isSameOrigin &&
    (event.request.mode === "navigate" ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".json"));

  if (isCodeOrConfig) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
