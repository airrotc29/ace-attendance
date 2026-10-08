// 민원 처리 공유 시스템 · 서비스 워커
// 앱 화면은 항상 최신 버전을 먼저 받고(네트워크 우선), 끊겼을 때만 저장본을 씁니다.
// 서버 데이터(Supabase)는 저장하지 않습니다.
const CACHE = 'minwon-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // 같은 주소의 앱 파일: 네트워크 우선, 실패 시 저장본
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match('./index.html'))));
    return;
  }
  if (CDN.includes(url.hostname)) {
    // 라이브러리 · 글꼴: 저장본 우선 (버전이 고정된 주소)
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
  // 그 밖(서버 데이터 등)은 가로채지 않음
});
