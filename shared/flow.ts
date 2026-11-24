// 미션 진행 분기 규칙 (순수 함수 — UI/3D와 분리해 테스트한다).
import { QUESTIONS, getQuestion, type MissionId } from './curriculum';
import type { Assessment, Level } from './types';

export type LabId = 'pump' | 'exchange' | 'exercise';

export interface MissionDef {
  id: MissionId;
  title: string;
  goal: string;
  easy: string;
  main: string;
  /** 이해도가 높은 학생에게 처음부터 주는 심화 버전 (없으면 main) */
  deep?: string;
  followUp?: string;
  challenge?: string;
  lab: LabId;
}

export const MISSIONS: Record<MissionId, MissionDef> = {
  m2_heart: { id: 'm2_heart', title: '미션 2 · 심장의 역할', goal: '박동하는 심장을 관찰하고 심장이 하는 일을 설명하기', easy: 'm2_easy', main: 'm2_main', followUp: 'm2_follow', challenge: 'm2_challenge', lab: 'pump' },
  m3_lungs: { id: 'm3_lungs', title: '미션 3 · 폐에서 산소 얻기', goal: '폐에서 혈액이 어떻게 바뀌는지 관찰하고 설명하기', easy: 'm3_easy', main: 'm3_main', followUp: 'm3_follow', challenge: 'm3_challenge', lab: 'exchange' },
  m4_running: { id: 'm4_running', title: '미션 4 · 달리기 사건', goal: '심박수가 빨라진 이유를 추리하기', easy: 'm4_easy', main: 'm4_main', followUp: 'm4_follow', lab: 'exercise' },
  m5_final: { id: 'm5_final', title: '최종 사건 · 높은 산', goal: '배운 개념을 새로운 상황에 적용하기', easy: 'final_easy', main: 'final_normal', deep: 'final_deep', lab: 'exercise' },
};

export const MISSION_ORDER: MissionId[] = ['m2_heart', 'm3_lungs', 'm4_running', 'm5_final'];

export type QuestionRole = 'easy' | 'main' | 'followUp' | 'challenge';

export interface QuestionState {
  missionId: MissionId;
  questionId: string;
  role: QuestionRole;
  attempt: number; // 1부터
  /** 이번 미션에서 이미 쓴 추가 질문/심화 */
  usedFollowUp: boolean;
  usedChallenge: boolean;
}

export function firstQuestion(missionId: MissionId, level: Level): QuestionState {
  const m = MISSIONS[missionId];
  const pick = level === 'beginner' ? { id: m.easy, role: 'easy' as const } : level === 'advanced' && m.deep ? { id: m.deep, role: 'main' as const } : { id: m.main, role: 'main' as const };
  return { missionId, questionId: pick.id, role: pick.role, attempt: 1, usedFollowUp: false, usedChallenge: false };
}

/** 이 질문에 답한 뒤 추가 질문·심화 사건으로 갈 수 있는가 (채점 요청에 함께 보낸다) */
export function branchesFor(s: QuestionState): { followUp: boolean; challenge: boolean } {
  const base = s.role === 'main' || s.role === 'easy';
  const m = MISSIONS[s.missionId];
  return {
    followUp: base && !!m.followUp && !s.usedFollowUp,
    // 심화는 기본 질문을 첫 시도에 잘한 학생에게만
    challenge: s.role === 'main' && !!m.challenge && !s.usedChallenge,
  };
}

export type NextStep =
  | { type: 'retry'; question: QuestionState; hint: string }
  | { type: 'lab'; lab: LabId; then: QuestionState }
  | { type: 'scaffold'; questionId: string }
  | { type: 'ask'; question: QuestionState; reason: 'follow_up' | 'challenge' }
  | { type: 'advance' };

export const MAX_ATTEMPTS_BEFORE_SCAFFOLD = 3;

/**
 * 채점 결과로 다음 단계를 정한다.
 * - beginner: 힌트+쉬운 질문 → 재관찰 실험실 → (그래도 어려우면) 함께 정리(빈칸) 후 진행. 실패는 벌점이 아니다.
 * - intermediate: 진행, 이유 설명이 약하면 '왜' 추가 질문 1회
 * - advanced: 심화 사건 1회
 * 추가 질문/심화 질문은 보너스이므로 결과와 관계없이 다음 미션으로 진행한다(기본 개념은 이미 통과).
 */
export function decideNext(s: QuestionState, a: Assessment): NextStep {
  const m = MISSIONS[s.missionId];
  if (s.role === 'followUp' || s.role === 'challenge') return { type: 'advance' };

  switch (a.recommended_action) {
    case 'hint': {
      // 첫 질문이 기본 질문이었다면 더 쉬운 질문으로 바꿔 재도전
      const easier = { ...s, questionId: m.easy, role: 'easy' as const, attempt: s.attempt + 1 };
      return { type: 'retry', question: easier, hint: a.next_question };
    }
    case 'review_zone': {
      if (s.attempt >= MAX_ATTEMPTS_BEFORE_SCAFFOLD) {
        const scaffoldQ = [s.questionId, m.main, m.easy].find((id) => QUESTIONS[id]?.scaffold);
        return scaffoldQ ? { type: 'scaffold', questionId: scaffoldQ } : { type: 'advance' };
      }
      return { type: 'lab', lab: m.lab, then: { ...s, questionId: m.easy, role: 'easy', attempt: s.attempt + 1 } };
    }
    case 'follow_up':
      if (m.followUp && !s.usedFollowUp) {
        return { type: 'ask', reason: 'follow_up', question: { ...s, questionId: m.followUp, role: 'followUp', attempt: 1, usedFollowUp: true } };
      }
      return { type: 'advance' };
    case 'challenge':
      if (m.challenge && !s.usedChallenge) {
        return { type: 'ask', reason: 'challenge', question: { ...s, questionId: m.challenge, role: 'challenge', attempt: 1, usedChallenge: true } };
      }
      return { type: 'advance' };
    case 'next':
      return { type: 'advance' };
  }
}

/** 학생의 현재 수준: 최근 결과에 가중치를 둔다. */
export function updateLevel(prev: Level, a: Assessment): Level {
  const rank: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };
  const back: Level[] = ['beginner', 'intermediate', 'advanced'];
  const r = Math.round((rank[prev] + rank[a.level] * 2) / 3);
  return back[r];
}

export function questionTargets(questionId: string) {
  return getQuestion(questionId).targets;
}
