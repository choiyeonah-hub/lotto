// 복습 일정: 에피소드 완료 '날짜'(학생 기기의 현지 날짜) 기준 D+0, D+1, D+3.
// D+1/D+3은 해당 날짜 0시부터 열린다(아침에 바로 할 수 있게). 알림은 그날 오후 4시에 보낸다.
import type { Stage } from './types';

export type ReviewStage = Exclude<Stage, 'game'>;

export const REVIEW_OFFSETS: Record<ReviewStage, number> = { review_d0: 0, review_d1: 1, review_d3: 3 };
export const REVIEW_LABELS: Record<ReviewStage, string> = { review_d0: 'D+0 게임 직후 복습', review_d1: 'D+1 기억 확인', review_d3: 'D+3 새로운 사건' };
export const NOTIFY_HOUR = 16;

export interface ReviewSlot {
  stage: ReviewStage;
  /** 이 시각부터 복습 가능 (ISO) */
  availableAt: string;
  /** 푸시 알림 예정 시각 (ISO). D+0은 게임 직후 바로 하므로 알림 없음 */
  notifyAt: string | null;
  completedAt?: string;
}

function startOfLocalDay(d: Date, addDays: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, 0, 0, 0, 0);
}

export function buildReviewSchedule(completedAtIso: string): ReviewSlot[] {
  const done = new Date(completedAtIso);
  return (Object.keys(REVIEW_OFFSETS) as ReviewStage[]).map((stage) => {
    const offset = REVIEW_OFFSETS[stage];
    if (offset === 0) return { stage, availableAt: done.toISOString(), notifyAt: null };
    const day = startOfLocalDay(done, offset);
    const notify = new Date(day.getFullYear(), day.getMonth(), day.getDate(), NOTIFY_HOUR, 0, 0, 0);
    return { stage, availableAt: day.toISOString(), notifyAt: notify.toISOString() };
  });
}

/** 지금 할 수 있는(열렸고 아직 안 한) 복습 중 가장 이른 것 */
export function dueReview(slots: ReviewSlot[], now: Date): ReviewSlot | null {
  return slots.find((s) => !s.completedAt && new Date(s.availableAt) <= now) ?? null;
}

/** 아직 열리지 않은 다음 복습 */
export function nextUpcoming(slots: ReviewSlot[], now: Date): ReviewSlot | null {
  return slots.find((s) => !s.completedAt && new Date(s.availableAt) > now) ?? null;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '지금';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}일 ${h % 24}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${Math.max(1, m)}분`;
}
