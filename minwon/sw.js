// 민원 처리 공유 시스템 · 서비스 워커
// 앱 화면은 항상 최신 버전을 먼저 받고(네트워크 우선), 끊겼을 때만 저장본을 씁니다.
// 서버 데이터(Supabase)는 저장하지 않습니다.
const CACHE = 'minwon-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/badge-72.png'];
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
    // 앱 파일은 브라우저 HTTP 캐시(최대 10분)를 건너뛰고 서버에 새 버전이 있는지 확인
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
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

// ── 휴대폰 알림 (서버가 보내는 푸시) ──
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || '민원 처리';
  const urgent = /긴급/.test(title);
  e.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
      icon: './icons/icon-192.png', badge: './icons/badge-72.png',
      requireInteraction: urgent, vibrate: urgent ? [200, 80, 200, 80, 200] : [120, 60, 120],
      data: { url: new URL(d.url || './', self.registration.scope).href }
    });
    // 앱이 열려 있으면 바로 새로 받도록 알림
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach(c => c.postMessage({ type: 'push' }));
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { await c.focus(); c.postMessage({ type: 'open', url }); return; }
    await self.clients.openWindow(url);
  })());
});
// 브라우저가 구독을 새로 바꾼 경우: 앱을 다음에 열 때 다시 등록됨
self.addEventListener('pushsubscriptionchange', () => {});
