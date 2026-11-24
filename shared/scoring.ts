// 채점 결과 → 수준/다음 행동 결정(AI·데모 공통), 그리고 규칙 기반 데모 채점기.
import { CONCEPTS, MISCONCEPTIONS, REASONING_CONNECTORS, type QuestionDef } from './curriculum';
import type { Assessment, Level, RecommendedAction } from './types';

/** 말 더듬기·간투사·반복·띄어쓰기 차이를 지워서 채점이 '말하는 방식'에 흔들리지 않게 한다. */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?~…·"'“”‘’()\[\]-]/g, ' ')
    .replace(/(^|\s)(음+|어+|으+|아+|그+|저+|에+|막|약간|뭐지|뭐냐면|그러니까요?|있잖아요?)(?=\s|$)/g, ' ')
    .replace(/(\S)\s+\1(?=\S)/g, '$1') // "시 심장" 같은 첫 음절 반복
    .replace(/\s+/g, '');
}

const KIND_WEIGHTS = {
  concept: { c: 0.65, r: 0.35, a: 0 },
  reasoning: { c: 0.45, r: 0.55, a: 0 },
  application: { c: 0.25, r: 0.3, a: 0.45 },
} as const;

export function overallScore(q: Pick<QuestionDef, 'kind'>, s: Pick<Assessment, 'concept_score' | 'reasoning_score' | 'application_score'>): number {
  const w = KIND_WEIGHTS[q.kind];
  return Math.round(s.concept_score * w.c + s.reasoning_score * w.r + s.application_score * w.a);
}

export function deriveLevel(q: Pick<QuestionDef, 'kind'>, s: Pick<Assessment, 'concept_score' | 'reasoning_score' | 'application_score' | 'misconceptions'>): Level {
  const score = overallScore(q, s);
  let level: Level = score < 40 ? 'beginner' : score < 75 ? 'intermediate' : 'advanced';
  if (s.misconceptions.length > 0) level = score < 60 ? 'beginner' : 'intermediate';
  return level;
}

export interface RouteContext {
  attempt: number; // 1부터
  hasFollowUp: boolean;
  hasChallenge: boolean;
}

/** 수준과 시도 횟수로 다음 행동을 정한다. AI가 무엇을 추천하든 진행 분기는 여기서 결정해 일관성을 지킨다. */
export function deriveAction(level: Level, reasoningScore: number, ctx: RouteContext): RecommendedAction {
  if (level === 'beginner') return ctx.attempt >= 2 ? 'review_zone' : 'hint';
  // 잘 설명한 학생은 한 단계 더 깊은 문제로 (심화 사건이 없으면 '왜' 추가 질문)
  if (level === 'advanced') return ctx.hasChallenge ? 'challenge' : ctx.hasFollowUp ? 'follow_up' : 'next';
  return ctx.hasFollowUp && reasoningScore < 70 ? 'follow_up' : 'next';
}

export interface DemoScores {
  concept_score: number;
  reasoning_score: number;
  application_score: number;
  correct_concepts: string[];
  misconceptions: string[];
  missing_concepts: string[];
  application_hits: string[];
}

/** 규칙 기반 데모 채점. 의미가 같은 여러 표현을 패턴으로 받지만, 실제 AI 채점이 아니다. */
export function demoScore(q: QuestionDef, answer: string): DemoScores {
  const text = normalizeAnswer(answer);
  const correct = q.targets.filter((c) => CONCEPTS[c].patterns.some((p) => p.test(text)));
  const missing = q.targets.filter((c) => !correct.includes(c));
  const misconceptions = q.misconceptions.filter((m) => MISCONCEPTIONS[m].pattern.test(text));
  const appHits = (q.application ?? []).filter((a) => a.pattern.test(text)).map((a) => a.label);

  if (text.length < 2) {
    return { concept_score: 0, reasoning_score: 0, application_score: 0, correct_concepts: [], misconceptions: [], missing_concepts: q.targets.map((c) => CONCEPTS[c].label), application_hits: [] };
  }

  const concept = Math.round((correct.length / q.targets.length) * 100);
  const linked = correct.length + appHits.length; // 연결한 생각의 개수
  const causal = REASONING_CONNECTORS.test(text);
  let reasoning = 0;
  if (causal && linked >= 1) reasoning = Math.min(100, 55 + (linked - 1) * 20);
  else if (linked >= 2) reasoning = 45;
  else if (linked === 1) reasoning = 35;
  const application = q.application?.length ? Math.round((appHits.length / q.application.length) * 100) : 0;

  // 오개념이 있으면 그 부분만큼 개념 점수를 낮춘다(벌점이 아니라 '아직 정리가 필요함' 표시)
  const penalty = misconceptions.length ? 30 : 0;
  return {
    concept_score: Math.max(0, concept - penalty),
    reasoning_score: misconceptions.length ? Math.min(reasoning, 40) : reasoning,
    application_score: misconceptions.length ? Math.min(application, 40) : application,
    correct_concepts: correct.map((c) => CONCEPTS[c].label),
    misconceptions: misconceptions.map((m) => MISCONCEPTIONS[m].label),
    missing_concepts: missing.map((c) => CONCEPTS[c].label),
    application_hits: appHits,
  };
}

/** 정답을 알려주지 않는 다음 질문(힌트)을 고른다. */
export function pickProbe(q: QuestionDef, attempt: number, misconceptionLabels: string[]): string {
  const mis = q.misconceptions.map((m) => MISCONCEPTIONS[m]).find((m) => misconceptionLabels.includes(m.label));
  if (mis) return mis.probe;
  return q.hints[Math.min(Math.max(attempt - 1, 0), q.hints.length - 1)];
}

export function demoFeedback(level: Level, s: DemoScores): string {
  if (s.correct_concepts.length === 0 && s.application_hits.length === 0) {
    return '괜찮아, 탐사는 원래 여러 번 관찰하는 거야. 힌트를 보고 다시 생각해 보자!';
  }
  const praise = `좋아! "${s.correct_concepts[0] ?? s.application_hits[0]}" 부분을 네 말로 잘 설명했어.`;
  if (level === 'advanced') return `${praise} 원인과 결과도 잘 연결했어!`;
  if (s.misconceptions.length) return `${praise} 그런데 한 가지는 다시 확인해 보자.`;
  return praise;
}

export function buildAssessment(
  q: QuestionDef,
  scores: Omit<DemoScores, 'application_hits'> & { application_hits?: string[] },
  attempt: number,
  extras: { feedback: string; next_question?: string; source: Assessment['source']; fallback_reason?: string },
  route: Omit<RouteContext, 'attempt'>,
): Assessment {
  const level = deriveLevel(q, scores);
  const action = deriveAction(level, scores.reasoning_score, { ...route, attempt });
  const needsProbe = action === 'hint' || action === 'review_zone';
  return {
    concept_score: scores.concept_score,
    reasoning_score: scores.reasoning_score,
    application_score: scores.application_score,
    level,
    correct_concepts: scores.correct_concepts,
    misconceptions: scores.misconceptions,
    missing_concepts: scores.missing_concepts,
    next_question: needsProbe ? extras.next_question || pickProbe(q, attempt, scores.misconceptions) : extras.next_question ?? '',
    recommended_action: action,
    feedback: extras.feedback,
    source: extras.source,
    ...(extras.fallback_reason ? { fallback_reason: extras.fallback_reason } : {}),
  };
}

export function demoEvaluate(q: QuestionDef, answer: string, attempt: number, route: Omit<RouteContext, 'attempt'>, fallback_reason?: string): Assessment {
  const s = demoScore(q, answer);
  const level = deriveLevel(q, s);
  return buildAssessment(q, s, attempt, { feedback: demoFeedback(level, s), source: 'demo', fallback_reason }, route);
}
