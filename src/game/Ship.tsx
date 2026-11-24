// 탐사선 '나노-1' (독자 디자인): 매끈한 캡슐 동체 + 투명 조종석 + 양쪽 추진 포드.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ship, sim } from './runtime';

export function Ship() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const hullGeo = useMemo(() => {
    const pts = [
      [0, -0.75], [0.16, -0.72], [0.3, -0.55], [0.36, -0.2], [0.34, 0.2], [0.26, 0.55], [0.12, 0.85], [0, 0.95],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 32);
    g.rotateX(Math.PI / 2); // 앞쪽 = +z
    return g;
  }, []);
  const hullMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9f2ff', metalness: 0.55, roughness: 0.25, emissive: '#1b2a4a', emissiveIntensity: 0.4 }), []);
  const trimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffb547', metalness: 0.4, roughness: 0.35, emissive: '#ff8a00', emissiveIntensity: 0.35 }), []);
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#7ff3ff', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0, emissive: '#1fd8ff', emissiveIntensity: 0.6 }), []);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    g.position.copy(ship.pos);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), ship.forward.clone().negate(), ship.up);
    g.quaternion.setFromRotationMatrix(m);
    if (body.current) {
      body.current.rotation.z = ship.bank;
      // 부딪힘 반동 + 미세한 부유
      body.current.position.set(Math.sin(sim.time * 40) * ship.bump * 0.15, Math.sin(sim.time * 1.7) * 0.05, -ship.bump * 0.4);
      const s = 1 - ship.warp * 0.6;
      body.current.scale.setScalar(Math.max(0.2, s));
    }
    if (glow.current) glow.current.opacity = 0.5 + 0.4 * Math.min(1, Math.abs(ship.speed) / 6) + 0.1 * Math.sin(sim.time * 20);
    ship.bump = Math.max(0, ship.bump - dt * 1.5);
    ship.warp = Math.max(0, ship.warp - dt * 0.8);
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh geometry={hullGeo} material={hullMat} />
        <mesh material={glassMat} position={[0, 0.2, 0.25]} scale={[0.22, 0.17, 0.36]}>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.55, -0.05, -0.15]}>
            <mesh material={hullMat} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.13, 0.55, 6, 16]} />
            </mesh>
            <mesh material={trimMat} position={[-s * 0.26, 0, 0.05]} rotation={[0, 0, Math.PI / 2]} scale={[0.04, 0.5, 0.22]}>
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
            <mesh position={[0, 0, -0.42]}>
              <torusGeometry args={[0.13, 0.035, 8, 24]} />
              <meshBasicMaterial color="#5ff7ff" />
            </mesh>
          </group>
        ))}
        <mesh material={trimMat} position={[0, 0.3, -0.45]} scale={[0.03, 0.28, 0.3]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* 추진 불꽃 */}
        <mesh position={[0, 0, -0.85]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 0.6, 16, 1, true]} />
          <meshBasicMaterial ref={glow} color="#7cf6ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#9ff6ff" intensity={6} distance={9} position={[0, 0.2, 1.2]} />
      </group>
    </group>
  );
}
