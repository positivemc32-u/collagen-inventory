// オフラインでも開けるように、アプリ本体（画面のファイル）だけを保存しておく仕組みです。
// アプリを更新したときは CACHE_NAME の数字を上げると確実に反映されます。
const CACHE_NAME = 'kurage-app-v33';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './astro.js',
  './fortune.js',
  './weather.js',
  './speech.js',
  './news.js',
  './ai.js',
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
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('kurage-app-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// ネットにつながるときは最新版を取得し、つながらないときは保存しておいた版を使う
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 毎朝作る音声（audio/）は保存せず、そのままネットから読む（容量をふくらませないため）
  if (url.pathname.includes('/audio/')) return;
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
