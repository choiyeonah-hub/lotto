/**
 * RubberBandGame — 공터의 고무줄놀이 장면.
 * NPC 줄잡이 2명의 발목에 실제로 걸린 탄성 고무줄 두 가닥(Verlet)을 시뮬레이션하고,
 * 플레이어 발과의 접촉·걸기에 따라 줄이 눌리고 당겨지고 복원된다.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { poseFor, REST_POSE, type Pose } from '../game/animation'
import { createRope, maxDepression, maxDisplacement, setAnchors, stepRope, type Rope, type V3 } from '../game/rope'
import { BAND_LEVELS, updateBand, type BandGeometry } from '../game/rubberBand'
import { runtime } from '../state/runtime'
import { useStore } from '../state/store'
import { CharacterRig, type Look } from './CharacterRig'
import { Label } from './Label'

export const BAND_CENTER = { x: 16, z: 0 }
export const BAND_GEOM: BandGeometry = { halfLen: 2.0, halfGap: 0.2 }
const HOLDER_X = 2.25

const LOOKS: Look[] = [
  { shirt: '#e98aa6', pants: '#b0324f', skin: '#f3cdb0', hair: '#24170f', shoes: '#f5f5f5', pigtails: true, skirt: true },
  { shirt: '#5c9b5a', shirt2: '#f0ead8', pants: '#3b3b44', skin: '#e9bf9b', hair: '#1d1410', shoes: '#2d5aa0' },
]

let cheerUntil = 0

function Holder({ index, anchors }: { index: 0 | 1; anchors: React.MutableRefObject<V3[][]> }) {
  const sign = index === 0 ? -1 : 1
  const t = useRef(index * 1.7)
  const pose = (dt: number): Pose => {
    t.current += dt
    if (performance.now() < cheerUntil) return poseFor('wave', { t: (t.current % 1.4) / 1.4, phase: 0, speed: 0, ik: null })
    const o = { ...REST_POSE }
    const lean = Math.min(0.18, runtime.band.displacement * 0.35)
    // 다리를 벌려 고무줄을 버티고, 허리에 손
    o.lThighZ = 0.24
    o.rThighZ = -0.24
    o.lKnee = o.rKnee = 0.08 + lean * 0.6
    o.hipY = -0.01 - lean * 0.05
    o.spine = 0.03 * Math.sin(t.current * 1.3) - lean
    o.neck = 0.1
    o.lShoulderZ = o.rShoulderZ = 0.55
    o.lShoulder = o.rShoulder = -0.25
    o.lElbow = o.rElbow = 1.5
    return o
  }
  return (
    <group position={[BAND_CENTER.x + sign * HOLDER_X, 0, BAND_CENTER.z]} rotation={[0, -sign * (Math.PI / 2), 0]}>
      <CharacterRig
        look={LOOKS[index]}
        pose={pose}
        onFeet={(l, r) => {
          const a = [l, r].sort((p, q) => p.z - q.z)
          anchors.current[index] = a.map((p) => ({ x: p.x, y: 0, z: p.z }))
        }}
      />
      <Label text="NPC 친구 · 줄잡이" position={[0, 1.55, 0]} height={0.14} />
    </group>
  )
}

function Strand({ rope }: { rope: Rope }) {
  const mesh = useRef<THREE.Mesh>(null)
  const pts = useMemo(() => rope.pos.map(() => new THREE.Vector3()), [rope])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts), [pts])
  useFrame(() => {
    rope.pos.forEach((p, i) => pts[i].set(p.x, p.y, p.z))
    const m = mesh.current!
    m.geometry.dispose()
    m.geometry = new THREE.TubeGeometry(curve, 64, 0.011, 6)
  }, -0.5)
  return (
    <mesh ref={mesh} castShadow name="rubber-band">
      <bufferGeometry />
      <meshStandardMaterial color="#f2c230" roughness={0.45} emissive="#5a3c00" emissiveIntensity={0.25} />
    </mesh>
  )
}

export function RubberBandField() {
  const anchors = useRef<V3[][]>([])
  const ropes = useMemo(() => {
    const x0 = BAND_CENTER.x - HOLDER_X
    const x1 = BAND_CENTER.x + HOLDER_X
    return [-1, 1].map((s) => createRope({ x: x0, y: 0.12, z: s * BAND_GEOM.halfGap }, { x: x1, y: 0.12, z: s * BAND_GEOM.halfGap }))
  }, [])

  useEffect(() => {
    runtime.ropes = ropes
    return () => {
      runtime.ropes = []
      runtime.hook = null
    }
  }, [ropes])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const st = useStore.getState()
    const level = BAND_LEVELS.find((l) => l.id === (st.band?.level ?? 'ankle'))!
    runtime.ropeHeight = level.height
    const [A, B] = anchors.current
    ropes.forEach((rope, s) => {
      if (A && B) setAnchors(rope, { ...A[s], y: level.height }, { ...B[s], y: level.height })
      const hook = runtime.hook && runtime.hook.strand === s ? { index: runtime.hook.index, target: runtime.feet[1] } : null
      // 낮은 프레임레이트에서도 안정적이도록 2회 나눠 적분
      stepRope(rope, dt / 2, runtime.feet, hook)
      stepRope(rope, dt / 2, runtime.feet, hook)
    })
    runtime.band.depression = Math.max(...ropes.map(maxDepression))
    runtime.band.displacement = Math.max(...ropes.map(maxDisplacement))

    const band = st.band
    if (!band?.active) return
    const p = runtime.player
    const { state, events } = updateBand(
      band,
      {
        x: p.x - BAND_CENTER.x,
        z: p.z - BAND_CENTER.z,
        grounded: p.grounded,
        depression: runtime.band.depression,
        anim: p.anim,
        hooked: p.hooked,
        hookedYaw: p.hookedYaw,
      },
      BAND_GEOM,
    )
    st.setBand(state)
    for (const e of events) {
      if (e === 'stumble' && !p.action) {
        p.action = 'land' // 가볍게 균형 잡기
        p.actionT = 0
      }
      if (e === 'finished') {
        cheerUntil = performance.now() + 2200
        st.say('친구들: 우와, 끝까지 해냈다! 같이 놀아서 좋았어.')
        setTimeout(() => useStore.getState().openDialogue(), 1600)
      }
    }
  }, -1)

  return (
    <group>
      <Holder index={0} anchors={anchors} />
      <Holder index={1} anchors={anchors} />
      {ropes.map((r, i) => (
        <Strand key={i} rope={r} />
      ))}
    </group>
  )
}
