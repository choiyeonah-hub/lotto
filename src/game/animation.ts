/**
 * AnimationStateMachine + 절차적 포즈 + 2-본 다리 IK.
 * 렌더링과 분리된 순수 함수라 유닛 테스트로 관절 움직임을 검증할 수 있다.
 * 각도 규약: thigh/shoulder 양수 = 앞으로, knee/elbow 양수 = 굽힘.
 */

export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'step'
  | 'hook'
  | 'turn'
  | 'sit'
  | 'wave'

export type ActionKind = 'step' | 'hook' | 'turn' | 'wave' | 'land'

export const ACTION_DURATION: Record<ActionKind, number> = {
  step: 0.9,
  hook: 0.6,
  turn: 0.5,
  wave: 1.4,
  land: 0.22,
}

export interface Pose {
  hipY: number
  spine: number
  neck: number
  lThigh: number
  lThighZ: number
  lKnee: number
  rThigh: number
  rThighZ: number
  rKnee: number
  lShoulder: number
  lShoulderZ: number
  lElbow: number
  rShoulder: number
  rShoulderZ: number
  rElbow: number
}

export const LEG = { thigh: 0.29, shin: 0.27, ankle: 0.06 }
export const HIP_HEIGHT = LEG.thigh + LEG.shin + LEG.ankle

export const REST_POSE: Pose = {
  hipY: 0,
  spine: 0,
  neck: 0,
  lThigh: 0,
  lThighZ: 0.04,
  lKnee: 0.04,
  rThigh: 0,
  rThighZ: -0.04,
  rKnee: 0.04,
  lShoulder: 0,
  lShoulderZ: 0.12,
  lElbow: 0.15,
  rShoulder: 0,
  rShoulderZ: 0.12,
  rElbow: 0.15,
}

export interface AnimContext {
  grounded: boolean
  vy: number
  speed: number
  action: ActionKind | null
  hooked: boolean
  sitting: boolean
}

/** 상태 전이: 일회성 동작 > 걸기 유지 > 공중 > 이동 속도 순. */
export function selectAnim(c: AnimContext): AnimState {
  if (c.action === 'turn') return 'turn'
  if (c.action === 'step' || c.action === 'wave' || c.action === 'hook') return c.action
  if (c.hooked && c.grounded) return 'hook'
  if (!c.grounded) return c.vy > 0 ? 'jump' : 'fall'
  if (c.action === 'land') return 'land'
  if (c.sitting) return 'sit'
  if (c.speed > 3.2) return 'run'
  if (c.speed > 0.25) return 'walk'
  return 'idle'
}

/**
 * 엉덩이 관절 기준, 앞으로 f(m), 아래로 h(m) 지점에 발목을 두는 허벅지/무릎 각.
 * 무릎은 앞으로 굽는다.
 */
export function solveLegIK(f: number, h: number, L1 = LEG.thigh, L2 = LEG.shin): { thigh: number; knee: number } {
  const D = Math.min(Math.max(Math.hypot(f, h), Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-4)
  const base = Math.atan2(f, h)
  const alpha = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1))
  const kneeInner = Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1))
  return { thigh: base + alpha, knee: Math.PI - kneeInner }
}

/** 순운동학: 허벅지/무릎 각으로 발목의 (앞, 아래) 위치. IK 검증용. */
export function legFK(thigh: number, knee: number, L1 = LEG.thigh, L2 = LEG.shin): { f: number; h: number } {
  const shinAngle = thigh - knee
  return {
    f: L1 * Math.sin(thigh) + L2 * Math.sin(shinAngle),
    h: L1 * Math.cos(thigh) + L2 * Math.cos(shinAngle),
  }
}

export interface PoseInput {
  /** 일회성 동작 진행도 0..1 */
  t: number
  /** 걷기 사이클 위상(rad) */
  phase: number
  speed: number
  /** 밟기/걸기 대상 줄 위치를 IK로 푼 오른다리 각도 */
  ik: { thigh: number; knee: number } | null
}

const smooth = (a: number, b: number, t: number) => {
  const k = clamp(t, 0, 1)
  return a + (b - a) * k * k * (3 - 2 * k)
}

export function poseFor(state: AnimState, p: PoseInput): Pose {
  const o: Pose = { ...REST_POSE }
  switch (state) {
    case 'idle': {
      const b = Math.sin(p.phase * 0.35)
      o.spine = 0.02 * b
      o.lShoulderZ = 0.12 + 0.02 * b
      o.rShoulderZ = 0.12 + 0.02 * b
      return o
    }
    case 'walk':
    case 'run': {
      const run = state === 'run'
      const amp = run ? 0.85 : 0.5
      const s = Math.sin(p.phase)
      const c = Math.cos(p.phase)
      o.lThigh = s * amp
      o.rThigh = -s * amp
      o.lKnee = 0.08 + (run ? 1.1 : 0.65) * Math.max(0, c)
      o.rKnee = 0.08 + (run ? 1.1 : 0.65) * Math.max(0, -c)
      o.lShoulder = -s * amp * 0.8
      o.rShoulder = s * amp * 0.8
      o.lElbow = run ? 1.1 : 0.35
      o.rElbow = run ? 1.1 : 0.35
      o.spine = run ? 0.18 : 0.05
      o.hipY = -0.025 * Math.abs(c) * (run ? 2 : 1)
      return o
    }
    case 'jump':
    case 'fall': {
      // 발을 접어 줄 위로 넘긴다
      o.lThigh = 0.95
      o.rThigh = 0.75
      o.lKnee = 1.6
      o.rKnee = 1.4
      o.lShoulder = 1.3
      o.rShoulder = 1.3
      o.lShoulderZ = 0.5
      o.rShoulderZ = 0.5
      o.lElbow = 0.4
      o.rElbow = 0.4
      o.spine = 0.12
      return o
    }
    case 'land': {
      const k = 1 - p.t
      o.hipY = -0.12 * k
      o.lThigh = o.rThigh = 0.55 * k
      o.lKnee = o.rKnee = 1.05 * k
      o.spine = 0.25 * k
      o.lShoulderZ = o.rShoulderZ = 0.12 + 0.6 * k // 팔을 벌려 균형
      return o
    }
    case 'step': {
      // 0~0.45 무릎을 들어 올림 → 0.45~0.75 줄 위로 발 구르기(IK) → 복귀
      const ik = p.ik ?? solveLegIK(0.3, HIP_HEIGHT - LEG.ankle)
      const t = p.t
      if (t < 0.45) {
        const k = t / 0.45
        o.rThigh = smooth(0, 1.15, k)
        o.rKnee = smooth(0, 1.55, k)
      } else if (t < 0.75) {
        const k = (t - 0.45) / 0.3
        o.rThigh = smooth(1.15, ik.thigh, k)
        o.rKnee = smooth(1.55, ik.knee, k)
      } else {
        const k = (t - 0.75) / 0.25
        o.rThigh = smooth(ik.thigh, 0, k)
        o.rKnee = smooth(ik.knee, 0.04, k)
      }
      const dip = Math.sin(Math.PI * clamp(t / 0.8, 0, 1))
      o.lKnee = 0.35 * dip + 0.05
      o.lThigh = 0.12 * dip
      o.hipY = -0.08 * dip
      o.spine = 0.12
      o.lShoulderZ = 0.45
      o.rShoulderZ = 0.35
      return o
    }
    case 'hook': {
      // 발등으로 줄을 걸어 당긴 자세를 유지
      const ik = p.ik ?? solveLegIK(0.32, HIP_HEIGHT - 0.2)
      const k = p.t
      o.rThigh = smooth(0, ik.thigh, k * 1.6)
      o.rKnee = smooth(0, ik.knee, k * 1.6)
      o.lKnee = 0.22
      o.hipY = -0.035
      o.spine = -0.05
      o.lShoulderZ = 0.55
      o.rShoulderZ = 0.55
      return o
    }
    case 'turn': {
      // 몸을 돌리며 다리를 교차
      const w = Math.sin(Math.PI * p.t)
      o.lThighZ = 0.04 - 0.3 * w
      o.rThighZ = -0.04 + 0.3 * w
      o.lKnee = 0.3 * w
      o.rKnee = 0.3 * w
      o.hipY = 0.04 * w
      o.lShoulderZ = o.rShoulderZ = 0.12 + 0.7 * w
      if (p.ik) {
        o.rThigh = p.ik.thigh
        o.rKnee = p.ik.knee
        o.rThighZ = -0.04
      }
      return o
    }
    case 'sit': {
      o.hipY = -(HIP_HEIGHT - 0.12)
      o.lThigh = o.rThigh = 1.45
      o.lKnee = o.rKnee = 0.35
      o.lThighZ = 0.12
      o.rThighZ = -0.12
      o.lShoulder = o.rShoulder = 0.3
      o.lElbow = o.rElbow = 0.6
      o.spine = -0.05
      return o
    }
    case 'wave': {
      const w = Math.sin(p.t * Math.PI * 6)
      o.rShoulder = 0.2
      o.rShoulderZ = 2.6
      o.rElbow = 0.5 + 0.35 * w
      o.neck = 0.05
      return o
    }
  }
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}
