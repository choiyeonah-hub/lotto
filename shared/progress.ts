// 학생별 학습 기록 모델 + 순수 갱신 함수. 저장소(브라우저/서버)는 ProgressRepository가 담당한다.
import { getQuestion } from './curriculum';
import type { MissionId } from './curriculum';
import { overallScore } from './scoring';
import { buildReviewSchedule, type ReviewSlot, type ReviewStage } from './review';
import type { Assessment, ConceptId, Level, Stage } from './types';

export const SCHEMA_VERSION = 1;

export interface StudentProfile {
  id: string; // 기기에서 만든 무작위 ID (실명·학교 등 개인정보 없음)
  nickname: string; // 탐사대원 별명
  createdAt: string;
}

export interface AttemptRecord {
  questionId: string;
  stage: Stage;
  at: string;
  attempt: number;
  score: number; // 0~100 종합
  concept: number;
  reasoning: number;
  application: number;
  level: Level;
  action: Assessment['recommended_action'];
  source: Assessment['source'];
  /** 학생이 말한 내용의 텍스트(기기에만 저장, 음성은 저장하지 않음) */
  answerText: string;
}

export interface ChoiceRecord {
  gateId: string;
  optionId: string;
  correct: boolean;
  at: string;
}

export type Checkpoint = 'start' | 'm1_done' | MissionId | 'ending';

export interface EpisodeProgress {
  schemaVersion: number;
  studentId: string;
  episodeId: 'ep1';
  status: 'not_started' | 'in_progress' | 'completed';
  checkpoint: Checkpoint;
  level: Level;
  mastery: Partial<Record<ConceptId, number>>; // 0~100
  attempts: AttemptRecord[];
  choices: ChoiceRecord[];
  visitedSegments: string[];
  startedAt?: string;
  completedAt?: string;
  reviews: ReviewSlot[];
  updatedAt: string;
}

export function newProgress(studentId: string, now = new Date()): EpisodeProgress {
  return {
    schemaVersion: SCHEMA_VERSION, studentId, episodeId: 'ep1', status: 'not_started', checkpoint: 'start',
    level: 'intermediate', mastery: {}, attempts: [], choices: [], visitedSegments: [], reviews: [], updatedAt: now.toISOString(),
  };
}

export function recordAttempt(p: EpisodeProgress, questionId: string, stage: Stage, attempt: number, answer: string, a: Assessment, now = new Date()): EpisodeProgress {
  const q = getQuestion(questionId);
  const score = overallScore(q, a);
  const mastery = { ...p.mastery };
  for (const c of q.targets) {
    const prev = mastery[c] ?? 0;
    // 다시 맞히면 올라가고, 아직이면 조금만 내려간다(실패를 벌점처럼 크게 깎지 않는다)
    mastery[c] = Math.round(prev === 0 ? score : prev * 0.5 + score * 0.5);
  }
  const rec: AttemptRecord = {
    questionId, stage, at: now.toISOString(), attempt, score,
    concept: a.concept_score, reasoning: a.reasoning_score, application: a.application_score,
    level: a.level, action: a.recommended_action, source: a.source, answerText: answer.slice(0, 300),
  };
  return { ...p, mastery, attempts: [...p.attempts, rec], updatedAt: now.toISOString() };
}

export function recordChoice(p: EpisodeProgress, gateId: string, optionId: string, correct: boolean, now = new Date()): EpisodeProgress {
  return { ...p, choices: [...p.choices, { gateId, optionId, correct, at: now.toISOString() }], updatedAt: now.toISOString() };
}

export function completeEpisode(p: EpisodeProgress, now = new Date()): EpisodeProgress {
  if (p.status === 'completed' && p.completedAt) return p; // 재완료해도 첫 완료일 기준 일정 유지
  return { ...p, status: 'completed', checkpoint: 'ending', completedAt: now.toISOString(), reviews: buildReviewSchedule(now.toISOString()), updatedAt: now.toISOString() };
}

export function completeReview(p: EpisodeProgress, stage: ReviewStage, now = new Date()): EpisodeProgress {
  return { ...p, reviews: p.reviews.map((r) => (r.stage === stage ? { ...r, completedAt: now.toISOString() } : r)), updatedAt: now.toISOString() };
}

/** 이해도 변화: 게임/각 복습 단계의 평균 점수 */
export function understandingTrend(p: EpisodeProgress): { stage: Stage; avg: number | null }[] {
  const stages: Stage[] = ['game', 'review_d0', 'review_d1', 'review_d3'];
  return stages.map((stage) => {
    // 같은 질문은 마지막 시도만 반영 (힌트 후 재도전 결과)
    const last = new Map<string, AttemptRecord>();
    for (const a of p.attempts) if (a.stage === stage) last.set(a.questionId, a);
    const xs = [...last.values()].map((a) => a.score);
    return { stage, avg: xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null };
  });
}
