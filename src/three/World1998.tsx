/**
 * World1998 — 3D 캔버스, 시간대별 하늘·조명·안개, 씬 전환(골목 ↔ 방), 상호작용 구역.
 */
import { PerformanceMonitor, Sky, Stars } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clearInput } from '../state/input'
import { runtime } from '../state/runtime'
import { useStore } from '../state/store'
import { ALLEY_BOUNDS, ALLEY_COLLIDERS, ALLEY_ZONES, Alley, SPAWN } from './Alley'
import { CameraController } from './CameraController'
import { Player } from './PlayerController'
import { ROOM_BOUNDS, ROOM_SPAWN, ROOM_ZONES, Room, roomColliders } from './Room'

const SUN = {
  sunset: { pos: [-60, 9, -25] as THREE.Vector3Tuple, color: '#ffb36b', intensity: 2.3, hemi: ['#ffd7b0', '#5b4a3a', 0.75], fog: '#e7b48f' },
  day: { pos: [-30, 60, 20] as THREE.Vector3Tuple, color: '#fff6e5', intensity: 2.8, hemi: ['#cfe6ff', '#6b5d4b', 0.9], fog: '#c9dbe8' },
  night: { pos: [30, 40, -20] as THREE.Vector3Tuple, color: '#9fb4e6', intensity: 0.9, hemi: ['#4a5c94', '#1e1a18', 1.0], fog: '#0d1424' },
} as const

function Lighting() {
  const time = useStore((s) => s.settings.time)
  const rain = useStore((s) => s.settings.rain)
  const scene = useStore((s) => s.scene)
  const high = useStore((s) => s.settings.quality === 'high')
  const sun = SUN[time]
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const l = light.current
    if (!l) return
    const p = runtime.player
    const d = new THREE.Vector3(...sun.pos).normalize().multiplyScalar(25)
    l.position.set(p.x + d.x, d.y, p.z + d.z)
    target.position.set(p.x, 0, p.z)
    l.target = target
    target.updateMatrixWorld()
  })
  const indoor = scene === 'room'
  return (
    <>
      {time === 'night' ? (
        <>
          <color attach="background" args={['#0b1222']} />
          <Stars radius={90} depth={30} count={1500} factor={3} fade />
        </>
      ) : (
        <Sky sunPosition={sun.pos} turbidity={rain ? 12 : time === 'sunset' ? 6 : 3} rayleigh={time === 'sunset' ? 2.6 : 1.2} mieCoefficient={0.006} mieDirectionalG={0.85} />
      )}
      <fog attach="fog" args={[rain ? '#8a8f96' : sun.fog, indoor ? 20 : 18, indoor ? 60 : 75]} />
      <hemisphereLight args={[sun.hemi[0], sun.hemi[1], (sun.hemi[2] as number) * (rain ? 0.8 : 1) * (indoor ? 0.6 : 1)]} />
      {!indoor && (
        <directionalLight
          ref={light}
          color={sun.color}
          intensity={sun.intensity * (rain ? 0.45 : 1)}
          castShadow={high}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
          shadow-camera-far={70}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
        />
      )}
    </>
  )
}

/** 가까운 상호작용 지점을 찾아 화면에 안내하고, E/버튼 입력을 실제 동작으로 연결한다. */
function useInteract() {
  return () => {
    const s = useStore.getState()
    const n = s.nearby
    if (!n || s.dialogue) return
    switch (n.id) {
      case 'home':
        return s.go('room')
      case 'shop':
        return s.say('희망문방구: 아직 문을 열 준비 중이에요 (다음 업데이트). 지금은 방에서 소품을 골라 꾸밀 수 있어요.')
      case 'band':
        if (!s.band) {
          s.startBand()
          s.say('친구들: 같이 할래? 우리가 줄 잡아줄게!')
        }
        return
      case 'door':
        return s.go('alley', 'fromRoom')
      case 'box':
        return s.openPanel('memoryBox')
      case 'radio':
        return s.openPanel('music')
    }
  }
}

function Zones() {
  const scene = useStore((s) => s.scene)
  useFrame(() => {
    const st = useStore.getState()
    const zones = scene === 'room' ? ROOM_ZONES : scene === 'alley' ? ALLEY_ZONES : []
    const p = runtime.player
    let best: (typeof zones)[number] | null = null
    let bd = Infinity
    for (const z of zones) {
      if (z.id === 'band' && st.band) continue
      const d = Math.hypot(p.x - z.x, p.z - z.z)
      if (d < z.r && d < bd) {
        bd = d
        best = z
      }
    }
    st.setNearby(best ? { id: best.id, label: best.label } : null)
  })
  return null
}

function SceneContent() {
  const scene = useStore((s) => s.scene)
  const spawn = useStore((s) => s.spawn)
  const interact = useInteract()

  useLayoutEffect(() => {
    clearInput()
    const p = runtime.player
    const sp = scene === 'room' ? ROOM_SPAWN : SPAWN[spawn]
    Object.assign(p, { x: sp.x, y: 0, z: sp.z, yaw: sp.yaw, vy: 0, grounded: true, action: null, hooked: false, sitting: false, speed: 0 })
    runtime.hook = null
    runtime.camera.yaw = sp.yaw
    runtime.camera.pitch = scene === 'room' ? 0.72 : 0.38
    runtime.camera.dist = scene === 'room' ? 2.4 : 4.2
    runtime.bounds = scene === 'room' ? ROOM_BOUNDS : ALLEY_BOUNDS
    runtime.colliders = scene === 'room' ? roomColliders(useStore.getState().room) : ALLEY_COLLIDERS
  }, [scene, spawn])

  return (
    <>
      <Lighting />
      <Zones />
      {scene === 'room' ? (
        <>
          <Room />
          <Player onInteract={interact} />
          <CameraController minDist={1.3} maxDist={3.4} />
        </>
      ) : (
        <>
          <Alley />
          {scene === 'alley' && <Player onInteract={interact} />}
          <CameraController title={scene === 'title'} />
        </>
      )}
    </>
  )
}

export function World1998() {
  const quality = useStore((s) => s.settings.quality)
  const high = quality === 'high'
  return (
    <Canvas
      key={quality}
      shadows={high ? 'soft' : false}
      dpr={high ? [1, 2] : 1}
      camera={{ fov: 55, near: 0.05, far: 250, position: [0, 3, 6] }}
      gl={{ antialias: high, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
    >
      <PerformanceMonitor
        onDecline={() => {
          const s = useStore.getState()
          if (s.settings.quality === 'high') s.say('화면이 조금 버벅이면 설정에서 ‘가벼운 화질’을 골라보세요.')
        }}
      />
      <SceneContent />
    </Canvas>
  )
}
