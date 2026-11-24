// 수업 후 AI 구술 복습 (D+0 / D+1 / D+3). 3D 없이 가볍게 3~5분.
import { useEffect, useMemo, useState } from 'react';
import { CONCEPTS, getQuestion, REVIEW_SETS } from '../../shared/curriculum';
import { completeReview, recordAttempt, understandingTrend } from '../../shared/progress';
import { dueReview, formatRemaining, nextUpcoming, REVIEW_LABELS, type ReviewStage } from '../../shared/review';
import type { Assessment } from '../../shared/types';
import { assess } from '../lib/api';
import { enableReviewPush, sendTestPush } from '../lib/push';
import { useApp } from '../store/useApp';
import { AnswerPanel, FeedbackCard, Lumi } from './Answer';

function Session({ stage, onDone }: { stage: ReviewStage; onDone: () => void }) {
  const update = useApp((s) => s.updateProgress);
  const ids = REVIEW_SETS[stage];
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Assessment | null>(null);
  const q = getQuestion(ids[idx]);

  const submit = async (text: string) => {
    setBusy(true);
    const a = await assess({ questionId: q.id, answer: text, attempt, branches: { followUp: false, challenge: false } });
    update((p) => recordAttempt(p, q.id, stage, attempt, text, a));
    setResult(a);
    setBusy(false);
  };

  // 복습에서는 힌트 재도전 1번까지만 (짧게 3~5분 유지)
  const retry = result && result.recommended_action === 'hint' && attempt < 2;
  const cont = () => {
    if (!result) return;
    if (retry) {
      setHint(result.next_question);
      setAttempt((n) => n + 1);
      setResult(null);
      return;
    }
    if (idx + 1 < ids.length) {
      setIdx(idx + 1);
      setAttempt(1);
      setHint(null);
      setResult(null);
    } else {
      update((p) => completeReview(p, stage));
      onDone();
    }
  };

  return (
    <div className="review-session" data-testid="review-session">
      <div className="rs-progress">{REVIEW_LABELS[stage]} · {idx + 1} / {ids.length}</div>
      {!result ? (
        <AnswerPanel question={q} hint={hint} busy={busy} onSubmit={submit} />
      ) : (
        <FeedbackCard
          question={q}
          assessment={result}
          actionLabel={retry ? '힌트 보고 다시 말해 보기' : idx + 1 < ids.length ? '다음 질문' : '복습 완료!'}
          onContinue={cont}
          extra={!retry && result.level === 'beginner' ? `다음 탐사 때 다시 확인해 보자: ${result.missing_concepts.join(', ')}` : undefined}
        />
      )}
    </div>
  );
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function ReviewScreen() {
  const progress = useApp((s) => s.progress);
  const health = useApp((s) => s.health);
  const setScreen = useApp((s) => s.setScreen);
  const now = useNow();
  const [active, setActive] = useState<ReviewStage | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [justDone, setJustDone] = useState(false);

  const slots = progress?.reviews ?? [];
  const due = dueReview(slots, now);
  const upcoming = nextUpcoming(slots, now);
  const trend = useMemo(() => (progress ? understandingTrend(progress) : []), [progress]);

  if (!progress) return null;

  if (active) return (
    <div className="screen review">
      <Session stage={active} onDone={() => { setActive(null); setJustDone(true); }} />
    </div>
  );

  const turnOnPush = async () => {
    setPushMsg('알림을 설정하는 중…');
    const r = await enableReviewPush(slots);
    setPushMsg(r.ok ? '알림 예약 완료! 복습 날 오후 4시에 알려 줄게요.' : r.reason);
  };

  const learned = Object.entries(progress.mastery).sort((a, b) => b[1] - a[1]);

  return (
    <div className="screen review" data-testid="review-screen">
      <header className="screen-head">
        <button className="btn ghost" onClick={() => setScreen('home')}>← 메인</button>
        <h2>오늘의 복습 미션</h2>
      </header>

      {progress.status !== 'completed' ? (
        <div className="card"><Lumi /> <p>에피소드 1 탐사를 끝내면 복습 일정이 만들어져요.</p></div>
      ) : (
        <>
          <div className="card today">
            {justDone && <p className="ok">✔ 복습 완료! 이해도 기록이 업데이트됐어.</p>}
            {due ? (
              <>
                <div className="today-tag">{REVIEW_LABELS[due.stage]}</div>
                <p>{due.stage === 'review_d0' ? '방금 배운 개념을 네 말로 설명해 보자.' : due.stage === 'review_d1' ? '어제 배운 걸 기억하고 있는지 확인해 보자. 처음과 다른 질문이야!' : '처음 보는 사건이 발생했어! 여러 개념을 연결해 해결해 보자.'}</p>
                <button className="btn primary big" onClick={() => { setJustDone(false); setActive(due.stage); }} data-testid="start-review">복습 시작 (3문항 · 약 3~5분)</button>
              </>
            ) : (
              <p>오늘 할 복습은 모두 끝냈어! 🎉</p>
            )}
            {upcoming && (
              <p className="next-time" data-testid="next-review">다음 복습: <b>{REVIEW_LABELS[upcoming.stage]}</b> — {formatRemaining(new Date(upcoming.availableAt).getTime() - now.getTime())} 뒤 ({new Date(upcoming.availableAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })})</p>
            )}
          </div>

          <div className="card">
            <h3>복습 일정</h3>
            <ol className="schedule">
              {slots.map((s) => (
                <li key={s.stage} className={s.completedAt ? 'done' : new Date(s.availableAt) <= now ? 'open' : 'later'}>
                  <b>{REVIEW_LABELS[s.stage]}</b>
                  <span>{new Date(s.availableAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}</span>
                  <span>{s.completedAt ? '완료' : new Date(s.availableAt) <= now ? '지금 가능' : '예정'}</span>
                </li>
              ))}
            </ol>
            <div className="push-box">
              <button className="btn" onClick={turnOnPush}>🔔 복습 알림 받기</button>
              {health?.push && <button className="btn ghost" onClick={async () => setPushMsg((await sendTestPush()) ? '테스트 알림을 보냈어요.' : '먼저 알림을 켜 주세요.')}>테스트 알림</button>}
              <p className="small">{pushMsg ?? (health?.push ? '알림을 켜면 서버가 복습 날 오후 4시에 알림을 보내요.' : '알림 서버가 설정되지 않은 환경이에요. 앱을 다시 열면 오늘의 복습이 자동으로 표시돼요.')}</p>
            </div>
          </div>

          <div className="card">
            <h3>이해도 변화</h3>
            <div className="trend" data-testid="trend">
              {trend.map((t) => (
                <div key={t.stage} className="trend-col">
                  <div className="trend-bar"><i style={{ height: `${t.avg ?? 0}%` }} className={t.avg === null ? 'empty' : ''} /></div>
                  <b>{t.avg ?? '–'}</b>
                  <span>{t.stage === 'game' ? '탐험' : t.stage === 'review_d0' ? 'D+0' : t.stage === 'review_d1' ? 'D+1' : 'D+3'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>학습한 개념</h3>
            <ul className="mastery">
              {learned.map(([c, v]) => <li key={c}><span>{CONCEPTS[c as keyof typeof CONCEPTS].label}</span><div className="bar"><i style={{ width: `${v}%` }} /></div><b>{v}</b></li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
