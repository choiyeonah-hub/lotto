// 복습 알림 구독. 실제 발송은 서버(/api/push)가 예약 시각에 한다.
import type { ReviewSlot } from '../../shared/review';

export type PushSupport = 'supported' | 'no-sw' | 'no-push' | 'ios-needs-install' | 'insecure';

export function pushSupport(): PushSupport {
  if (!window.isSecureContext) return 'insecure';
  if (!('serviceWorker' in navigator)) return 'no-sw';
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (!('PushManager' in window)) return isIOS && !standalone ? 'ios-needs-install' : 'no-push';
  return 'supported';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** 알림 권한 요청 → 구독 → 서버에 복습 일정 등록. 실패 이유를 한국어로 돌려준다. */
export async function enableReviewPush(slots: ReviewSlot[]): Promise<{ ok: true } | { ok: false; reason: string }> {
  const support = pushSupport();
  if (support === 'ios-needs-install') return { ok: false, reason: '아이폰/아이패드는 Safari에서 "홈 화면에 추가"로 앱을 설치한 뒤 알림을 켤 수 있어요.' };
  if (support === 'insecure') return { ok: false, reason: '알림은 https 주소(또는 localhost)에서만 켤 수 있어요.' };
  if (support !== 'supported') return { ok: false, reason: '이 브라우저는 푸시 알림을 지원하지 않아요.' };

  const keyRes = await fetch('/api/push/public-key').catch(() => null);
  if (!keyRes?.ok) return { ok: false, reason: '알림 서버가 아직 설정되지 않았어요(VAPID 키 필요). 앱을 다시 열면 오늘의 복습이 자동으로 보여요.' };
  const { publicKey } = (await keyRes.json()) as { publicKey: string };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: '알림 권한이 허용되지 않았어요. 앱을 다시 열면 오늘의 복습이 자동으로 보여요.' };

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return { ok: false, reason: '서비스 워커를 등록하지 못했어요.' };
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });

  const reminders = slots.filter((s) => s.notifyAt && !s.completedAt).map((s) => ({ stage: s.stage, notifyAt: s.notifyAt }));
  const r = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), reminders }) });
  if (!r.ok) return { ok: false, reason: '알림 등록에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  return { ok: true };
}

export async function sendTestPush(): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) return false;
  const r = await fetch('/api/push/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  return r.ok;
}
