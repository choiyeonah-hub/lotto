import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let push: typeof import('../server/push');
const sub = (n: number) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: 'p', auth: 'a' } });

beforeAll(async () => {
  process.env.PUSH_STORE_PATH = join(mkdtempSync(join(tmpdir(), 'bq-')), 'store.json');
  push = await import('../server/push');
});

describe('복습 알림 서버 로직', () => {
  it('구독 검증: https endpoint와 키가 있어야 한다', () => {
    expect(push.isValidSubscription(sub(1))).toBe(true);
    expect(push.isValidSubscription({ endpoint: 'http://x', keys: { p256dh: 'p', auth: 'a' } })).toBe(false);
    expect(push.isValidSubscription(null)).toBe(false);
  });

  it('예약 시각이 지난 알림만 한 번씩 보내고, 같은 구독을 다시 등록해도 중복 발송하지 않는다', async () => {
    const now = new Date('2026-11-25T08:00:00Z');
    const id1 = push.upsertSubscription(sub(1), [
      { stage: 'review_d1', notifyAt: '2026-11-25T07:00:00Z' },
      { stage: 'review_d3', notifyAt: '2026-11-27T07:00:00Z' },
    ]);
    const sent: string[] = [];
    const sender = async (_s: unknown, payload: string) => { sent.push(JSON.parse(payload).tag); };
    expect(await push.sendDueReminders(now, sender)).toBe(1);
    expect(sent).toEqual(['bq-review_d1']);
    // 같은 endpoint 재등록 → 같은 ID, 이미 보낸 알림 유지
    const id2 = push.upsertSubscription(sub(1), [
      { stage: 'review_d1', notifyAt: '2026-11-25T07:00:00Z' },
      { stage: 'review_d3', notifyAt: '2026-11-27T07:00:00Z' },
    ]);
    expect(id2).toBe(id1);
    expect(await push.sendDueReminders(now, sender)).toBe(0);
    expect(await push.sendDueReminders(new Date('2026-11-27T08:00:00Z'), sender)).toBe(1);
    expect(sent).toEqual(['bq-review_d1', 'bq-review_d3']);
  });

  it('만료된 구독(410)은 지운다', async () => {
    push.upsertSubscription(sub(2), [{ stage: 'review_d1', notifyAt: '2026-11-25T07:00:00Z' }]);
    const gone = async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); };
    await push.sendDueReminders(new Date('2026-11-25T08:00:00Z'), gone);
    let calls = 0;
    await push.sendDueReminders(new Date('2026-11-26T08:00:00Z'), async () => { calls++; });
    expect(calls).toBe(0);
  });
});
