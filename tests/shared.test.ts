import { describe, expect, it } from 'vitest';
import { QUESTIONS, REVIEW_SETS } from '../shared/curriculum';
import { demoEvaluate, normalizeAnswer } from '../shared/scoring';
import { decideNext, firstQuestion, branchesFor, MISSION_ORDER, MISSIONS } from '../shared/flow';
import { buildReviewSchedule, dueReview, nextUpcoming } from '../shared/review';
import { completeEpisode, completeReview, newProgress, recordAttempt, understandingTrend } from '../shared/progress';

const noBranch = { hasFollowUp: false, hasChallenge: false };

describe('데모 채점: 예시 답변 수준 구분', () => {
  for (const q of Object.values(QUESTIONS)) {
    it(`${q.id}: 좋은 답 > 부분 답, 오답은 beginner`, () => {
      const good = demoEvaluate(q, q.demoAnswers.good, 1, noBranch);
      const partial = demoEvaluate(q, q.demoAnswers.partial, 1, noBranch);
      const wrong = demoEvaluate(q, q.demoAnswers.wrong, 1, noBranch);
      expect(good.level, `good: ${JSON.stringify(good)}`).toBe('advanced');
      expect(partial.level).not.toBe('advanced');
      expect(wrong.level).toBe('beginner');
      expect(good.source).toBe('demo');
    });
  }

  it('말을 더듬거나 간투사를 넣어도 점수가 같다', () => {
    const q = QUESTIONS.m2_main;
    const fluent = demoEvaluate(q, '심장이 펌프처럼 피를 밀어서 온몸으로 보내요. 그래야 산소가 몸 곳곳에 가니까요.', 1, noBranch);
    const halting = demoEvaluate(q, '음... 어... 시 심장이 그... 펌프처럼 피를... 밀어서, 음, 온몸으로 보내요. 그래야... 산소가 몸 곳곳에 가니까요.', 1, noBranch);
    expect(halting.concept_score).toBe(fluent.concept_score);
    expect(halting.reasoning_score).toBe(fluent.reasoning_score);
  });

  it('교과서 단어가 없어도 의미가 맞으면 인정한다', () => {
    const r = demoEvaluate(QUESTIONS.m2_main, '심장이 꽉 쥐어짜듯이 해서 피를 쭉쭉 보내 주니까 산소가 다리까지 가요', 1, noBranch);
    expect(r.correct_concepts.length).toBe(2);
  });

  it('오개념을 찾아내고 정답 대신 되묻는 질문을 준다', () => {
    const r = demoEvaluate(QUESTIONS.m3_challenge, '동맥은 항상 산소가 많은 피가 흘러요', 1, noBranch);
    expect(r.misconceptions).toContain('동맥에는 항상 산소가 많은 혈액이 흐른다');
    expect(r.recommended_action).toBe('hint');
    expect(r.next_question).toContain('폐동맥');
  });

  it('normalizeAnswer는 공백과 간투사를 지운다', () => {
    expect(normalizeAnswer('음 심장 이   펌프')).toBe('심장이펌프');
  });
});

describe('진행 분기', () => {
  const evalFor = (qid: string, kind: 'good' | 'partial' | 'wrong', attempt: number, branches = { followUp: false, challenge: false }) =>
    demoEvaluate(QUESTIONS[qid], QUESTIONS[qid].demoAnswers[kind], attempt, { hasFollowUp: branches.followUp, hasChallenge: branches.challenge });

  it('수준별 첫 질문이 다르다', () => {
    expect(firstQuestion('m2_heart', 'beginner').questionId).toBe('m2_easy');
    expect(firstQuestion('m2_heart', 'intermediate').questionId).toBe('m2_main');
    expect(firstQuestion('m5_final', 'advanced').questionId).toBe('final_deep');
    expect(firstQuestion('m5_final', 'beginner').questionId).toBe('final_easy');
  });

  it('A 경로: 오답 → 힌트 재도전 → 실험실 → 빈칸 정리 후 진행 (막히지 않음)', () => {
    let s = firstQuestion('m2_heart', 'intermediate');
    let step = decideNext(s, evalFor(s.questionId, 'wrong', s.attempt, branchesFor(s)));
    expect(step.type).toBe('retry');
    if (step.type !== 'retry') return;
    expect(step.hint.length).toBeGreaterThan(5);
    s = step.question;
    expect(s.questionId).toBe('m2_easy');
    step = decideNext(s, evalFor(s.questionId, 'wrong', s.attempt, branchesFor(s)));
    expect(step.type).toBe('lab');
    if (step.type !== 'lab') return;
    expect(step.lab).toBe('pump');
    s = step.then;
    step = decideNext(s, evalFor(s.questionId, 'wrong', s.attempt, branchesFor(s)));
    expect(step.type).toBe('scaffold');
  });

  it('B 경로: 부분 답(이유 약함) → 추가 "왜" 질문 → 진행', () => {
    const s = firstQuestion('m3_lungs', 'intermediate');
    const a = evalFor(s.questionId, 'partial', 1, branchesFor(s));
    expect(a.level).toBe('intermediate');
    const step = decideNext(s, a);
    expect(step).toMatchObject({ type: 'ask', reason: 'follow_up' });
    if (step.type !== 'ask') return;
    expect(decideNext(step.question, evalFor(step.question.questionId, 'wrong', 1)).type).toBe('advance');
  });

  it('C 경로: 좋은 답 → 심화 사건', () => {
    const s = firstQuestion('m2_heart', 'intermediate');
    const step = decideNext(s, evalFor(s.questionId, 'good', 1, branchesFor(s)));
    expect(step).toMatchObject({ type: 'ask', reason: 'challenge' });
    if (step.type === 'ask') expect(step.question.questionId).toBe('m2_challenge');
  });

  it('쉬운 질문을 아주 잘 답하면 한 단계 깊은 추가 질문으로 올라간다', () => {
    const s = firstQuestion('m3_lungs', 'beginner');
    expect(s.questionId).toBe('m3_easy');
    const step = decideNext(s, evalFor(s.questionId, 'good', 1, branchesFor(s)));
    expect(step).toMatchObject({ type: 'ask', reason: 'follow_up' });
  });

  it('모든 미션에 쉬운/기본 질문과 실험실이 있어 어떤 경로든 핵심 개념을 다룬다', () => {
    const covered = new Set(MISSION_ORDER.flatMap((m) => [...QUESTIONS[MISSIONS[m].easy].targets, ...QUESTIONS[MISSIONS[m].main].targets]));
    for (const c of ['heart_pump', 'lung_exchange', 'oxygen_transport', 'exercise_response']) expect(covered.has(c as never)).toBe(true);
  });
});

describe('복습 일정 (현지 날짜 기준)', () => {
  it('밤 11시에 끝내도 D+1은 다음 날 0시, D+3은 사흘 뒤 0시', () => {
    const done = new Date(2026, 10, 24, 23, 10); // 11/24 23:10 local
    const slots = buildReviewSchedule(done.toISOString());
    expect(slots.map((s) => s.stage)).toEqual(['review_d0', 'review_d1', 'review_d3']);
    expect(new Date(slots[1].availableAt)).toEqual(new Date(2026, 10, 25, 0, 0));
    expect(new Date(slots[2].availableAt)).toEqual(new Date(2026, 10, 27, 0, 0));
    expect(new Date(slots[1].notifyAt!)).toEqual(new Date(2026, 10, 25, 16, 0));
    expect(slots[0].notifyAt).toBeNull();
  });

  it('월말·연말을 넘어가도 계산된다', () => {
    const slots = buildReviewSchedule(new Date(2026, 11, 30, 10, 0).toISOString());
    expect(new Date(slots[2].availableAt)).toEqual(new Date(2027, 0, 2, 0, 0));
  });

  it('오늘 할 복습과 다음 복습을 찾는다', () => {
    const done = new Date(2026, 10, 24, 15, 0);
    let p = completeEpisode(newProgress('s1', done), done);
    expect(dueReview(p.reviews, done)?.stage).toBe('review_d0');
    p = completeReview(p, 'review_d0', done);
    expect(dueReview(p.reviews, done)).toBeNull();
    expect(nextUpcoming(p.reviews, done)?.stage).toBe('review_d1');
    expect(dueReview(p.reviews, new Date(2026, 10, 25, 7, 0))?.stage).toBe('review_d1');
    // D+3 당일엔 D+1을 건너뛰었어도 둘 다 열림 (먼저 것부터)
    expect(dueReview(p.reviews, new Date(2026, 10, 27, 9, 0))?.stage).toBe('review_d1');
  });

  it('다시 완료해도 첫 완료일 기준 일정이 유지된다', () => {
    const d1 = new Date(2026, 10, 24, 10);
    const p = completeEpisode(newProgress('s1', d1), d1);
    const again = completeEpisode(p, new Date(2026, 10, 26, 10));
    expect(again.reviews).toEqual(p.reviews);
  });
});

describe('학습 기록', () => {
  it('시도 기록과 개념 숙련도, 이해도 변화가 쌓인다', () => {
    const q = QUESTIONS.r0_heart;
    let p = newProgress('s1');
    p = recordAttempt(p, 'r0_heart', 'review_d0', 1, q.demoAnswers.good, demoEvaluate(q, q.demoAnswers.good, 1, noBranch));
    expect(p.attempts).toHaveLength(1);
    expect(p.mastery.heart_pump).toBeGreaterThan(70);
    expect(understandingTrend(p).find((t) => t.stage === 'review_d0')?.avg).toBeGreaterThan(70);
  });

  it('복습 세트는 3문항이며 단계마다 다른 질문이다', () => {
    const all = Object.values(REVIEW_SETS).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const set of Object.values(REVIEW_SETS)) expect(set).toHaveLength(3);
  });
});
