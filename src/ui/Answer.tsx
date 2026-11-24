// 구술 답변(마이크 / 글자) + 채점 피드백. 게임과 복습 화면이 함께 쓴다.
import { useEffect, useRef, useState } from 'react';
import { CONCEPTS, type QuestionDef } from '../../shared/curriculum';
import type { Assessment, Level } from '../../shared/types';
import { listen, speechSupported, type Listening } from '../lib/speech';
import { useApp } from '../store/useApp';

export function Lumi({ mood = 'normal', size = 56 }: { mood?: 'normal' | 'alert' | 'happy' | 'think'; size?: number }) {
  const eye = mood === 'happy' ? 'M-6,-2 q3,-4 6,0 M6,-2 q3,-4 6,0' : 'M-5,-2 a2.2,2.6 0 1,0 0.1,0 M7,-2 a2.2,2.6 0 1,0 0.1,0';
  const glow = mood === 'alert' ? '#ff7a7a' : mood === 'think' ? '#ffd36b' : '#62f3ff';
  return (
    <svg className={`lumi lumi-${mood}`} width={size} height={size} viewBox="-30 -30 60 60" aria-hidden>
      <defs>
        <radialGradient id="lumi-body" cx="40%" cy="35%"><stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor={glow} /><stop offset="1" stopColor="#3b2a7a" /></radialGradient>
      </defs>
      <circle r="26" fill={glow} opacity="0.18" />
      <path d="M-18,4 C-18,-16 18,-16 18,4 C18,12 10,16 0,16 C-10,16 -18,12 -18,4 Z" fill="url(#lumi-body)" />
      <path d="M-12,14 q-2,8 -6,10 M-4,16 q0,8 -2,11 M4,16 q0,8 2,11 M12,14 q2,8 6,10" stroke={glow} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.85" />
      <rect x="-12" y="-7" width="24" height="10" rx="5" fill="#1b1340" opacity="0.85" />
      <path d={eye} stroke="#bff9ff" strokeWidth="2.2" fill={mood === 'happy' ? 'none' : '#bff9ff'} />
      <circle cx="0" cy="-17" r="2.5" fill={glow} />
      <line x1="0" y1="-15" x2="0" y2="-11" stroke={glow} strokeWidth="1.6" />
    </svg>
  );
}

export function AnswerPanel(props: {
  question: QuestionDef;
  hint: string | null;
  busy: boolean;
  onSubmit: (text: string) => void;
  title?: string;
}) {
  const { question, hint, busy, onSubmit } = props;
  const health = useApp((s) => s.health);
  const demo = !health?.ai;
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const rec = useRef<Listening | null>(null);
  const canSpeak = speechSupported();

  useEffect(() => { setText(''); setMicError(null); }, [question.id, hint]);
  useEffect(() => () => rec.current?.stop(), []);

  const toggleMic = () => {
    if (listening) { rec.current?.stop(); return; }
    setMicError(null);
    rec.current = listen({
      onText: (t) => setText(t),
      onError: (m) => { setMicError(m); setListening(false); },
      onEnd: () => setListening(false),
    });
    setListening(!!rec.current);
  };

  const submit = () => {
    rec.current?.stop();
    if (text.trim()) onSubmit(text.trim());
  };

  return (
    <div className="answer-panel" data-testid="answer-panel">
      <div className="ap-head">
        <Lumi mood={hint ? 'think' : 'normal'} size={48} />
        <div>
          {props.title && <div className="ap-title">{props.title}</div>}
          <p className="ap-question">{question.prompt}</p>
          {hint && <p className="ap-hint">💡 {hint}</p>}
        </div>
      </div>
      <div className="ap-input">
        {canSpeak && (
          <button className={`mic ${listening ? 'on' : ''}`} onClick={toggleMic} disabled={busy} aria-label={listening ? '녹음 멈추기' : '말해서 답하기'}>
            <span className="mic-icon">{listening ? '■' : '🎤'}</span>
            <span>{listening ? '듣는 중… 다 말했으면 누르기' : '눌러서 말하기'}</span>
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canSpeak ? '말한 내용이 여기에 적혀요. 글자로 직접 써도 돼요.' : '이 기기에서는 음성 인식을 쓸 수 없어요. 생각을 글자로 적어 줘!'}
          maxLength={500}
          rows={2}
          disabled={busy}
          data-testid="answer-text"
        />
        <button className="btn primary send" onClick={submit} disabled={busy || !text.trim()} data-testid="answer-submit">
          {busy ? '생각 중…' : '루미에게 설명하기'}
        </button>
      </div>
      {micError && <p className="ap-warn">{micError}</p>}
      {demo && (
        <div className="demo-box">
          <span className="demo-badge">데모 채점 · 규칙 기반 (실제 AI 채점 아님)</span>
          <div className="demo-samples">
            <span>예시 답변으로 시험:</span>
            <button onClick={() => setText(question.demoAnswers.good)}>잘 이해한 답</button>
            <button onClick={() => setText(question.demoAnswers.partial)}>부분 답</button>
            <button onClick={() => setText(question.demoAnswers.wrong)}>오개념 답</button>
          </div>
        </div>
      )}
    </div>
  );
}

const LEVEL_LABEL: Record<Level, string> = { beginner: '탐색 중', intermediate: '기본 이해', advanced: '깊은 이해' };

function Stars({ value }: { value: number }) {
  const n = value >= 75 ? 3 : value >= 40 ? 2 : value > 0 ? 1 : 0;
  return <span className="stars" aria-label={`${n}/3`}>{'★'.repeat(n)}<span className="off">{'★'.repeat(3 - n)}</span></span>;
}

export function FeedbackCard(props: { question: QuestionDef; assessment: Assessment; actionLabel: string; onContinue: () => void; extra?: string }) {
  const { assessment: a, question: q } = props;
  const showApp = q.kind === 'application';
  return (
    <div className={`feedback-card lv-${a.level}`} data-testid="feedback">
      <div className="fb-head">
        <Lumi mood={a.level === 'advanced' ? 'happy' : a.level === 'beginner' ? 'think' : 'normal'} size={52} />
        <div>
          <div className="fb-level">이해도: <b>{LEVEL_LABEL[a.level]}</b>
            <span className={`src ${a.source}`}>{a.source === 'ai' ? 'AI 채점' : '데모 채점(규칙 기반)'}</span>
          </div>
          <p className="fb-text">{a.feedback}</p>
        </div>
      </div>
      <div className="fb-scores">
        <div><span>핵심 개념</span><Stars value={a.concept_score} /></div>
        <div><span>원인 → 결과</span><Stars value={a.reasoning_score} /></div>
        {showApp && <div><span>새 상황 적용</span><Stars value={a.application_score} /></div>}
      </div>
      {a.correct_concepts.length > 0 && (
        <ul className="fb-list good">{a.correct_concepts.map((c) => <li key={c}>✔ {c}</li>)}</ul>
      )}
      {a.misconceptions.length > 0 && (
        <ul className="fb-list mis">{a.misconceptions.map((c) => <li key={c}>🤔 다시 확인: “{c}”라고 생각한 것 같아</li>)}</ul>
      )}
      {(a.recommended_action === 'hint' || a.recommended_action === 'review_zone') && a.next_question && (
        <p className="fb-probe">💡 {a.next_question}</p>
      )}
      {a.fallback_reason && <p className="fb-note">※ {a.fallback_reason}</p>}
      {props.extra && <p className="fb-note">{props.extra}</p>}
      <button className="btn primary big" onClick={props.onContinue} data-testid="feedback-continue">{props.actionLabel}</button>
      <details className="fb-raw">
        <summary>선생님용 평가 JSON</summary>
        <pre>{JSON.stringify({ ...a, targets: q.targets.map((t) => CONCEPTS[t].label) }, null, 2)}</pre>
      </details>
    </div>
  );
}
