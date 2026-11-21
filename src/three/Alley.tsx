/**
 * Alley — 1998년 한국 주택가 골목. 연립·단독주택, 콘크리트 담과 대문, 전봇대와 전선,
 * 문방구, 공터(고무줄놀이 장소)가 실제 3D 좌표에 놓인다.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boxAt, type Box2 } from '../game/collision'
import { runtime } from '../state/runtime'
import { useStore } from '../state/store'
import { asphalt, brick, concrete, dirt, sidewalk, signText, wood } from './textures'
import { RubberBandField, BAND_CENTER } from './RubberBandGame'

export const ALLEY_BOUNDS: Box2 = { minX: -21.5, maxX: 21.5, minZ: -7.3, maxZ: 7.3 }
export const ALLEY_COLLIDERS: Box2[] = [
  { minX: -30, maxX: 11, minZ: -12, maxZ: -3.05 }, // 북쪽 담/집
  { minX: -30, maxX: 11, minZ: 3.05, maxZ: 12 }, // 남쪽 담/집/문방구
  boxAt(19.6, -5.2, 0.6, 0.6), // 공터 나무
  boxAt(13.2, 5.6, 2.2, 1.4), // 평상
  boxAt(14, 7, 0.4, 0.4), // 전봇대
]
export const SPAWN = { start: { x: 0, z: 0, yaw: Math.PI / 2 }, fromRoom: { x: -6, z: -2.2, yaw: 0 } }

export const ALLEY_ZONES = [
  { id: 'home', label: '우리 집에 들어가기', x: -6, z: -2.6, r: 1.4 },
  { id: 'shop', label: '문방구 둘러보기', x: 4.5, z: 2.6, r: 1.8 },
  { id: 'band', label: '고무줄놀이 하기', x: BAND_CENTER.x, z: BAND_CENTER.z, r: 3.2 },
]

const occ = { occluder: true }
/** 방범창 창살 5개를 한 지오메트리로 합쳐 드로우콜을 줄인다 */
const GRILL = mergeGeometries([-0.4, -0.2, 0, 0.2, 0.4].map((x) => new THREE.BoxGeometry(0.025, 1.0, 0.025).translate(x, 0, 0.09)))

function Building({
  x,
  z,
  w,
  d,
  h,
  tex,
  facing,
  night,
  roof,
  tank,
}: {
  x: number
  z: number
  w: number
  d: number
  h: number
  tex: THREE.Texture
  facing: 1 | -1
  night: boolean
  roof?: string
  tank?: boolean
}) {
  const floors = Math.max(1, Math.round(h / 2.8))
  const cols = Math.max(1, Math.floor(w / 2.4))
  const front = z + (facing * d) / 2 + facing * 0.01
  const mats = useMemo(() => {
    const t = tex.clone()
    t.repeat.set(w / 2.5, h / 2.5)
    t.needsUpdate = true
    return {
      wall: new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }),
      win: new THREE.MeshStandardMaterial({ color: night ? '#ffd58a' : '#38464f', emissive: night ? '#ffb347' : '#000000', emissiveIntensity: night ? 1.4 : 0, roughness: 0.25, metalness: 0.2 }),
      frame: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.7 }),
      grill: new THREE.MeshStandardMaterial({ color: '#3d4a3f', roughness: 0.6, metalness: 0.4 }),
    }
  }, [tex, w, h, night])
  return (
    <group>
      <mesh position={[x, h / 2, z]} material={mats.wall} castShadow receiveShadow userData={occ}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {Array.from({ length: floors * cols }, (_, i) => {
        const f = Math.floor(i / cols)
        const c = i % cols
        const wx = x - w / 2 + (w / cols) * (c + 0.5)
        const wy = 1.5 + f * 2.8
        if (wy > h - 0.6) return null
        // 1990년대식 방범창(창살)이 달린 창
        return (
          <group key={i} position={[wx, wy, front]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
            <mesh material={mats.frame}>
              <boxGeometry args={[1.25, 1.05, 0.06]} />
            </mesh>
            <mesh material={mats.win} position={[0, 0, 0.035]}>
              <planeGeometry args={[1.1, 0.9]} />
            </mesh>
            <mesh geometry={GRILL} material={mats.grill} />
          </group>
        )
      })}
      {roof ? (
        <group position={[x, h + 0.55, z]} scale={[w + 0.4, 1, d + 0.4]}>
          <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
            <cylinderGeometry args={[0.01, Math.SQRT1_2, 1.1, 4, 1]} />
            <meshStandardMaterial color={roof} roughness={0.8} flatShading />
          </mesh>
        </group>
      ) : (
        <mesh position={[x, h + 0.25, z]} castShadow>
          <boxGeometry args={[w + 0.1, 0.5, d + 0.1]} />
          <meshStandardMaterial color="#cfc7b8" roughness={0.9} />
        </mesh>
      )}
      {tank && (
        <mesh position={[x + w / 4, h + 0.9, z - facing * d * 0.2]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 1.3, 20]} />
          <meshStandardMaterial color="#3f8a52" roughness={0.5} />
        </mesh>
      )}
      {tank && (
        <group position={[x - w / 3, h + 0.5, z]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.6]} />
            <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
          </mesh>
          {[0, 0.25, 0.5].map((y) => (
            <mesh key={y} position={[0, 1.2 + y * 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.9 - y]} />
              <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

/** 콘크리트 블록 담장. gaps는 대문 자리 (x 중심, 폭) */
function Wall({ z, x0, x1, gaps = [], h = 1.7 }: { z: number; x0: number; x1: number; gaps?: [number, number][]; h?: number }) {
  const segs: [number, number][] = []
  let cur = x0
  for (const [gx, gw] of [...gaps].sort((a, b) => a[0] - b[0])) {
    segs.push([cur, gx - gw / 2])
    cur = gx + gw / 2
  }
  segs.push([cur, x1])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: concrete(3, 1), roughness: 0.95 }), [])
  return (
    <group>
      {segs
        .filter(([a, b]) => b - a > 0.05)
        .map(([a, b]) => (
          <group key={a}>
            <mesh position={[(a + b) / 2, h / 2, z]} material={mat} castShadow receiveShadow userData={occ}>
              <boxGeometry args={[b - a, h, 0.2]} />
            </mesh>
            <mesh position={[(a + b) / 2, h + 0.05, z]} castShadow>
              <boxGeometry args={[b - a, 0.1, 0.3]} />
              <meshStandardMaterial color="#8d4f3a" roughness={0.8} />
            </mesh>
          </group>
        ))}
    </group>
  )
}

/** 철제 대문 */
function Gate({ x, z, color, label, facing = 1 }: { x: number; z: number; color: string; label?: string; facing?: 1 | -1 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      {[-0.36, 0.36].map((dx) => (
        <group key={dx} position={[dx, 0, 0]}>
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.7, 1.9, 0.05]} />
            <meshStandardMaterial color={color} roughness={0.55} metalness={0.35} />
          </mesh>
          {[0.6, 1.0, 1.4].map((y) => (
            <mesh key={y} position={[0, y, 0.04]}>
              <boxGeometry args={[0.6, 0.04, 0.03]} />
              <meshStandardMaterial color="#e8e1cf" roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0.6, 1.0, 0.05]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
      {label && (
        <mesh position={[0.95, 1.55, 0.03]}>
          <planeGeometry args={[0.42, 0.13]} />
          <meshStandardMaterial map={signText(label, '#2c2c2c', '#f3efe3', 256, 80)} />
        </mesh>
      )}
    </group>
  )
}

function Pole({ x, z, lamp, night }: { x: number; z: number; lamp?: boolean; night: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.6, 0]} castShadow userData={occ}>
        <cylinderGeometry args={[0.11, 0.15, 7.2, 12]} />
        <meshStandardMaterial map={concrete(1, 4)} roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.6, 0]}>
        <boxGeometry args={[1.4, 0.1, 0.1]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.3, 5.9, 0.2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 12]} />
        <meshStandardMaterial color="#7a7f80" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 전봇대 광고 전단지 */}
      <mesh position={[0, 1.6, -0.16]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.22, 0.3]} />
        <meshStandardMaterial color="#f4ecd2" roughness={1} />
      </mesh>
      {lamp && (
        <group position={[0, 4.6, -0.6]}>
          <mesh>
            <boxGeometry args={[0.1, 0.06, 1.1]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[0, -0.08, -0.5]}>
            <boxGeometry args={[0.24, 0.08, 0.36]} />
            <meshStandardMaterial color="#fff6d8" emissive="#ffd27a" emissiveIntensity={night ? 2.5 : 0.1} />
          </mesh>
          {night && <pointLight position={[0, -0.4, -0.5]} intensity={14} distance={11} decay={1.6} color="#ffd59a" />}
        </group>
      )}
    </group>
  )
}

/** 처진 전선 */
function Wire({ a, b, sag = 0.5 }: { a: THREE.Vector3Tuple; b: THREE.Vector3Tuple; sag?: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.012, 4)
  }, [a, b, sag])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#1c1c1c" roughness={0.8} />
    </mesh>
  )
}

function Planter({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.34, 16]} />
        <meshStandardMaterial color="#a23b2a" roughness={0.7} />
      </mesh>
      {[
        [0, 0.5, 0, 0.28],
        [0.15, 0.62, 0.05, 0.2],
        [-0.12, 0.58, -0.05, 0.22],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i ? '#4e7d3a' : '#3f6b30'} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function StationeryShop({ x, z, night }: { x: number; z: number; night: boolean }) {
  const boxes = useMemo(() => {
    const colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#ff7eb6']
    const out: { p: THREE.Vector3Tuple; s: THREE.Vector3Tuple; c: string }[] = []
    let k = 0
    for (let shelf = 0; shelf < 3; shelf++)
      for (let i = 0; i < 9; i++) {
        k++
        out.push({ p: [-2.6 + i * 0.62, 0.55 + shelf * 0.6, 1.1], s: [0.45, 0.32 + ((k * 7) % 3) * 0.06, 0.3], c: colors[k % colors.length] })
      }
    return out
  }, [])
  return (
    <group position={[x, 0, z]}>
      {/* 가게 몸체: 앞면이 뚫려 있어 안이 보인다 */}
      <mesh position={[0, 1.7, 1.95]} castShadow receiveShadow userData={occ}>
        <boxGeometry args={[7, 3.4, 0.2]} />
        <meshStandardMaterial map={concrete(3, 1)} />
      </mesh>
      {[-3.4, 3.4].map((sx) => (
        <mesh key={sx} position={[sx, 1.7, 0.9]} castShadow userData={occ}>
          <boxGeometry args={[0.2, 3.4, 2.2]} />
          <meshStandardMaterial map={concrete(1, 1)} />
        </mesh>
      ))}
      <mesh position={[0, 3.45, 0.9]} castShadow>
        <boxGeometry args={[7, 0.2, 2.3]} />
        <meshStandardMaterial color="#cfc7b8" />
      </mesh>
      <mesh position={[0, 0.01, 0.9]} receiveShadow>
        <boxGeometry args={[6.6, 0.02, 2.1]} />
        <meshStandardMaterial color="#6f6a62" />
      </mesh>
      {/* 간판 */}
      <mesh position={[0, 3.0, -0.25]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4.2, 0.8]} />
        <meshStandardMaterial map={signText('희망문방구', '#1f5fa8', '#fff7d6')} emissive={night ? '#ffffff' : '#000000'} emissiveIntensity={night ? 0.25 : 0} emissiveMap={signText('희망문방구', '#1f5fa8', '#fff7d6')} />
      </mesh>
      {/* 줄무늬 차양 */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-3.15 + i * 0.7, 2.45, -0.55]} rotation={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.03, 1.0]} />
          <meshStandardMaterial color={i % 2 ? '#f4efe4' : '#c0392b'} roughness={0.8} />
        </mesh>
      ))}
      {/* 진열 선반과 물건 */}
      {[0, 1, 2].map((s) => (
        <mesh key={s} position={[0, 0.38 + s * 0.6, 1.1]}>
          <boxGeometry args={[5.8, 0.04, 0.5]} />
          <meshStandardMaterial map={wood('#7a5230')} />
        </mesh>
      ))}
      {boxes.map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1] + b.s[1] / 2 - 0.15, b.p[2]]} castShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={b.c} roughness={0.6} />
        </mesh>
      ))}
      {/* 가게 앞 뽑기 기계와 평대 */}
      <group position={[-2.6, 0, -0.35]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.6, 1.1, 0.5]} />
          <meshStandardMaterial color="#d63031" roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.32, 20, 16]} />
          <meshPhysicalMaterial color="#ffffff" transmission={0.7} roughness={0.05} thickness={0.1} transparent opacity={0.6} />
        </mesh>
      </group>
      <mesh position={[1.6, 0.45, -0.3]} castShadow>
        <boxGeometry args={[2.2, 0.9, 0.6]} />
        <meshStandardMaterial map={wood('#9a6b3f')} />
      </mesh>
      {night && <pointLight position={[0, 2.6, 0.8]} intensity={8} distance={7} color="#fff1d0" />}
    </group>
  )
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 2.8, 10]} />
        <meshStandardMaterial color="#5a3d26" roughness={1} />
      </mesh>
      {[
        [0, 3.3, 0, 1.5],
        [0.9, 2.9, 0.4, 1.0],
        [-0.8, 3.0, -0.3, 1.1],
        [0.2, 3.9, -0.5, 0.9],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={['#5f8a3c', '#6d9645', '#557d34', '#79a04b'][i]} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** 공터의 평상 */
function Pyeongsang({ x, z }: { x: number; z: number }) {
  const w = wood('#a0703f')
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.08, 1.4]} />
        <meshStandardMaterial map={w} />
      </mesh>
      {[
        [-1, -0.6],
        [1, -0.6],
        [-1, 0.6],
        [1, 0.6],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}${lz}`} position={[lx, 0.2, lz]} castShadow>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial map={w} />
        </mesh>
      ))}
    </group>
  )
}

/** 공터 너머 1990년대 5층 아파트 */
function DistantApartments() {
  return (
    <group>
      {[-10, 0, 10].map((z, i) => (
        <group key={z} position={[34, 0, z * 1.6]}>
          <mesh position={[0, 7.5, 0]}>
            <boxGeometry args={[4, 15, 14]} />
            <meshStandardMaterial color="#d7d0c2" roughness={1} />
          </mesh>
          <mesh position={[-2.01, 13.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[3.2, 1.2]} />
            <meshStandardMaterial map={signText(`${101 + i}동`, '#d7d0c2', '#3a5a8c', 256, 96)} />
          </mesh>
          {Array.from({ length: 5 }, (_, f) => (
            <mesh key={f} position={[-2.01, 1.8 + f * 2.8, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[13, 1.1]} />
              <meshStandardMaterial color="#5b6b73" roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 비 오는 날: 카메라 주변에 떨어지는 빗줄기 */
function Rain() {
  const count = 1400
  const { mesh, data } = useMemo(() => {
    const g = new THREE.BoxGeometry(0.008, 0.35, 0.008)
    const m = new THREE.MeshBasicMaterial({ color: '#c9d6e3', transparent: true, opacity: 0.45 })
    const mesh = new THREE.InstancedMesh(g, m, count)
    mesh.frustumCulled = false
    const data = Array.from({ length: count }, () => ({ x: (Math.random() - 0.5) * 24, y: Math.random() * 10, z: (Math.random() - 0.5) * 24, v: 9 + Math.random() * 4 }))
    return { mesh, data }
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dt) => {
    const p = runtime.player
    data.forEach((d, i) => {
      d.y -= d.v * Math.min(dt, 0.1)
      if (d.y < 0) d.y += 10
      tmp.position.set(p.x + d.x, d.y, p.z + d.z)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

export function Alley() {
  const time = useStore((s) => s.settings.time)
  const rain = useStore((s) => s.settings.rain)
  const night = time === 'night'
  const tex = useMemo(() => ({ brick: brick(2, 2), brick2: brick(2, 2, '#7d5a48'), conc: concrete(2, 2) }), [])
  const wet = rain ? 0.35 : 0.95
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5.5, 0, 0]} receiveShadow>
        <planeGeometry args={[33, 6.2]} />
        <meshStandardMaterial map={asphalt(10, 2)} roughness={wet} metalness={rain ? 0.15 : 0} />
      </mesh>
      {[-2.85, 2.85].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[-5.5, 0.005, z]} receiveShadow>
          <planeGeometry args={[33, 0.5]} />
          <meshStandardMaterial map={sidewalk(40, 1)} roughness={wet} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[16.5, 0, 0]} receiveShadow>
        <planeGeometry args={[11, 15]} />
        <meshStandardMaterial map={dirt(4, 5)} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#6f6658" roughness={1} />
      </mesh>

      {/* 북쪽: 담장, 대문, 집 */}
      <Wall z={-3.15} x0={-22} x1={11} gaps={[[-15, 1.5], [-6, 1.5], [3, 1.5]]} />
      <Gate x={-15} z={-3.15} color="#3b6e8f" />
      <Gate x={-6} z={-3.15} color="#2f7d5b" label="우리 집" />
      <Gate x={3} z={-3.15} color="#8f3b3b" />
      <Building x={-18} z={-6.4} w={7} d={5} h={5.8} tex={tex.brick} facing={1} night={night} tank />
      <Building x={-6.5} z={-6.2} w={7} d={4.6} h={3.2} tex={tex.conc} facing={1} night={night} roof="#a8412f" />
      <Building x={3} z={-6.6} w={8} d={5} h={6.2} tex={tex.brick2} facing={1} night={night} tank />
      <Building x={9.4} z={-6.2} w={3.2} d={5} h={3.6} tex={tex.conc} facing={1} night={night} roof="#3d5a80" />

      {/* 남쪽: 담장, 집, 문방구 */}
      <Wall z={3.15} x0={-22} x1={1} gaps={[[-11, 1.5]]} />
      <Wall z={3.15} x0={8} x1={11} />
      <Gate x={-11} z={3.15} color="#6b5b95" facing={-1} />
      <Building x={-17} z={6.4} w={9} d={5} h={6} tex={tex.brick} facing={-1} night={night} tank />
      <Building x={-6} z={6.2} w={9} d={4.6} h={3.4} tex={tex.conc} facing={-1} night={night} roof="#36597a" />
      <StationeryShop x={4.5} z={3.25} night={night} />
      <Building x={4.5} z={7.4} w={7} d={2.5} h={3.6} tex={tex.conc} facing={-1} night={night} />
      <Building x={9.6} z={6.4} w={2.8} d={5} h={4.5} tex={tex.brick2} facing={-1} night={night} />

      {/* 공터 경계 담 */}
      <Wall z={-7.5} x0={11} x1={22} h={1.5} />
      <Wall z={7.5} x0={11} x1={22} h={1.5} />
      <group rotation={[0, Math.PI / 2, 0]} position={[22, 0, 0]}>
        <Wall z={0} x0={-7.5} x1={7.5} h={1.5} />
      </group>
      <mesh position={[-22.6, 2.5, 0]} userData={occ}>
        <boxGeometry args={[1, 5, 6.3]} />
        <meshStandardMaterial map={brick(2, 2, '#8a5442')} />
      </mesh>

      {/* 전봇대와 전선 */}
      <Pole x={-16} z={2.7} night={night} />
      <Pole x={-4} z={2.7} lamp night={night} />
      <Pole x={8} z={2.7} night={night} />
      <Pole x={14} z={7} lamp night={night} />
      <Wire a={[-16, 6.6, 2.7]} b={[-4, 6.6, 2.7]} />
      <Wire a={[-4, 6.6, 2.7]} b={[8, 6.6, 2.7]} />
      <Wire a={[8, 6.6, 2.7]} b={[14, 6.6, 7]} />
      <Wire a={[-16, 6.4, 2.75]} b={[-4, 6.4, 2.75]} sag={0.7} />
      <Wire a={[-4, 6.4, 2.75]} b={[8, 6.4, 2.75]} sag={0.7} />
      <Wire a={[-4, 6.0, 2.6]} b={[-6.5, 3.4, -3.8]} sag={0.4} />
      <Wire a={[8, 6.0, 2.6]} b={[3, 5.8, -4.1]} sag={0.5} />

      {/* 화분과 생활 소품 */}
      <Planter x={-7.3} z={-2.5} />
      <Planter x={-4.7} z={-2.55} s={0.8} />
      <Planter x={-12.3} z={2.5} s={0.9} />
      <Planter x={9.2} z={2.5} />
      <Planter x={12} z={-6.6} s={1.2} />

      <Tree x={19.6} z={-5.2} />
      <Pyeongsang x={13.2} z={5.6} />
      <DistantApartments />

      <RubberBandField />
      {rain && <Rain />}
    </group>
  )
}
