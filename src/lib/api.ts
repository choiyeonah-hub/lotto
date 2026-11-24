// 서버 연동. 서버에 닿지 못하면(정적 호스팅·오프라인) 기기 안의 데모 채점으로 대체한다.
import { getQuestion } from '../../shared/curriculum';
import { demoEvaluate } from '../../shared/scoring';
import type { AssessRequest, Assessment } from '../../shared/types';

export interface Health { reachable: boolean; ai: boolean; push: boolean }

export async function fetchHealth(): Promise<Health> {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { ai: boolean; push: boolean };
    return { reachable: true, ai: !!j.ai, push: !!j.push };
  } catch {
    return { reachable: false, ai: false, push: false };
  }
}

export async function assess(req: AssessRequest): Promise<Assessment> {
  const route = { hasFollowUp: req.branches.followUp, hasChallenge: req.branches.challenge };
  try {
    const r = await fetch('/api/assess', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as Assessment;
  } catch {
    return demoEvaluate(getQuestion(req.questionId), req.answer, req.attempt, route, '서버에 연결하지 못해 기기 안에서 데모 채점을 했어요');
  }
}
