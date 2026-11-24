// 매 프레임 바뀌는 값(탐사선 위치·입력·심박)은 React 상태가 아닌 가변 객체에 둔다 (리렌더 방지).
import * as THREE from 'three';
import type { SegmentId } from './world';

export const ship = {
  seg: 'vena_cava' as SegmentId,
  t: 0.06,
  ox: 0, // 혈관 단면 안의 좌우/상하 위치 (반지름 비율)
  oy: 0,
  speed: 0, // 단위/초 (+ 혈류 방향)
  bank: 0,
  bump: 0, // 막힌 길에 부딪힌 반동 (1→0)
  warp: 0, // 순간 이동 연출 (1→0)
  pos: new THREE.Vector3(),
  forward: new THREE.Vector3(0, 1, 0),
  up: new THREE.Vector3(0, 0, 1),
};

export const input = { throttle: 0, steerX: 0, steerY: 0, keys: new Set<string>(), touchThrottle: 0, touchX: 0, touchY: 0 };

export const sim = {
  time: 0,
  bpm: 72,
  targetBpm: 72,
  beatPhase: 0, // 0~1 한 박동
  beat: 0, // 0~1 수축 강도 (렌더용)
  breathPhase: 0,
  breathRate: 0.25, // Hz
  running: false,
  exchangeBoost: 0, // 미션 3 기체 교환 강조 (0~1)
  muscleBoost: 0,
  alarm: 0, // 심화 사건 경보 (0~1)
  autoCruise: true,
};

export type CamMode = 'chase' | 'heart' | 'lungs' | 'muscle';
export const cam = { mode: 'chase' as CamMode, yaw: 0, pitch: 0, dragging: false };

/** 심장 박동 곡선: 짧은 '쿵(수축)' 두 번 — lub-dub */
export function beatCurve(phase: number): number {
  const a = Math.exp(-Math.pow((phase - 0.08) / 0.05, 2));
  const b = 0.6 * Math.exp(-Math.pow((phase - 0.3) / 0.06, 2));
  return Math.min(1, a + b);
}

export function stepSim(dt: number) {
  sim.time += dt;
  sim.bpm += (sim.targetBpm - sim.bpm) * Math.min(1, dt * 0.6);
  sim.beatPhase = (sim.beatPhase + dt * (sim.bpm / 60)) % 1;
  sim.beat = beatCurve(sim.beatPhase);
  sim.breathRate = sim.running ? 0.6 : 0.25;
  sim.breathPhase = (sim.breathPhase + dt * sim.breathRate) % 1;
  sim.alarm = Math.max(0, sim.alarm - dt * 0.05);
}

/** 혈류 속도 배율: 박동이 빠를수록, 수축 순간에 빨라진다 */
export function flowMultiplier(): number {
  return (sim.bpm / 72) * (0.75 + 0.6 * sim.beat);
}

// ── 키보드 ──
const KEYMAP: Record<string, string> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'rise', KeyE: 'sink', Space: 'up' };

export function bindKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
    input.keys.add(k);
    e.preventDefault();
  };
  const up = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code];
    if (k) input.keys.delete(k);
  };
  const blur = () => input.keys.clear();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

export function readInput() {
  const k = input.keys;
  input.throttle = THREE.MathUtils.clamp((k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) + input.touchThrottle, -1, 1);
  input.steerX = THREE.MathUtils.clamp((k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + input.touchX, -1, 1);
  input.steerY = THREE.MathUtils.clamp((k.has('rise') ? 1 : 0) - (k.has('sink') ? 1 : 0) + input.touchY, -1, 1);
}

export function resetRuntime() {
  Object.assign(ship, { ox: 0, oy: 0, speed: 0, bank: 0, bump: 0, warp: 0 });
  Object.assign(sim, { bpm: 72, targetBpm: 72, running: false, exchangeBoost: 0, muscleBoost: 0, alarm: 0 });
  Object.assign(cam, { mode: 'chase', yaw: 0, pitch: 0 });
  input.keys.clear();
}
