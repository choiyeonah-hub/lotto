/**
 * CameraController — 3인칭 추적 + 마우스/터치 드래그 오빗 + 휠 줌 + 벽 오클루전 처리.
 * userData.occluder 가 true인 메시에 시야가 가리면 카메라를 캐릭터 쪽으로 당긴다.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../state/runtime'

function attached(o: THREE.Object3D, root: THREE.Object3D) {
  while (o.parent) o = o.parent
  return o === root
}

export function CameraController({ title = false, minDist = 2.2, maxDist = 7 }: { title?: boolean; minDist?: number; maxDist?: number }) {
  const { camera, gl, scene } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const occluders = useRef<THREE.Object3D[]>([])
  const look = useMemo(() => new THREE.Vector3(), [])
  const want = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const el = gl.domElement
    let drag: { id: number; x: number; y: number } | null = null
    const down = (e: PointerEvent) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return
      const c = runtime.camera
      c.yaw -= (e.clientX - drag.x) * 0.006
      c.pitch = THREE.MathUtils.clamp(c.pitch + (e.clientY - drag.y) * 0.004, 0.05, 1.25)
      drag.x = e.clientX
      drag.y = e.clientY
    }
    const up = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) drag = null
    }
    const wheel = (e: WheelEvent) => {
      runtime.camera.dist = THREE.MathUtils.clamp(runtime.camera.dist + e.deltaY * 0.003, minDist, maxDist)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl, minDist, maxDist])

  useFrame((state, rawDt) => {
    runtime.cam = camera
    runtime.render.calls = gl.info.render.calls
    runtime.render.triangles = gl.info.render.triangles
    const dt = Math.min(rawDt, 0.1)
    if (title) {
      // 골목을 따라 천천히 걸어가는 시점
      const x = -12 + ((state.clock.elapsedTime * 0.6) % 22)
      camera.position.set(x, 2.1, 1.9)
      camera.lookAt(x + 7, 1.5, -0.6)
      return
    }
    // 씬이 바뀌면(골목↔방) 이전 씬의 가림막은 씬 그래프에서 떨어져 나가므로 즉시 다시 모은다
    if (occluders.current.length === 0 || runtime.frame % 30 === 0 || !attached(occluders.current[0], scene)) {
      const list: THREE.Object3D[] = []
      scene.traverse((o) => o.userData.occluder && list.push(o))
      occluders.current = list
    }
    const p = runtime.player
    const c = runtime.camera
    c.dist = THREE.MathUtils.clamp(c.dist, minDist, maxDist)
    look.set(p.x, p.y * 0.6 + 1.0, p.z)
    dir.set(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch))
    let d = c.dist
    ray.set(look, dir)
    ray.far = d
    const hit = ray.intersectObjects(occluders.current, false)[0]
    if (hit) d = Math.max(0.6, hit.distance - 0.25)
    want.copy(look).addScaledVector(dir, d)
    camera.position.lerp(want, hit ? 1 : 1 - Math.exp(-dt * 10))
    camera.lookAt(look)
  })
  return null
}
