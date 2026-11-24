// 메인 화면 + 내 탐험 기록.
import { useState } from 'react';
import { getQuestion } from '../../shared/curriculum';
import { understandingTrend } from '../../shared/progress';
import { dueReview, REVIEW_LABELS } from '../../shared/review';
import type { Quality } from '../lib/device';
import { useApp } from '../store/useApp';
import { Lumi } from './Answer';

function ProfileGate() {
  const { profiles, createProfile, selectProfile } = useApp();
  const [name, setName] = useState('');
  return (
    <div className="card profile-gate" data-testid="profile-gate">
      <h3>탐사대원 등록</h3>
      <p className="small">실명 대신 <b>별명</b>만 적어 주세요. 기록은 이 기기에만 저장돼요.</p>
      <form onSubmit={(e) => { e.preventDefault(); createProfile(name); }} className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="별명 (예: 번개탐사대)" maxLength={12} aria-label="별명" data-testid="nickname" />
        <button className="btn primary" type="submit" data-testid="create-profile">시작</button>
      </form>
      {profiles.length > 0 && (
        <div className="profiles">
          <span className="small">이 기기의 탐사대원:</span>
          {profiles.map((p) => <button key={p.id} className="chip" onClick={() => selectProfile(p.id)}>{p.nickname}</button>)}
        </div>
      )}
    </div>
  );
}

export function HomeScreen() {
  const { profile, progress, setScreen, logout, quality, setQuality, voiceGuide, setVoiceGuide, health } = useApp();
  const due = progress ? dueReview(progress.reviews, new Date()) : null;
  const started = progress && progress.status === 'in_progress' && progress.checkpoint !== 'start';

  return (
    <div className="screen home" data-testid="home">
      <div className="home-bg" aria-hidden><i /><i /><i /><i /><i /></div>
      <header className="title">
        <div className="logo">BODY <span>QUEST</span></div>
        <div className="subtitle">몸속 탐사대 · 에피소드 1 <b>심장과 혈액순환</b></div>
        <div className="tagline">사라진 산소를 찾아라!</div>
      </header>

      {!profile ? <ProfileGate /> : (
        <>
          {due && (
            <button className="card review-alert" onClick={() => setScreen('review')} data-testid="today-review">
              <Lumi mood="alert" size={46} />
              <span><b>오늘의 복습 미션 도착!</b><br />{REVIEW_LABELS[due.stage]} · 3~5분</span>
              <span className="go">▶</span>
            </button>
          )}
          <div className="menu">
            <button className="btn primary huge" onClick={() => setScreen('game')} data-testid="start-game">
              {progress?.status === 'completed' ? '🚀 다시 탐험하기' : started ? '🚀 탐험 이어하기' : '🚀 탐험 시작'}
            </button>
            <button className="btn big" onClick={() => setScreen('records')} data-testid="open-records">📒 내 탐험 기록</button>
            <button className="btn big" onClick={() => setScreen('review')} data-testid="open-review">🧠 오늘의 복습 미션</button>
          </div>
          <div className="who small">탐사대원 <b>{profile.nickname}</b> · <button className="link" onClick={logout}>대원 바꾸기</button></div>
        </>
      )}

      <details className="settings">
        <summary>⚙ 설정</summary>
        <label>그래픽 품질
          <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)} data-testid="quality">
            <option value="low">낮음 (저사양 휴대폰)</option>
            <option value="medium">보통</option>
            <option value="high">높음 (빛 번짐 효과)</option>
          </select>
        </label>
        <label className="row"><input type="checkbox" checked={voiceGuide} onChange={(e) => setVoiceGuide(e.target.checked)} /> 루미 목소리로 읽어 주기</label>
        <p className="small">채점 모드: {health === null ? '확인 중…' : health.ai ? <b className="ok">AI 채점 사용 중</b> : <b className="warn">데모 채점 (규칙 기반 · 실제 AI 아님){health.reachable ? '' : ' — 서버 미연결'}</b>}</p>
        <p className="small">개인정보: 별명과 학습 기록은 이 기기에만 저장돼요. 음성은 녹음 파일로 저장하지 않고 글자로 바뀐 답만 채점에 사용해요. (브라우저 음성 인식은 브라우저 회사 서버를 거칠 수 있어요.)</p>
      </details>
    </div>
  );
}

export function RecordsScreen() {
  const { progress, profile, setScreen } = useApp();
  if (!progress || !profile) return null;
  const trend = understandingTrend(progress);
  const gameAttempts = progress.attempts.filter((a) => a.stage === 'game');
  const wrongChoices = progress.choices.filter((c) => !c.correct).length;
  return (
    <div className="screen records" data-testid="records">
      <header className="screen-head">
        <button className="btn ghost" onClick={() => setScreen('home')}>← 메인</button>
        <h2>{profile.nickname}의 탐험 기록</h2>
      </header>
      <div className="card stats">
        <div><b>{progress.status === 'completed' ? '완료' : progress.status === 'in_progress' ? '탐험 중' : '시작 전'}</b><span>에피소드 1</span></div>
        <div><b>{progress.visitedSegments.length}/10</b><span>탐험한 구역</span></div>
        <div><b>{progress.choices.length}</b><span>갈림길 선택 (다시 시도 {wrongChoices})</span></div>
        <div><b>{gameAttempts.length}</b><span>AI 구술 답변</span></div>
      </div>
      <div className="card">
        <h3>이해도 변화</h3>
        <div className="trend">
          {trend.map((t) => (
            <div key={t.stage} className="trend-col">
              <div className="trend-bar"><i style={{ height: `${t.avg ?? 0}%` }} className={t.avg === null ? 'empty' : ''} /></div>
              <b>{t.avg ?? '–'}</b><span>{t.stage === 'game' ? '탐험' : t.stage.replace('review_d', 'D+')}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>답변 기록</h3>
        {progress.attempts.length === 0 && <p className="small">아직 답변이 없어요.</p>}
        <ol className="attempts">
          {[...progress.attempts].reverse().map((a, i) => (
            <li key={i}>
              <div className="at-q">{getQuestion(a.questionId).prompt}</div>
              <div className="at-a">“{a.answerText}”</div>
              <div className="at-meta">
                {a.stage === 'game' ? '탐험' : a.stage.replace('review_d', 'D+')} · {a.attempt}번째 시도 · 종합 {a.score}점 · {a.source === 'ai' ? 'AI 채점' : '데모 채점'} · {new Date(a.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
