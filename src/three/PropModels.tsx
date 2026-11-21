/** 소품 카탈로그의 절차적 3D 모델 (오리지널, 외부 에셋 없음). */
import { useMemo } from 'react'
import * as THREE from 'three'
import { flowerCloth, signText, wood } from './textures'

const M = (color: string, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

export function PropModel({ id, ghost = false }: { id: string; ghost?: boolean }) {
  const g = useMemo(() => (ghost ? new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }) : null), [ghost])
  const mat = (m: THREE.Material) => g ?? m
  switch (id) {
    case 'teddy':
      return (
        <group>
          <mesh position={[0, 0.17, 0]} material={mat(M('#8b5a2b', 0.95))} castShadow>
            <sphereGeometry args={[0.16, 16, 12]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} material={mat(M('#8b5a2b', 0.95))} castShadow>
            <sphereGeometry args={[0.12, 16, 12]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.09, 0.5, 0]} material={mat(M('#6e451f', 0.95))}>
              <sphereGeometry args={[0.045, 10, 8]} />
            </mesh>
          ))}
          <mesh position={[0, 0.38, 0.11]} material={mat(M('#d8b48a'))}>
            <sphereGeometry args={[0.05, 10, 8]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.15, 0.22, 0.03]} material={mat(M('#8b5a2b', 0.95))}>
              <sphereGeometry args={[0.06, 10, 8]} />
            </mesh>
          ))}
        </group>
      )
    case 'plant':
      return (
        <group>
          <mesh position={[0, 0.12, 0]} material={mat(M('#b5532f'))} castShadow>
            <cylinderGeometry args={[0.14, 0.1, 0.24, 14]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 0.07, 0.38 + (i % 2) * 0.08, Math.sin(i * 1.3) * 0.07]} rotation={[0.3 * Math.cos(i), i, 0.3]} material={mat(M('#3f7d3a', 0.8))} castShadow>
              <coneGeometry args={[0.06, 0.32, 6]} />
            </mesh>
          ))}
        </group>
      )
    case 'piggy':
      return (
        <group>
          <mesh position={[0, 0.14, 0]} scale={[1, 0.85, 1.3]} material={mat(M('#f2a0b4', 0.4))} castShadow>
            <sphereGeometry args={[0.12, 18, 14]} />
          </mesh>
          <mesh position={[0, 0.14, 0.17]} rotation={[Math.PI / 2, 0, 0]} material={mat(M('#e88aa0', 0.4))}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
          </mesh>
          <mesh position={[0, 0.245, 0]} material={mat(M('#5a2a35'))}>
            <boxGeometry args={[0.012, 0.01, 0.08]} />
          </mesh>
        </group>
      )
    case 'clock':
      return (
        <group>
          <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat(M('#c0392b', 0.4, 0.3))} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
          </mesh>
          <mesh position={[0, 0.14, 0.031]} material={mat(M('#fdf8ec'))}>
            <circleGeometry args={[0.085, 20]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.06, 0.25, 0]} material={mat(M('#d4af37', 0.3, 0.8))}>
              <sphereGeometry args={[0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          ))}
        </group>
      )
    case 'globe':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} material={mat(M('#4a3b2a'))}>
            <cylinderGeometry args={[0.08, 0.1, 0.06, 14]} />
          </mesh>
          <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0.4]} material={mat(M('#2f7fb5', 0.5))} castShadow>
            <sphereGeometry args={[0.14, 20, 16]} />
          </mesh>
          <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0.4]} material={mat(M('#c9a227', 0.3, 0.8))}>
            <torusGeometry args={[0.16, 0.008, 6, 24, Math.PI]} />
          </mesh>
        </group>
      )
    case 'lamp':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} material={mat(M('#2e5e4e', 0.4, 0.4))}>
            <cylinderGeometry args={[0.1, 0.11, 0.04, 16]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={mat(M('#2e5e4e', 0.4, 0.4))}>
            <cylinderGeometry args={[0.012, 0.012, 0.4]} />
          </mesh>
          <mesh position={[0, 0.44, 0.05]} rotation={[0.6, 0, 0]} material={mat(M('#2e5e4e', 0.4, 0.4))} castShadow>
            <coneGeometry args={[0.1, 0.14, 16, 1, true]} />
          </mesh>
        </group>
      )
    case 'pencilcase':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} material={mat(new THREE.MeshStandardMaterial({ map: signText('ABC', '#3fa7d6', '#ffe66d', 256, 64), roughness: 0.4, metalness: 0.4 }))} castShadow>
            <boxGeometry args={[0.24, 0.05, 0.09]} />
          </mesh>
        </group>
      )
    case 'cushion':
      return (
        <mesh position={[0, 0.04, 0]} material={mat(new THREE.MeshStandardMaterial({ map: flowerCloth(), roughness: 0.95 }))} castShadow receiveShadow>
          <boxGeometry args={[0.55, 0.08, 0.55]} />
        </mesh>
      )
    case 'frame':
      return (
        <group>
          <mesh position={[0, 0.13, 0]} rotation={[-0.2, 0, 0]} material={mat(new THREE.MeshStandardMaterial({ map: wood('#6b4423') }))} castShadow>
            <boxGeometry args={[0.2, 0.25, 0.03]} />
          </mesh>
          <mesh position={[0, 0.135, 0.018]} rotation={[-0.2, 0, 0]} material={mat(M('#e8d9b8'))}>
            <planeGeometry args={[0.15, 0.19]} />
          </mesh>
        </group>
      )
    case 'calendar':
      return (
        <mesh position={[0, 0.09, 0]} rotation={[0, 0, 0]} material={mat(new THREE.MeshStandardMaterial({ map: signText('1998', '#ffffff', '#c0392b', 256, 128) }))} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.18, 3, 1, false, 0, Math.PI * 2]} />
        </mesh>
      )
    default:
      return (
        <mesh position={[0, 0.1, 0]} material={mat(M('#999'))}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
        </mesh>
      )
  }
}

/** 고무줄 상자: 말과 기억을 담아두는 상자 (방 책상 위에 고정) */
export function RubberBandBox({ glow }: { glow: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.26, 0.12, 0.18]} />
        <meshStandardMaterial color="#c8a46a" roughness={0.8} emissive={glow ? '#ffb347' : '#000'} emissiveIntensity={glow ? 0.35 : 0} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.27, 0.02, 0.19]} />
        <meshStandardMaterial color="#b28a52" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.008, 8, 24]} />
        <meshStandardMaterial color="#f2c230" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.06, 0.091]}>
        <planeGeometry args={[0.2, 0.06]} />
        <meshStandardMaterial map={signText('고무줄 상자', '#f6eedc', '#6b4423', 256, 72)} />
      </mesh>
    </group>
  )
}
