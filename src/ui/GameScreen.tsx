// 탐험 화면: 3D가 화면 대부분을 차지하고 HUD는 가장자리에 둔다.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { CONCEPTS, getQuestion } from '../../shared/curriculum';
import type { NextStep } from '../../shared/flow';
import { GameCanvas } from '../game/Scene';
import { bindKeyboard, cam, input, ship, sim } from '../game/runtime';
import { webglAvailable, isTouchDevice } from '../lib/device';
import { useApp } from '../store/useApp';
import { useGame } from '../store/useGame';
import { AnswerPanel, FeedbackCard, Lumi } from './Answer';
import { BodyMap } from './BodyMap';
import { LabOverlay, ScaffoldOverlay } from './Labs';

class CanvasBoundary extends Component<{ children: ReactNode; onError: (e: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { this.props.onError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

function actionLabel(step: NextStep | null): string {
  switch (step?.type) {
    case 'retry': return '힌트 보고 다시 도전';
    case 'lab': return '재관찰 실험실로 가기';
    case 'scaffold': return '함께 정리하기';
    case 'ask': return step.reason === 'challenge' ? '심화 사건 해결하러 가기!' : '한 가지 더 생각해 보기';
    default: return '다음 탐사로 출발!';
  }
}

function HeartRate() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (ref.current) {
        ref.current.querySelector('b')!.textContent = String(Math.round(sim.bpm));
        ref.current.style.setProperty('--beat', String(sim.beat));
        ref.current.classList.toggle('fast', sim.bpm > 100);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="heartrate" data-testid="heartrate"><span className="hr-icon">❤</span><b>72</b><small>회/분</small></div>;
}

/** 터치 조작: 왼쪽 가상 조이스틱(조종) + 오른쪽 가속/감속 버튼 */
function TouchControls() {
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const [cruise, setCruise] = useState(sim.autoCruise);
  const onStick = (e: React.PointerEvent) => {
    const el = stick.current;
    if (!el) return;
    if (e.type === 'pointerdown') el.setPointerCapture(e.pointerId);
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      input.touchX = 0; input.touchY = 0;
      if (knob.current) knob.current.style.transform = '';
      return;
    }
    if (e.type === 'pointermove' && !el.hasPointerCapture(e.pointerId)) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.min(1, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    input.touchX = Math.cos(a) * m;
    input.touchY = -Math.sin(a) * m;
    if (knob.current) knob.current.style.transform = `translate(${Math.cos(a) * m * 34}px, ${Math.sin(a) * m * 34}px)`;
  };
  const hold = (v: number) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); input.touchThrottle = v; },
    onPointerUp: () => { input.touchThrottle = 0; },
    onPointerCancel: () => { input.touchThrottle = 0; },
  });
  return (
    <div className="controls">
      <div ref={stick} className="stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-label="조종 스틱">
        <div ref={knob} className="knob" />
      </div>
      <div className="throttle">
        <button className="thr fwd" {...hold(1)} aria-label="앞으로">▲<small>앞으로</small></button>
        <button className="thr back" {...hold(-1)} aria-label="뒤로">▼</button>
        <button className={`cruise ${cruise ? 'on' : ''}`} onClick={() => { sim.autoCruise = !sim.autoCruise; setCruise(sim.autoCruise); }}>
          {cruise ? '혈류 타기 ON' : '혈류 타기 OFF'}
        </button>
      </div>
    </div>
  );
}

/** 캔버스를 끌면 카메라가 탐사선 주위를 돈다 (마우스·터치 공통) */
function useCameraDrag(target: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let last: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
      cam.dragging = true;
    };
    const move = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return;
      cam.yaw -= (e.clientX - last.x) * 0.006;
      cam.pitch = Math.max(-0.9, Math.min(0.9, cam.pitch + (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const up = () => { last = null; cam.dragging = false; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [target]);
}

function Cinematic() {
  const c = useGame((s) => s.cinematic);
  const end = useGame((s) => s.endCinematic);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (!c) return;
    const timers = c.captions.map((_, k) => setTimeout(() => setI(k), k * 3200));
    const done = setTimeout(end, c.captions.length * 3200 + 600);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [c, end]);
  if (!c) return null;
  return (
    <div className="cinematic" data-testid="cinematic">
      <div className="cine-tag">🔭 관찰 모드</div>
      <p key={i} className="cine-caption">{c.captions[i]}</p>
      <button className="btn ghost" onClick={end}>관찰 끝내기 ▶</button>
    </div>
  );
}

function GateChoice() {
  const gate = useGame((s) => s.gate);
  const choose = useGame((s) => s.chooseGate);
  useEffect(() => {
    if (!gate) return;
    const key = (e: KeyboardEvent) => {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0 && gate.def.options[i]) choose(gate.def.options[i].id);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [gate, choose]);
  if (!gate) return null;
  return (
    <div className="gate-choice" data-testid="gate-choice">
      <div className="gate-title">{gate.def.title}</div>
      <p className="gate-q"><Lumi mood="think" size={36} /> {gate.def.question}</p>
      {gate.message && <p className="gate-msg" data-testid="gate-msg">{gate.message}</p>}
      <div className="gate-options">
        {gate.def.options.map((o, i) => (
          <button key={o.id} className={`gate-opt c${i} ${gate.highlight && o.correct ? 'glow' : ''}`} onClick={() => choose(o.id)} data-testid={`gate-opt-${o.id}`}>
            <b>{'ABC'[i]}</b> {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Dialog() {
  const d = useGame((s) => s.dialog);
  const next = useGame((s) => s.advanceDialog);
  useEffect(() => {
    if (!d || d.blocking) return;
    const t = setTimeout(next, 6500); // 이동 중 안내는 자동으로 넘어간다
    return () => clearTimeout(t);
  }, [d, next]);
  if (!d) return null;
  const line = d.lines[d.i];
  return (
    <button className={`dialog ${line.mood ?? 'normal'}`} onClick={next} data-testid="dialog">
      <Lumi mood={line.mood} size={52} />
      <span className="dialog-body">
        <span className="dialog-name">루미</span>
        <span className="dialog-text">{line.text}</span>
        <span className="dialog-more">{d.i + 1 < d.lines.length ? '눌러서 계속 ▶' : d.blocking ? '눌러서 시작 ▶' : '눌러서 닫기'}</span>
      </span>
    </button>
  );
}

function Ending() {
  const progress = useApp((s) => s.progress);
  const setScreen = useApp((s) => s.setScreen);
  const level = useGame((s) => s.level);
  if (!progress) return null;
  const concepts = Object.entries(progress.mastery);
  return (
    <div className="overlay-card ending" data-testid="ending">
      <h2>🎉 에피소드 1 탐사 완료!</h2>
      <p>사라진 산소의 비밀을 밝혔어! 혈액은 심장의 펌프질로 폐와 온몸을 한 방향으로 돌며 산소를 나르고, 근육이 더 많은 산소를 원하면 심장이 더 빨리 뛰어.</p>
      <div className="end-level">탐사 수준: <b>{level === 'advanced' ? '심화 탐사대원' : level === 'intermediate' ? '정식 탐사대원' : '견습 탐사대원'}</b></div>
      <ul className="mastery">
        {concepts.map(([c, v]) => <li key={c}><span>{labelOf(c)}</span><div className="bar"><i style={{ width: `${v}%` }} /></div></li>)}
      </ul>
      <p className="end-next">📅 복습 일정: <b>지금(D+0)</b> · <b>내일(D+1)</b> · <b>3일 뒤(D+3)</b> — 3~5분이면 끝나!</p>
      <div className="row">
        <button className="btn primary big" onClick={() => setScreen('review')} data-testid="go-review">지금 D+0 복습하기</button>
        <button className="btn big" onClick={() => setScreen('home')}>메인으로</button>
      </div>
    </div>
  );
}
const labelOf = (c: string) => CONCEPTS[c as keyof typeof CONCEPTS]?.label ?? c;

export function GameScreen() {
  const quality = useApp((s) => s.quality);
  const setQuality = useApp((s) => s.setQuality);
  const setScreen = useApp((s) => s.setScreen);
  const g = useGame();
  const wrap = useRef<HTMLDivElement>(null);
  const [glError, setGlError] = useState<string | null>(webglAvailable() ? null : '이 기기/브라우저에서 3D(WebGL)를 사용할 수 없어요.');
  const [canvasKey, setCanvasKey] = useState(0);
  const touch = isTouchDevice();

  useEffect(() => { g.begin(); return bindKeyboard(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useCameraDrag(wrap);

  // 그래픽 컨텍스트를 잃으면 브라우저가 복구할 시간을 잠깐 준 뒤, 안 되면 복구 화면을 띄운다
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLost = () => {
    lostTimer.current = setTimeout(() => setGlError('그래픽 메모리가 부족해 3D 화면이 멈췄어요.'), 2500);
  };
  const onRestored = () => { if (lostTimer.current) clearTimeout(lostTimer.current); };

  const retry = (lower: boolean) => {
    if (lower) setQuality(quality === 'high' ? 'medium' : 'low');
    setGlError(null);
    setCanvasKey((k) => k + 1);
  };

  const q = g.question ? getQuestion(g.question.questionId) : null;
  const travelling = g.phase === 'travel';

  return (
    <div className="game" ref={wrap}>
      <div className="canvas-wrap">
        {!glError && (
          <CanvasBoundary key={canvasKey} onError={(e) => setGlError(`3D 화면을 그리는 중 오류가 생겼어요: ${e.message}`)}>
            <GameCanvas quality={quality} onContextLost={onLost} onContextRestored={onRestored} />
          </CanvasBoundary>
        )}
        {glError && (
          <div className="gl-error" role="alert" data-testid="gl-error">
            <h3>3D 화면에 문제가 생겼어요</h3>
            <p>{glError}</p>
            <p className="small">탐사 기록은 저장되어 있어요. 다시 시도하면 마지막 체크포인트부터 이어서 할 수 있어요.</p>
            <div className="row">
              <button className="btn primary" onClick={() => retry(false)}>다시 시도</button>
              <button className="btn" onClick={() => retry(true)}>낮은 화질로 다시 시도</button>
              <button className="btn ghost" onClick={() => setScreen('home')}>메인으로</button>
            </div>
          </div>
        )}
      </div>

      {/* 왼쪽 위: 현재 미션 */}
      <div className="mission-panel" data-testid="mission-panel">
        <div className="mp-title">{g.objective.title}</div>
        <div className="mp-goal">{g.objective.goal}</div>
        <div className="mp-meta">
          <span className={`lv lv-${g.level}`}>{g.level === 'beginner' ? '관찰 탐사' : g.level === 'advanced' ? '심화 탐사' : '정규 탐사'}</span>
          <button className="mini" onClick={() => setScreen('home')} aria-label="메뉴">☰</button>
        </div>
      </div>

      <BodyMap visited={g.visited} target={g.objective.target} compact={touch}>
        <HeartRate />
      </BodyMap>

      {g.banner && <div className={`banner ${g.banner.tone}`} data-testid="banner"><span>{g.banner.icon}</span>{g.banner.text}</div>}

      <Cinematic />

      {/* 하단: 대화 / 선택 / 답변 */}
      <div className="bottom">
        {g.phase === 'gate' && <GateChoice />}
        {(g.phase === 'question' || g.phase === 'assessing') && q && (
          <AnswerPanel question={q} hint={g.hint} busy={g.phase === 'assessing'} onSubmit={g.submitAnswer} title={g.question?.role === 'challenge' ? '심화 사건' : g.question?.role === 'followUp' ? '한 가지 더!' : undefined} />
        )}
        {g.phase === 'feedback' && q && g.assessment && (
          <FeedbackCard question={q} assessment={g.assessment} actionLabel={actionLabel(g.pending)} onContinue={g.continueAfterFeedback} />
        )}
        {g.dialog && !g.cinematic && g.phase !== 'question' && g.phase !== 'feedback' && <Dialog />}
      </div>

      {g.phase === 'lab' && g.lab && <LabOverlay lab={g.lab.id} onDone={g.finishLab} />}
      {g.phase === 'scaffold' && g.scaffoldId && <ScaffoldOverlay questionId={g.scaffoldId} onDone={g.finishScaffold} />}
      {g.phase === 'ending' && <Ending />}

      {travelling && !g.dialog?.blocking && (touch ? <TouchControls /> : <div className="kbd-help">W/▲ 앞으로 · S/▼ 뒤로 · A/D 좌우 · Q/E 위아래 · 마우스로 끌어 둘러보기</div>)}
      <DebugHook />
    </div>
  );
}

/** 자동 테스트용: 현재 위치를 읽을 수 있게 노출 (개인정보 없음) */
function DebugHook() {
  useEffect(() => {
    (window as unknown as { __bq: unknown }).__bq = { ship, sim, game: useGame };
  }, []);
  return null;
}
