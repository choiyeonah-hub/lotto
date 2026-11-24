// 클라이언트·서버가 함께 쓰는 타입. 서버/계정 시스템으로 옮겨도 그대로 쓰도록 순수 데이터만 둔다.

export type Level = 'beginner' | 'intermediate' | 'advanced';

/** hint: 힌트 후 재도전 · review_zone: 재관찰 실험실 · follow_up: 추가 '왜' 질문 · next: 진행 · challenge: 심화 사건 */
export type RecommendedAction = 'hint' | 'review_zone' | 'follow_up' | 'next' | 'challenge';

export type ConceptId =
  | 'flow_direction'
  | 'heart_pump'
  | 'lung_exchange'
  | 'oxygen_transport'
  | 'exercise_response'
  | 'artery_vein';

export type QuestionKind = 'concept' | 'reasoning' | 'application';

export type Stage = 'game' | 'review_d0' | 'review_d1' | 'review_d3';

/** 요청서의 JSON 구조 + source/feedback(학생에게 보여줄 한 줄). 점수는 0~100. */
export interface Assessment {
  concept_score: number;
  reasoning_score: number;
  application_score: number;
  level: Level;
  correct_concepts: string[];
  misconceptions: string[];
  missing_concepts: string[];
  next_question: string;
  recommended_action: RecommendedAction;
  feedback: string;
  /** ai = 실제 AI 채점, demo = 규칙 기반 데모 채점(AI 아님) */
  source: 'ai' | 'demo';
  /** AI 호출이 실패해 데모 채점으로 대체된 경우 */
  fallback_reason?: string;
}

export interface AssessRequest {
  questionId: string;
  answer: string;
  attempt: number;
  /** 이 질문 다음에 추가 질문/심화 사건으로 갈 수 있는지 (진행 흐름이 정함) */
  branches: { followUp: boolean; challenge: boolean };
}
