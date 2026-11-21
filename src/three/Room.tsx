/**
 * Room — 1998년의 나의 방. 장판·벽지·꽃무늬 커튼 창·나무 책상·철제 책꽂이·브라운관 TV·
 * 카세트 플레이어·PC·침대, 그리고 말을 담는 '고무줄 상자'. 소품은 바닥에 배치/이동/회전 후 저장된다.
 */
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { boxAt, type Box2 } from '../game/collision'
import { propById } from '../data/props'
import { runtime } from '../state/runtime'
import { useStore } from '../state/store'
import { RUBBER_BAND_BOX } from '../services/storage'
import { Label } from './Label'
import { PropModel, RubberBandBox } from './PropModels'
import { flowerCloth, linoleum, signText, wallpaper, wood } from './textures'

export const ROOM_BOUNDS: Box2 = { minX: -2.2, maxX: 2.2, minZ: -2, maxZ: 2 }
const W = 4.4
const D = 4
const H = 2.5
export const ROOM_FIXED: Box2[] = [
  boxAt(-1.85, -0.6, 0.7, 1.2), // 책상
  boxAt(-0.9, -1.82, 1.0, 0.36), // 책꽂이
  boxAt(1.6, -0.95, 1.0, 2.1), // 침대
  boxAt(0.35, -1.75, 1.3, 0.5), // TV 장식장
]
export const ROOM_SPAWN = { x: 0.6, z: 0.6, yaw: Math.PI }
export const ROOM_ZONES = [
  { id: 'door', label: '골목으로 나가기', x: 1.4, z: 1.75, r: 0.7 },
  { id: 'box', label: '고무줄 상자 열기', x: -1.3, z: -0.85, r: 0.8 },
  { id: 'radio', label: '카세트 플레이어 (음악 선반)', x: 0.8, z: -1.25, r: 0.7 },
]

const occ = { occluder: true }
const clicked = (e: ThreeEvent<MouseEvent>) => e.delta < 8

function Walls({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const wp = wallpaper()
    return { wall: new THREE.MeshStandardMaterial({ map: wp, roughness: 0.95, side: THREE.DoubleSide }) }
  }, [])
  // 동쪽 벽엔 창문 구멍(z -1.2..0, y 1.0..2.0)을 남긴다
  const winZ0 = -1.25
  const winZ1 = -0.05
  return (
    <group>
      <mesh position={[0, H / 2, -D / 2]} material={mats.wall} receiveShadow castShadow userData={occ}>
        <boxGeometry args={[W, H, 0.1]} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} material={mats.wall} receiveShadow castShadow userData={occ}>
        <boxGeometry args={[0.1, H, D]} />
      </mesh>
      {/* 남쪽 벽 (문 자리 x 1.0~1.8) */}
      <mesh position={[-0.6, H / 2, D / 2]} material={mats.wall} receiveShadow castShadow userData={occ}>
        <boxGeometry args={[3.2, H, 0.1]} />
      </mesh>
      <mesh position={[2.0, H / 2, D / 2]} material={mats.wall} castShadow userData={occ}>
        <boxGeometry args={[0.4, H, 0.1]} />
      </mesh>
      <mesh position={[1.4, 2.25, D / 2]} material={mats.wall} castShadow userData={occ}>
        <boxGeometry args={[0.8, 0.5, 0.1]} />
      </mesh>
      {/* 동쪽 벽 4조각 */}
      <mesh position={[W / 2, H / 2, (winZ0 + -D / 2) / 2]} material={mats.wall} castShadow userData={occ}>
        <boxGeometry args={[0.1, H, winZ0 + D / 2]} />
      </mesh>
      <mesh position={[W / 2, H / 2, (winZ1 + D / 2) / 2]} material={mats.wall} castShadow userData={occ}>
        <boxGeometry args={[0.1, H, D / 2 - winZ1]} />
      </mesh>
      <mesh position={[W / 2, 0.5, (winZ0 + winZ1) / 2]} material={mats.wall} castShadow userData={occ}>
        <boxGeometry args={[0.1, 1.0, winZ1 - winZ0]} />
      </mesh>
      <mesh position={[W / 2, 2.25, (winZ0 + winZ1) / 2]} material={mats.wall} castShadow userData={occ}>
        <boxGeometry args={[0.1, 0.5, winZ1 - winZ0]} />
      </mesh>
      {/* 창틀과 유리, 꽃무늬 커튼 */}
      <group position={[W / 2, 1.5, (winZ0 + winZ1) / 2]}>
        <mesh>
          <boxGeometry args={[0.14, 1.02, 0.05]} />
          <meshStandardMaterial color="#e9e3d3" />
        </mesh>
        <mesh position={[0.06, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 1.0]} />
          <meshStandardMaterial color={night ? '#1b2440' : '#f6b26b'} emissive={night ? '#0e1630' : '#f08a4b'} emissiveIntensity={night ? 0.6 : 0.5} transparent opacity={0.35} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-0.1, 0.05, s * 0.72]} castShadow>
            <boxGeometry args={[0.04, 1.35, 0.34]} />
            <meshStandardMaterial map={flowerCloth()} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[-0.12, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.9]} />
          <meshStandardMaterial color="#c9a227" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* 문 */}
      <group position={[1.4, 1.0, D / 2 - 0.02]}>
        <mesh userData={occ}>
          <boxGeometry args={[0.78, 2.0, 0.05]} />
          <meshStandardMaterial map={wood('#8b5e3c')} />
        </mesh>
        <mesh position={[0.3, 0, -0.04]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      {/* 바닥 · 천장 · 걸레받이 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow name="room-floor">
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={linoleum()} roughness={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]} userData={occ}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f3efe6" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, H - 0.04, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 24]} />
        <meshStandardMaterial color="#ffffff" emissive="#fffbe8" emissiveIntensity={night ? 1.2 : 0.4} />
      </mesh>
      {/* 벽의 달력과 사진 */}
      <mesh position={[-0.2, 1.55, -D / 2 + 0.06]}>
        <planeGeometry args={[0.42, 0.56]} />
        <meshStandardMaterial map={signText('1998', '#fbf7ee', '#b03a2e', 256, 340)} />
      </mesh>
      <mesh position={[-W / 2 + 0.06, 1.7, 0.7]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.5, 0.36]} />
        <meshStandardMaterial color="#d9c7a3" />
      </mesh>
    </group>
  )
}

function Furniture({ night }: { night: boolean }) {
  const w = wood('#9a6a3f')
  const books = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: -0.43 + (i % 11) * 0.08,
        y: 0.55 + Math.floor(i / 11) * 0.5,
        h: 0.24 + ((i * 37) % 7) * 0.02,
        c: ['#a93226', '#1f618d', '#d4ac0d', '#196f3d', '#6c3483', '#ca6f1e'][i % 6],
      })),
    [],
  )
  return (
    <group>
      {/* 나무 책상 + 서랍 */}
      <group position={[-1.85, 0, -0.6]}>
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.65, 0.05, 1.2]} />
          <meshStandardMaterial map={w} />
        </mesh>
        <mesh position={[0, 0.36, -0.38]} castShadow>
          <boxGeometry args={[0.6, 0.7, 0.42]} />
          <meshStandardMaterial map={w} />
        </mesh>
        {[0.55, 0.33, 0.12].map((y) => (
          <mesh key={y} position={[0.305, y, -0.38]}>
            <boxGeometry args={[0.01, 0.16, 0.36]} />
            <meshStandardMaterial color="#7d5230" />
          </mesh>
        ))}
        <mesh position={[0, 0.36, 0.56]} castShadow>
          <boxGeometry args={[0.6, 0.7, 0.04]} />
          <meshStandardMaterial map={w} />
        </mesh>
        {/* 베이지 PC와 CRT 모니터, 플로피 디스크 */}
        <group position={[-0.1, 0.745, 0.25]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.36, 0.34, 0.36]} />
            <meshStandardMaterial color="#d9d2bd" roughness={0.6} />
          </mesh>
          <mesh position={[0.181, 0.21, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.28, 0.21]} />
            <meshStandardMaterial color="#2a3a3a" emissive={night ? '#3c7a6a' : '#1e3d36'} emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.22, 0.005, 0]}>
            <boxGeometry args={[0.13, 0.02, 0.36]} />
            <meshStandardMaterial color="#e7e1cc" />
          </mesh>
        </group>
        <mesh position={[0.1, 0.75, -0.35]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.09, 0.004, 0.09]} />
          <meshStandardMaterial color="#1f3b73" />
        </mesh>
        {/* 일기장 */}
        <mesh position={[0.12, 0.755, -0.1]} rotation={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.16, 0.025, 0.22]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
      </group>
      {/* 의자 */}
      <group position={[-1.32, 0, -0.62]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.38, 0.04, 0.38]} />
          <meshStandardMaterial map={w} />
        </mesh>
        <mesh position={[0.18, 0.66, 0]} castShadow>
          <boxGeometry args={[0.03, 0.45, 0.36]} />
          <meshStandardMaterial map={w} />
        </mesh>
        {[
          [-0.16, -0.16],
          [0.16, -0.16],
          [-0.16, 0.16],
          [0.16, 0.16],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.2, z]}>
            <cylinderGeometry args={[0.015, 0.015, 0.4]} />
            <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* 철제 책꽂이 */}
      <group position={[-0.9, 0, -1.82]}>
        {[0.05, 0.5, 1.0, 1.5].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 0.02, 0.34]} />
            <meshStandardMaterial color="#8a9aa3" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {[-0.49, 0.49].map((x) => (
          <mesh key={x} position={[x, 0.78, 0]} castShadow>
            <boxGeometry args={[0.02, 1.56, 0.34]} />
            <meshStandardMaterial color="#8a9aa3" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {books.map((b, i) => (
          <mesh key={i} position={[b.x, b.y - 0.43 + b.h / 2, 0]} castShadow>
            <boxGeometry args={[0.06, b.h, 0.22]} />
            <meshStandardMaterial color={b.c} roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* 침대 + 꽃무늬 이불 + 토끼 인형 */}
      <group position={[1.6, 0, -0.95]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.4, 2.05]} />
          <meshStandardMaterial map={w} />
        </mesh>
        <mesh position={[0, 0.45, 0.1]} castShadow>
          <boxGeometry args={[0.98, 0.12, 1.7]} />
          <meshStandardMaterial map={flowerCloth()} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.5, -0.8]} castShadow>
          <boxGeometry args={[0.6, 0.12, 0.3]} />
          <meshStandardMaterial color="#f8f4ea" roughness={0.95} />
        </mesh>
        <group position={[-0.2, 0.52, -0.55]}>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.95} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.03, 0.34, 0]} scale={[0.35, 1.3, 0.35]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#f2f2f2" roughness={0.95} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 장식장 + 브라운관 TV */}
      <group position={[0.35, 0, -1.75]}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.5, 0.48]} />
          <meshStandardMaterial map={wood('#5e3b22')} />
        </mesh>
        <group position={[-0.25, 0.5, 0]}>
          <mesh position={[0, 0.24, -0.02]} castShadow>
            <boxGeometry args={[0.56, 0.48, 0.44]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.5} />
          </mesh>
          <mesh position={[-0.04, 0.25, 0.205]}>
            <planeGeometry args={[0.4, 0.32]} />
            <meshStandardMaterial color="#20302e" emissive="#9fc9c0" emissiveIntensity={night ? 0.35 : 0.08} roughness={0.15} />
          </mesh>
          {[0.32, 0.18].map((y) => (
            <mesh key={y} position={[0.22, y, 0.205]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.02, 10]} />
              <meshStandardMaterial color="#aaa" metalness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

/** 카세트 플레이어(라디오) — 누르면 음악 선반 */
function CassettePlayer() {
  const openPanel = useStore((s) => s.openPanel)
  return (
    <group
      position={[0.75, 0.5, -1.7]}
      onClick={(e) => {
        if (!clicked(e)) return
        e.stopPropagation()
        openPanel('music')
      }}
      name="cassette-player"
    >
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.42, 0.22, 0.14]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.4} metalness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.13, 0.11, 0.071]}>
          <circleGeometry args={[0.065, 20]} />
          <meshStandardMaterial color="#555" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.13, 0.072]}>
        <planeGeometry args={[0.11, 0.07]} />
        <meshStandardMaterial color="#c9c9c9" />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.36]} />
        <meshStandardMaterial color="#aaa" metalness={0.7} />
      </mesh>
    </group>
  )
}

function PlacedProps() {
  const room = useStore((s) => s.room)
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const memories = useStore((s) => s.memories)
  const placingMove = useStore((s) => s.placing?.moveId)
  return (
    <group>
      {room
        .filter((p) => p.id !== placingMove)
        .map((p) => (
          <group
            key={p.id}
            position={[p.x, 0, p.z]}
            rotation={[0, p.rotY, 0]}
            name={`placed-${p.propId}`}
            onClick={(e) => {
              if (!clicked(e)) return
              e.stopPropagation()
              select(p.id)
            }}
          >
            <PropModel id={p.propId} />
            {selected === p.id && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[(propById(p.propId)?.radius ?? 0.25) + 0.04, (propById(p.propId)?.radius ?? 0.25) + 0.09, 32]} />
                <meshBasicMaterial color="#ffcf5c" />
              </mesh>
            )}
            {(memories[p.id]?.notes.length ?? 0) > 0 && (
              <Label text="✦ 기억" position={[0, 0.7, 0]} height={0.08} bg="rgba(217,105,47,0.9)" />
            )}
          </group>
        ))}
    </group>
  )
}

function PlacementGhost() {
  const placing = useStore((s) => s.placing)
  const ghost = useRef<THREE.Group>(null)
  const pos = useRef({ x: 0, z: 0.5 })
  useFrame(() => {
    if (ghost.current) ghost.current.position.set(pos.current.x, 0, pos.current.z)
  })
  if (!placing) return null
  const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v))
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        name="placement-floor"
        onPointerMove={(e) => {
          pos.current = { x: clamp(e.point.x, 2.0), z: clamp(e.point.z, 1.8) }
        }}
        onClick={(e) => {
          if (!clicked(e)) return
          e.stopPropagation()
          const x = clamp(e.point.x, 2.0)
          const z = clamp(e.point.z, 1.8)
          const r = propById(placing.propId)?.radius ?? 0.25
          if (ROOM_FIXED.some((b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r)) {
            useStore.getState().say('가구와 겹쳐요. 비어 있는 방바닥을 골라주세요.')
            return
          }
          useStore.getState().place(x, z)
        }}
      >
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial transparent opacity={0.08} color="#ffcf5c" />
      </mesh>
      <group ref={ghost}>
        <PropModel id={placing.propId} ghost />
      </group>
    </>
  )
}

export function roomColliders(room: { propId: string; x: number; z: number }[]): Box2[] {
  return [
    ...ROOM_FIXED,
    ...room.map((p) => {
      const r = (propById(p.propId)?.radius ?? 0.25) * 0.8
      return boxAt(p.x, p.z, r * 2, r * 2)
    }),
  ]
}

export function Room() {
  const night = useStore((s) => s.settings.time === 'night')
  const count = useStore((s) => s.memories[RUBBER_BAND_BOX]?.notes.length ?? 0)
  const openPanel = useStore((s) => s.openPanel)
  const room = useStore((s) => s.room)
  useEffect(() => {
    runtime.colliders = roomColliders(room)
  }, [room])
  return (
    <group>
      <Walls night={night} />
      <Furniture night={night} />
      <CassettePlayer />
      <group
        position={[-1.85, 0.745, -0.85]}
        rotation={[0, Math.PI / 2, 0]}
        name="rubber-band-box"
        onClick={(e) => {
          if (!clicked(e)) return
          e.stopPropagation()
          openPanel('memoryBox')
        }}
      >
        <RubberBandBox glow={count > 0} />
        <Label text={`고무줄 상자${count > 0 ? ` · ${count}` : ''}`} position={[0, 0.32, 0]} height={0.07} bg="rgba(217,105,47,0.92)" />
      </group>
      <PlacedProps />
      <PlacementGhost />
      {/* 실내 조명: 천장 형광등 + 창으로 드는 빛 */}
      <pointLight position={[0, H - 0.25, 0]} intensity={night ? 6 : 2.2} distance={7} decay={1.5} color={night ? '#fff4d6' : '#fff8ee'} castShadow shadow-mapSize={[512, 512]} />
      <directionalLight
        position={[7, night ? 3 : 2.6, -0.6]}
        intensity={night ? 0.25 : 2.6}
        color={night ? '#8fa6d8' : '#ffb067'}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
    </group>
  )
}
