/**
 * RubberBandGame — 고무줄놀이 진행 판정(순수 로직).
 * 버튼이 아니라 매 프레임 관찰한 실제 상태(캐릭터 위치·공중 여부·줄 눌림·걸림·회전)로만 다음 단계로 넘어간다.
 * 탈락·감점 없음: 실수하면 부드러운 안내와 '균형 잡기' 이벤트만 낸다.
 */
import type { AnimState } from './animation'

export type BandStepId = 'approach' | 'jump' | 'step' | 'hookTurn' | 'release'

export const BAND_STEPS: { id: BandStepId; label: string; hint: string }[] = [
  { id: 'approach', label: '다가가기', hint: '고무줄 옆으로 걸어가 보자.' },
  { id: 'jump', label: '넘기', hint: 'Space(점프)로 두 줄을 한 번에 폴짝 넘어봐.' },
  { id: 'step', label: '밟기', hint: '줄을 바라보고 J(밟기)로 발을 굴러 줄을 눌러봐.' },
  { id: 'hookTurn', label: '걸고 돌기', hint: 'K(걸기)로 발에 줄을 건 채 L(돌기)로 몸을 돌려봐.' },
  { id: 'release', label: '놓고 착지', hint: 'Space로 뛰어 줄을 놓고 사뿐히 착지!' },
]

/** 줄 높이는 데이터로 관리: 지역별 변형/리듬을 이후 추가할 수 있다. */
export const BAND_LEVELS = [
  { id: 'ankle', label: '발목', height: 0.12 },
  { id: 'calf', label: '종아리', height: 0.26 },
  { id: 'knee', label: '무릎', height: 0.4 },
] as const
export type BandLevelId = (typeof BAND_LEVELS)[number]['id']

export interface BandGeometry {
  halfLen: number
  halfGap: number
}

export interface BandObs {
  /** 고무줄 중심 기준 로컬 좌표. 줄은 x축 방향, 두 가닥은 z=±halfGap */
  x: number
  z: number
  grounded: boolean
  depression: number
  anim: AnimState
  hooked: boolean
  /** 걸린 뒤 누적 회전량(rad) */
  hookedYaw: number
}

export type BandEvent = 'stumble' | 'stepDone' | 'finished'

export interface BandState {
  stepIndex: number
  side: -1 | 0 | 1
  crossing: { from: -1 | 1; airborne: boolean } | null
  releasePending: boolean
  wasGrounded: boolean
  message: string
}

export function initBand(): BandState {
  return { stepIndex: 0, side: 0, crossing: null, releasePending: false, wasGrounded: true, message: BAND_STEPS[0].hint }
}

export const currentStep = (s: BandState): BandStepId | 'done' =>
  s.stepIndex >= BAND_STEPS.length ? 'done' : BAND_STEPS[s.stepIndex].id

export function updateBand(prev: BandState, o: BandObs, g: BandGeometry): { state: BandState; events: BandEvent[] } {
  const s: BandState = { ...prev }
  const events: BandEvent[] = []
  const step = currentStep(s)
  const along = Math.abs(o.x) < g.halfLen - 0.15
  const margin = 0.12
  const side: -1 | 0 | 1 = o.z < -g.halfGap - margin ? -1 : o.z > g.halfGap + margin ? 1 : 0

  const advance = (msg?: string) => {
    s.stepIndex += 1
    events.push(s.stepIndex >= BAND_STEPS.length ? 'finished' : 'stepDone')
    s.message = msg ?? (s.stepIndex < BAND_STEPS.length ? BAND_STEPS[s.stepIndex].hint : '다 했다! 정말 멋졌어.')
  }

  // 줄을 가로지르는 움직임 추적 (모든 단계에서 공통)
  if (along && side === 0 && s.side !== 0 && !s.crossing) {
    s.crossing = { from: s.side, airborne: !o.grounded }
  }
  if (s.crossing && side === 0 && o.grounded) s.crossing.airborne = false
  if (s.crossing && side !== 0) {
    const crossed = side === -s.crossing.from
    if (crossed && step === 'jump') {
      if (s.crossing.airborne) advance('폴짝! 두 줄을 넘었어.  ' + BAND_STEPS[2].hint)
      else {
        s.message = '줄을 밟고 지나갔네. 괜찮아, 숨 한 번 고르고 Space로 다시 넘어볼까?'
        events.push('stumble')
      }
    }
    s.crossing = null
  }
  if (!along) s.crossing = null
  if (side !== 0 || !along) s.side = along ? side : 0

  switch (step) {
    case 'approach':
      if (Math.abs(o.x) < g.halfLen && Math.abs(o.z) < 2.2) advance()
      break
    case 'step':
      if (o.anim === 'step' && o.depression >= 0.04) advance('꾹! 줄이 눌렸어.  ' + BAND_STEPS[3].hint)
      break
    case 'hookTurn':
      if (o.hooked && o.hookedYaw >= 2.6) {
        advance('줄을 건 채로 빙글 돌았어!  ' + BAND_STEPS[4].hint)
        s.releasePending = false
      } else if (o.hooked) s.message = '줄이 발에 걸렸어. 이제 L로 몸을 돌려봐.'
      break
    case 'release':
      if (!o.hooked && !o.grounded) s.releasePending = true
      if (s.releasePending && o.grounded && !s.wasGrounded) advance('사뿐! 고무줄 한 판을 끝까지 해냈어.')
      break
    case 'done':
      break
  }
  s.wasGrounded = o.grounded
  return { state: s, events }
}
