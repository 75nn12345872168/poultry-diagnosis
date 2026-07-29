// ============================================================
// Service Worker - يجعل التطبيق يعمل بالكامل بدون إنترنت بعد أول تحميل ناجح
// ============================================================

const CACHE_VERSION = "poultry-diagnosis-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./model/poultry_classifier.onnx",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// عند التثبيت: تحميل كل ملفات التطبيق الأساسية والنموذج مسبقاً
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// عند التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة للتطبيق
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// استراتيجية الجلب: Cache First مع تحديث في الخلفية (Stale-While-Revalidate)
// تشمل أيضاً ملفات onnxruntime-web من الـ CDN كي يعمل التطبيق بالكامل دون إنترنت لاحقاً
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

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
        .catch(() => cachedResponse); // لا يوجد إنترنت: الاعتماد الكامل على الكاش

      // لو موجود في الكاش، نرجّعه فوراً (سريع) وفي نفس الوقت نحدّثه بالخلفية
      return cachedResponse || networkFetch;
    })
  );
});
