/**
 * 프레임마다 바뀌는 가변 상태(위치·관절·줄). React 리렌더 없이 useFrame에서 읽고 쓴다.
 * window.__by1998 로 노출해 브라우저 E2E가 실제 3D 상태를 관찰한다(개인 기록은 포함하지 않음).
 */
import type { AnimState, ActionKind } from '../game/animation'
import type { Box2 } from '../game/collision'
import type { Rope, Sphere } from '../game/rope'
import type { Camera } from 'three'
import { Vector3 } from 'three'

export interface PlayerRuntime {
  x: number
  y: number
  z: number
  vy: number
  yaw: number
  speed: number
  grounded: boolean
  anim: AnimState
  action: ActionKind | null
  actionT: number
  hooked: boolean
  hookedYaw: number
  sitting: boolean
}

export const runtime = {
  frame: 0,
  /** 누적 게임 시간(s). 프레임당 dt는 0.1s로 제한된다 */
  time: 0,
  player: {
    x: 0,
    y: 0,
    z: 0,
    vy: 0,
    yaw: Math.PI / 2,
    speed: 0,
    grounded: true,
    anim: 'idle',
    action: null,
    actionT: 0,
    hooked: false,
    hookedYaw: 0,
    sitting: false,
  } as PlayerRuntime,
  /** 플레이어 발(왼, 오) 월드 좌표 구 — 줄 충돌에 사용 */
  feet: [
    { x: 0, y: 0, z: 0, r: 0.09 },
    { x: 0, y: 0, z: 0, r: 0.09 },
  ] as Sphere[],
  /** 적용된 관절 각 (E2E 관찰용) */
  joints: { lThigh: 0, rThigh: 0, lKnee: 0, rKnee: 0, hipY: 0 },
  camera: { yaw: Math.PI / 2, pitch: 0.38, dist: 4.2 },
  colliders: [] as Box2[],
  bounds: { minX: -22, maxX: 22, minZ: -7.5, maxZ: 7.5 } as Box2,
  /** 고무줄 두 가닥 (골목에 있을 때) */
  ropes: [] as Rope[],
  ropeHeight: 0.12,
  hook: null as { strand: number; index: number } | null,
  band: { depression: 0, displacement: 0 },
  cam: null as Camera | null,
  render: { calls: 0, triangles: 0 },
}

declare global {
  interface Window {
    __by1998?: unknown
  }
}

export function exposeDebug(getUi: () => unknown, actions: Record<string, unknown>) {
  window.__by1998 = {
    runtime,
    get ui() {
      return getUi()
    },
    /** 월드 좌표 → 화면 픽셀 (E2E에서 방바닥 클릭 위치 계산용) */
    project(x: number, y: number, z: number) {
      if (!runtime.cam) return null
      const v = new Vector3(x, y, z).project(runtime.cam)
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }
    },
    ...actions,
  }
}
