/**
 * CharacterRig — 관절 계층을 가진 절차적 어린이 캐릭터.
 * 골반 → 척추 → 목/머리, 어깨 → 팔꿈치 → 손, 엉덩이 → 무릎 → 발목/발.
 * 매 프레임 목표 포즈로 부드럽게 블렌딩해 동작이 끊기지 않는다.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HIP_HEIGHT, REST_POSE, type Pose } from '../game/animation'
import { stripes } from './textures'

export interface Look {
  shirt: string
  shirt2?: string
  pants: string
  skin: string
  hair: string
  shoes: string
  pigtails?: boolean
  skirt?: boolean
}

export const PLAYER_LOOK: Look = { shirt: '#f2c14e', shirt2: '#2f4b7c', pants: '#2c3e63', skin: '#f1c8a5', hair: '#2a1d17', shoes: '#c0392b' }

type J = THREE.Group | null

interface Props {
  look: Look
  /** 매 프레임 목표 포즈 */
  pose: (dt: number) => Pose
  /** 포즈 적용 직후 발 월드 좌표 */
  onFeet?: (l: THREE.Vector3, r: THREE.Vector3) => void
  onApplied?: (p: Pose) => void
  /** useFrame 우선순위 (컨트롤러 이후, 줄 시뮬레이션 이전) */
  priority?: number
  blend?: number
}

const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 12)

export function CharacterRig({ look, pose, onFeet, onApplied, priority = -2, blend = 16 }: Props) {
  const j = useRef<Record<string, J>>({})
  const cur = useRef<Pose>({ ...REST_POSE })
  const footL = useRef<THREE.Object3D>(null)
  const footR = useRef<THREE.Object3D>(null)
  const tmpL = useMemo(() => new THREE.Vector3(), [])
  const tmpR = useMemo(() => new THREE.Vector3(), [])
  const ref = (k: string) => (g: J) => {
    j.current[k] = g
  }

  const mats = useMemo(() => {
    const m = (color: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough })
    const shirt = look.shirt2
      ? new THREE.MeshStandardMaterial({ map: stripes(look.shirt, look.shirt2), roughness: 0.85 })
      : m(look.shirt, 0.85)
    return {
      shirt,
      pants: m(look.pants, 0.9),
      skin: m(look.skin, 0.6),
      hair: m(look.hair, 0.7),
      shoes: m(look.shoes, 0.5),
      sole: m('#f4f1ea', 0.7),
      sock: m('#f4f1ea', 0.9),
      eye: m('#1b1410', 0.3),
      cheek: new THREE.MeshStandardMaterial({ color: '#f29a8a', roughness: 0.8, transparent: true, opacity: 0.55 }),
    }
  }, [look])

  const geo = useMemo(
    () => ({
      torso: capsule(0.13, 0.2),
      pelvis: capsule(0.115, 0.06),
      upperArm: capsule(0.045, 0.14),
      foreArm: capsule(0.04, 0.13),
      thigh: capsule(0.062, 0.18),
      shin: capsule(0.05, 0.18),
      hand: new THREE.SphereGeometry(0.045, 12, 10),
      head: new THREE.SphereGeometry(0.135, 24, 20),
      hair: new THREE.SphereGeometry(0.145, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      eye: new THREE.SphereGeometry(0.016, 8, 8),
      shoe: new THREE.BoxGeometry(0.095, 0.06, 0.19),
      neck: new THREE.CylinderGeometry(0.04, 0.045, 0.08, 10),
      tail: new THREE.SphereGeometry(0.05, 10, 8),
      skirt: new THREE.CylinderGeometry(0.13, 0.2, 0.2, 16, 1, true),
      ear: new THREE.SphereGeometry(0.03, 8, 8),
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const target = pose(dt)
    const a = 1 - Math.exp(-dt * blend)
    const c = cur.current
    for (const k of Object.keys(c) as (keyof Pose)[]) c[k] += (target[k] - c[k]) * a
    const g = j.current
    g.hips!.position.y = HIP_HEIGHT + c.hipY
    g.spine!.rotation.x = c.spine
    g.neck!.rotation.x = c.neck - c.spine * 0.5
    g.lThigh!.rotation.set(-c.lThigh, 0, c.lThighZ)
    g.rThigh!.rotation.set(-c.rThigh, 0, c.rThighZ)
    g.lKnee!.rotation.x = c.lKnee
    g.rKnee!.rotation.x = c.rKnee
    g.lFoot!.rotation.x = c.lThigh - c.lKnee
    g.rFoot!.rotation.x = c.rThigh - c.rKnee
    g.lShoulder!.rotation.set(-c.lShoulder, 0, c.lShoulderZ)
    g.rShoulder!.rotation.set(-c.rShoulder, 0, -c.rShoulderZ)
    g.lElbow!.rotation.x = -c.lElbow
    g.rElbow!.rotation.x = -c.rElbow
    onApplied?.(c)
    if (onFeet && footL.current && footR.current) {
      footL.current.updateWorldMatrix(true, false)
      footR.current.updateWorldMatrix(true, false)
      onFeet(footL.current.getWorldPosition(tmpL), footR.current.getWorldPosition(tmpR))
    }
  }, priority)

  const leg = (side: 'l' | 'r') => {
    const s = side === 'l' ? 1 : -1
    return (
      <group ref={ref(side + 'Thigh')} position={[0.075 * s, 0, 0]}>
        <mesh geometry={geo.thigh} material={look.skirt ? mats.skin : mats.pants} position={[0, -0.145, 0]} castShadow />
        <group ref={ref(side + 'Knee')} position={[0, -0.29, 0]}>
          <mesh geometry={geo.shin} material={mats.skin} position={[0, -0.12, 0]} castShadow />
          <mesh position={[0, -0.23, 0]} castShadow material={mats.sock}>
            <cylinderGeometry args={[0.052, 0.052, 0.06, 10]} />
          </mesh>
          <group ref={ref(side + 'Foot')} position={[0, -0.27, 0]}>
            <mesh geometry={geo.shoe} material={mats.shoes} position={[0, -0.03, 0.04]} castShadow />
            <mesh material={mats.sole} position={[0, -0.058, 0.04]}>
              <boxGeometry args={[0.1, 0.012, 0.195]} />
            </mesh>
            <object3D ref={side === 'l' ? footL : footR} position={[0, -0.03, 0.05]} />
          </group>
        </group>
      </group>
    )
  }

  const arm = (side: 'l' | 'r') => {
    const s = side === 'l' ? 1 : -1
    return (
      <group ref={ref(side + 'Shoulder')} position={[0.175 * s, 0.32, 0]}>
        <mesh geometry={geo.upperArm} material={mats.shirt} position={[0, -0.1, 0]} castShadow />
        <group ref={ref(side + 'Elbow')} position={[0, -0.2, 0]}>
          <mesh geometry={geo.foreArm} material={mats.skin} position={[0, -0.09, 0]} castShadow />
          <mesh geometry={geo.hand} material={mats.skin} position={[0, -0.2, 0.01]} castShadow />
        </group>
      </group>
    )
  }

  return (
    <group>
      <group ref={ref('hips')} position={[0, HIP_HEIGHT, 0]}>
        <mesh geometry={geo.pelvis} material={mats.pants} position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
        {look.skirt && <mesh geometry={geo.skirt} material={mats.pants} position={[0, -0.02, 0]} castShadow />}
        <group ref={ref('spine')} position={[0, 0.06, 0]}>
          <mesh geometry={geo.torso} material={mats.shirt} position={[0, 0.17, 0]} castShadow />
          {arm('l')}
          {arm('r')}
          <group ref={ref('neck')} position={[0, 0.39, 0]}>
            <mesh geometry={geo.neck} material={mats.skin} position={[0, 0.02, 0]} />
            <group position={[0, 0.16, 0]}>
              <mesh geometry={geo.head} material={mats.skin} castShadow />
              <mesh geometry={geo.hair} material={mats.hair} position={[0, 0.012, -0.012]} rotation={[-0.25, 0, 0]} castShadow />
              <mesh geometry={geo.eye} material={mats.eye} position={[0.045, 0.01, 0.123]} />
              <mesh geometry={geo.eye} material={mats.eye} position={[-0.045, 0.01, 0.123]} />
              <mesh geometry={geo.ear} material={mats.skin} position={[0.133, 0, 0]} />
              <mesh geometry={geo.ear} material={mats.skin} position={[-0.133, 0, 0]} />
              <mesh material={mats.cheek} position={[0.07, -0.035, 0.105]}>
                <circleGeometry args={[0.02, 12]} />
              </mesh>
              <mesh material={mats.cheek} position={[-0.07, -0.035, 0.105]}>
                <circleGeometry args={[0.02, 12]} />
              </mesh>
              <mesh material={mats.eye} position={[0, -0.045, 0.128]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.018, 0.004, 6, 12, Math.PI]} />
              </mesh>
              {look.pigtails && (
                <>
                  <mesh geometry={geo.tail} material={mats.hair} position={[0.14, 0.02, -0.05]} castShadow />
                  <mesh geometry={geo.tail} material={mats.hair} position={[-0.14, 0.02, -0.05]} castShadow />
                </>
              )}
            </group>
          </group>
        </group>
        {leg('l')}
        {leg('r')}
      </group>
    </group>
  )
}
