/**
 * PlayerController — 카메라 기준 이동, 충돌, 점프/착지, 밟기·걸기·돌기 동작.
 * 밟기/걸기는 앞에 있는 실제 고무줄 위치를 찾아 몸을 내딛고(lunge) 다리 IK로 발을 그 위치에 놓는다.
 */
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  ACTION_DURATION,
  HIP_HEIGHT,
  poseFor,
  selectAnim,
  solveLegIK,
  type Pose,
} from '../game/animation'
import { resolveCircle } from '../game/collision'
import { nearestPoint } from '../game/rope'
import { moveAxis, takeActions } from '../state/input'
import { runtime } from '../state/runtime'
import { useStore } from '../state/store'
import { CharacterRig, PLAYER_LOOK } from './CharacterRig'

const WALK = 2.4
const RUN = 4.2
const JUMP_V = 3.5
const GRAVITY = 9.8
const RADIUS = 0.22
/** 발 접촉 구 중심은 발목보다 이만큼 앞(발등) */
const FOOT_FWD = 0.05
const FOOT_R = 0.1

/** 바라보는 방향 앞쪽의 고무줄 가닥: 앞 거리(m)와 높이 */
function strandAhead(px: number, pz: number, yaw: number): { forward: number; y: number } | null {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  let best: { forward: number; y: number } | null = null
  for (const rope of runtime.ropes) {
    for (let i = 1; i < rope.pos.length - 1; i++) {
      const p = rope.pos[i]
      const dx = p.x - px
      const dz = p.z - pz
      const fwd = dx * fx + dz * fz
      const lat = dx * fz - dz * fx
      if (fwd > -0.05 && fwd < 0.95 && Math.abs(lat) < 0.45 && (!best || fwd < best.forward)) best = { forward: fwd, y: runtime.ropeHeight }
    }
  }
  return best
}

export function Player({ onInteract }: { onInteract: () => void }) {
  const root = useRef<THREE.Group>(null)
  const st = useRef({
    phase: 0,
    lunge: 0,
    yawStart: 0,
    ik: null as { thigh: number; knee: number } | null,
    hookIk: null as { thigh: number; knee: number } | null,
    prevFeetY: [0, 0],
  })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const p = runtime.player
    const s = st.current
    runtime.frame++
    runtime.time += dt

    // --- 일회성 입력 처리 ---
    for (const a of takeActions()) {
      const busy = p.action === 'step' || p.action === 'hook' || p.action === 'turn'
      if (a === 'jump' && p.grounded && !busy) {
        p.vy = JUMP_V
        p.grounded = false
        p.sitting = false
        if (p.hooked) {
          p.hooked = false
          runtime.hook = null
        }
        p.action = null
      } else if (a === 'step' && p.grounded && !busy && !p.hooked) {
        const t = strandAhead(p.x, p.z, p.yaw)
        if (!t) tooFar()
        s.lunge = t ? THREE.MathUtils.clamp(t.forward - (0.2 + FOOT_FWD), -0.15, 0.6) : 0
        s.ik = solveLegIK(0.2, HIP_HEIGHT - 0.08 - 0.03)
        start('step')
      } else if (a === 'hook' && p.grounded && !busy) {
        if (p.hooked) {
          p.hooked = false
          runtime.hook = null
        } else {
          const t = strandAhead(p.x, p.z, p.yaw)
          if (!t) tooFar()
          s.lunge = t ? THREE.MathUtils.clamp(t.forward - (0.26 + FOOT_FWD), -0.15, 0.6) : 0
          s.hookIk = solveLegIK(0.26, HIP_HEIGHT - 0.035 - (runtime.ropeHeight + 0.06))
          start('hook')
        }
      } else if (a === 'turn' && p.grounded && !busy) {
        s.yawStart = p.yaw
        start('turn')
      } else if (a === 'wave' && !busy) start('wave')
      else if (a === 'sit' && p.grounded && !busy && !p.hooked) p.sitting = !p.sitting
      else if (a === 'interact') onInteract()
    }

    function tooFar() {
      if (useStore.getState().band) useStore.getState().say('발이 줄에 닿지 않았어. 줄 쪽을 바라보고 한 걸음 더 가까이 가볼까?')
    }

    function start(k: 'step' | 'hook' | 'turn' | 'wave') {
      p.action = k
      p.actionT = 0
      p.sitting = false
    }

    // --- 동작 진행 ---
    const ax = moveAxis()
    if (p.sitting && Math.hypot(ax.x, ax.y) > 0.1) p.sitting = false // 이동하려 하면 일어난다
    let lockMove = p.hooked || p.sitting
    if (p.action) {
      const dur = ACTION_DURATION[p.action]
      const prevT = p.actionT
      p.actionT = Math.min(1, p.actionT + dt / dur)
      if (p.action === 'step' || p.action === 'hook') {
        lockMove = true
        // 줄 쪽으로 한 걸음 내딛기 (진행도 0.25~0.6 구간)
        const w = (x: number) => THREE.MathUtils.clamp((x - 0.25) / 0.35, 0, 1)
        const d = (w(p.actionT) - w(prevT)) * s.lunge
        p.x += Math.sin(p.yaw) * d
        p.z += Math.cos(p.yaw) * d
      }
      if (p.action === 'hook' && !p.hooked && p.actionT >= 0.55) {
        const foot = runtime.feet[1]
        runtime.ropes.forEach((rope, strand) => {
          const n = nearestPoint(rope, foot)
          if (!p.hooked && n.d < 0.3) {
            runtime.hook = { strand, index: n.index }
            p.hooked = true
            p.hookedYaw = 0
          }
        })
      }
      if (p.action === 'turn') {
        lockMove = true
        const e = p.actionT * p.actionT * (3 - 2 * p.actionT)
        const ny = s.yawStart + Math.PI * e
        if (p.hooked) p.hookedYaw += Math.abs(ny - p.yaw)
        p.yaw = ny
      }
      if (p.actionT >= 1) p.action = null
    }

    // --- 이동 ---
    const cy = runtime.camera.yaw
    let mx = 0
    let mz = 0
    if (!lockMove) {
      mx = Math.sin(cy) * ax.y - Math.cos(cy) * ax.x
      mz = Math.cos(cy) * ax.y + Math.sin(cy) * ax.x
    }
    const mag = Math.hypot(mx, mz)
    const speed = mag > 0.05 ? mag * (ax.run ? RUN : WALK) : 0
    if (mag > 0.05) {
      p.sitting = false
      const target = Math.atan2(mx, mz)
      let diff = target - p.yaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      p.yaw += diff * Math.min(1, dt * 12)
      p.x += (mx / mag) * speed * dt
      p.z += (mz / mag) * speed * dt
    }
    p.speed = THREE.MathUtils.lerp(p.speed, speed, Math.min(1, dt * 10))
    const r = resolveCircle(p.x, p.z, RADIUS, runtime.colliders, runtime.bounds)
    p.x = r.x
    p.z = r.z

    // --- 수직 ---
    const wasGrounded = p.grounded
    if (!p.grounded) {
      p.vy -= GRAVITY * dt
      p.y += p.vy * dt
      if (p.y <= 0) {
        p.y = 0
        p.vy = 0
        p.grounded = true
      }
    }
    if (!wasGrounded && p.grounded && !p.action) {
      p.action = 'land'
      p.actionT = 0
    }

    p.anim = selectAnim({ grounded: p.grounded, vy: p.vy, speed: p.speed, action: p.action, hooked: p.hooked, sitting: p.sitting })
    s.phase += dt * (p.anim === 'walk' || p.anim === 'run' ? p.speed * 3.4 : 1)

    const g = root.current!
    g.position.set(p.x, p.y, p.z)
    g.rotation.y = p.yaw
  }, -3)

  const pose = (): Pose => {
    const p = runtime.player
    const s = st.current
    const anim = p.anim
    const t = anim === 'hook' ? (p.action === 'hook' ? p.actionT : 1) : p.actionT
    const ik = anim === 'step' ? s.ik : anim === 'hook' || (anim === 'turn' && p.hooked) ? s.hookIk : null
    return poseFor(anim, { t, phase: s.phase, speed: p.speed, ik })
  }

  return (
    <group ref={root}>
      <CharacterRig
        look={PLAYER_LOOK}
        pose={pose}
        onApplied={(c) => {
          const j = runtime.joints
          j.lThigh = c.lThigh
          j.rThigh = c.rThigh
          j.lKnee = c.lKnee
          j.rKnee = c.rKnee
          j.hipY = c.hipY
        }}
        onFeet={(l, r) => {
          const f = runtime.feet
          const s = st.current
          f[0] = { x: l.x, y: l.y, z: l.z, r: FOOT_R, prevY: s.prevFeetY[0] }
          f[1] = { x: r.x, y: r.y, z: r.z, r: FOOT_R, prevY: s.prevFeetY[1] }
          s.prevFeetY = [l.y, r.y]
        }}
      />
    </group>
  )
}
