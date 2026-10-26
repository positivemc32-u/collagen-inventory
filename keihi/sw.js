// オフラインでも開けるように、アプリ本体（画面のファイル）だけを保存しておく仕組みです。
// レシートのデータはここでは扱いません（ブラウザの localStorage に保存されています）。
// アプリを更新したときは CACHE_NAME の数字を上げると確実に反映されます。
const CACHE_NAME = 'keihi-app-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './ocr.js',
  './export.js',
  './vendor/tesseract.min.js',
  './vendor/worker.min.js',
  './vendor/xlsx.mini.min.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('keihi-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// ネットにつながるときは最新版を取得し、つながらないときは保存しておいた版を使う
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
