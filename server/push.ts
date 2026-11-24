// Web Push: 구독 저장 + 예약된 복습 알림 발송.
// VAPID 키(VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)가 서버 환경변수에 있어야 동작한다.
// 구독은 기기의 무작위 ID로만 묶고 이름·연락처는 저장하지 않는다.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import * as webpush from 'web-push';
type PushSubscription = webpush.PushSubscription;

export interface Reminder { stage: string; notifyAt: string; sentAt?: string }
interface Entry { subscription: PushSubscription; reminders: Reminder[]; createdAt: string }
interface Store { entries: Record<string, Entry> }

const STORE_PATH = process.env.PUSH_STORE_PATH || 'data/push-store.json';

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function initPush(): void {
  if (!pushEnabled()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

function load(): Store {
  if (!existsSync(STORE_PATH)) return { entries: {} };
  try { return JSON.parse(readFileSync(STORE_PATH, 'utf8')) as Store; } catch { return { entries: {} }; }
}
function save(s: Store): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, STORE_PATH);
}

export function isValidSubscription(x: unknown): x is PushSubscription {
  const s = x as PushSubscription;
  return !!s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
}

/** 같은 endpoint면 기존 항목을 갱신한다(멱등). 반환값: 구독 ID */
export function upsertSubscription(subscription: PushSubscription, reminders: Reminder[]): string {
  const s = load();
  const existing = Object.entries(s.entries).find(([, e]) => e.subscription.endpoint === subscription.endpoint);
  const id = existing?.[0] ?? randomUUID();
  const prevSent = new Map((existing?.[1].reminders ?? []).filter((r) => r.sentAt).map((r) => [r.stage, r.sentAt!]));
  s.entries[id] = {
    subscription,
    reminders: reminders.map((r) => ({ stage: r.stage, notifyAt: r.notifyAt, ...(prevSent.has(r.stage) ? { sentAt: prevSent.get(r.stage) } : {}) })),
    createdAt: existing?.[1].createdAt ?? new Date().toISOString(),
  };
  save(s);
  return id;
}

export function removeSubscription(endpoint: string): void {
  const s = load();
  for (const [id, e] of Object.entries(s.entries)) if (e.subscription.endpoint === endpoint) delete s.entries[id];
  save(s);
}

const MESSAGES: Record<string, { title: string; body: string }> = {
  review_d1: { title: 'BODY QUEST 복습 미션 도착!', body: '어제 탐험한 심장과 혈액순환, 아직 기억나니? 3분 구술 복습을 해 보자.' },
  review_d3: { title: 'BODY QUEST 새로운 사건 발생!', body: '처음 보는 사건이 기다리고 있어. 배운 개념을 연결해서 해결해 보자.' },
};

type Sender = (sub: PushSubscription, payload: string) => Promise<unknown>;

/** 발송 시각이 지난 알림을 보낸다. sender는 테스트에서 바꿔 끼운다. */
export async function sendDueReminders(now = new Date(), sender: Sender = (sub, p) => webpush.sendNotification(sub, p)): Promise<number> {
  const s = load();
  let sent = 0;
  for (const [id, e] of Object.entries(s.entries)) {
    for (const r of e.reminders) {
      if (r.sentAt || new Date(r.notifyAt) > now) continue;
      const msg = MESSAGES[r.stage] ?? { title: 'BODY QUEST', body: '오늘의 복습 미션이 있어요.' };
      try {
        await sender(e.subscription, JSON.stringify({ ...msg, url: '/?review=1', tag: `bq-${r.stage}` }));
        r.sentAt = now.toISOString();
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { delete s.entries[id]; break; } // 만료된 구독
        console.error('[push] send failed', code ?? err);
      }
    }
  }
  save(s);
  return sent;
}

export async function sendTest(subscription: PushSubscription): Promise<void> {
  await webpush.sendNotification(subscription, JSON.stringify({ title: 'BODY QUEST 알림 테스트', body: '알림이 잘 도착했어요! 복습 날이 되면 이렇게 알려 줄게요.', url: '/', tag: 'bq-test' }));
}
