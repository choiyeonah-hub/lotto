// BODY QUEST 서비스 워커: 복습 푸시 알림 표시 + 알림 클릭 시 앱 열기.
// (오프라인 캐시는 아직 구현하지 않았다.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'BODY QUEST', body: '오늘의 복습 미션이 있어요.', url: '/', tag: 'bq' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) { /* 텍스트 페이로드 */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, tag: data.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
