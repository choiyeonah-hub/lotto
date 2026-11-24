// 3D 장면 + 매 프레임 진행(탐사선 이동, 카메라, 미션 위치 확인).
import { Html, Sparkles } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS, type Quality } from '../lib/device';
import { useGame } from '../store/useGame';
import { Circulation } from './Circulation';
import { GasExchange, Heart, Lungs, Muscle } from './Organs';
import { cam, input, readInput, ship, sim, stepSim } from './runtime';
import { Ship } from './Ship';
import { curveData, frameAt, HEART_CENTER, LUNG_CENTER, MUSCLE_CENTER, radiusAt, SEG } from './world';

const MAX_SPEED = 9;
const DRIFT = 2.4; // 손을 떼면 혈류가 탐사선을 실어 나른다
const f = { pos: new THREE.Vector3(), tangent: new THREE.Vector3(), normal: new THREE.Vector3(), binormal: new THREE.Vector3() };
const right = new THREE.Vector3();
let backwardToastAt = -10;

function Director() {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    stepSim(dt);
    readInput();
    const g = useGame.getState();
    const canMove = g.phase === 'travel' && !(g.dialog?.blocking);

    // ── 속도 ──
    let target = 0;
    if (canMove) {
      if (input.throttle > 0.05) target = input.throttle * MAX_SPEED;
      else if (input.throttle < -0.05) target = input.throttle * 3; // 거슬러 가기는 느리다
      else if (sim.autoCruise) target = DRIFT;
    }
    ship.speed += (target - ship.speed) * Math.min(1, dt * 2.5);
    const flowBoost = canMove && ship.speed > 0 ? 0.6 + 0.4 * sim.beat : 1; // 박동에 맞춰 밀려 가는 느낌

    // ── 경로 위 위치 ──
    let { t } = ship;
    let len = curveData(ship.seg).length;
    t += (ship.speed * flowBoost * dt) / len;
    const block = g.gateBlocks(ship.seg);
    if (block !== null && t > block) { t = block; ship.speed = 0; }
    if (t >= 1) {
      const next = SEG[ship.seg].next;
      const nlen = curveData(next).length;
      t = ((t - 1) * len) / nlen;
      ship.seg = next;
      len = nlen;
    }
    if (t < 0) {
      t = 0;
      ship.speed = 0;
      if (canMove && sim.time - backwardToastAt > 6) {
        backwardToastAt = sim.time;
        g.say([{ text: '여기서는 더 뒤로 갈 수 없어! 혈액은 정해진 한 방향으로만 흘러.', mood: 'think' }]);
      }
    }
    ship.t = t;

    // ── 단면 안 좌우/상하 조종 ──
    if (canMove) {
      ship.ox = THREE.MathUtils.clamp(ship.ox + input.steerX * dt * 1.4, -0.6, 0.6);
      ship.oy = THREE.MathUtils.clamp(ship.oy + input.steerY * dt * 1.4, -0.6, 0.6);
    } else {
      ship.ox *= 1 - dt;
      ship.oy *= 1 - dt;
    }
    ship.bank += (-input.steerX * 0.5 * (canMove ? 1 : 0) - ship.bank) * Math.min(1, dt * 4);

    // ── 3D 위치: 평행 이동 기준(up)을 계속 끌고 가서 혈관 사이를 넘어가도 화면이 튀지 않게 ──
    frameAt(ship.seg, t, f);
    ship.forward.copy(f.tangent);
    ship.up.addScaledVector(ship.forward, -ship.up.dot(ship.forward));
    if (ship.up.lengthSq() < 1e-4) ship.up.copy(f.normal);
    ship.up.normalize();
    right.crossVectors(ship.forward, ship.up).normalize();
    const r = radiusAt(SEG[ship.seg], t);
    ship.pos.copy(f.pos).addScaledVector(right, ship.ox * r).addScaledVector(ship.up, ship.oy * r);

    g.onPosition(ship.seg, t);
  });
  return null;
}

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const camUp = new THREE.Vector3(0, 1, 0);
const smoothLook = new THREE.Vector3();

function CameraRig() {
  const { camera, size } = useThree();
  const first = useRef(true);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = 1 - Math.exp(-dt * (cam.mode === 'chase' ? 6 : 1.6));
    if (cam.mode === 'chase') {
      const portrait = size.width < size.height;
      const back = ship.forward.clone().multiplyScalar(portrait ? -7 : -5.2).addScaledVector(ship.up, portrait ? 1.9 : 1.5);
      back.applyAxisAngle(ship.up, cam.yaw);
      const side = new THREE.Vector3().crossVectors(ship.forward, ship.up).normalize();
      back.applyAxisAngle(side, cam.pitch);
      camPos.copy(ship.pos).add(back);
      camTarget.copy(ship.pos).addScaledVector(ship.forward, 3);
      camUp.lerp(ship.up, k).normalize();
      if (!cam.dragging) { cam.yaw *= 1 - dt * 0.8; cam.pitch *= 1 - dt * 0.8; }
    } else {
      // 관찰 모드: 대상 주위를 천천히 돈다
      const focus = cam.mode === 'heart' ? HEART_CENTER : cam.mode === 'lungs' ? ship.pos.clone().lerp(LUNG_CENTER, 0.3) : ship.pos.clone().lerp(MUSCLE_CENTER, 0.4);
      const dist = cam.mode === 'heart' ? 26 : 13;
      const a = sim.time * 0.18 + cam.yaw;
      camPos.set(focus.x + Math.sin(a) * dist, focus.y + 5 + cam.pitch * 10, focus.z + Math.cos(a) * dist);
      camTarget.copy(focus);
      camUp.lerp(new THREE.Vector3(0, 1, 0), k);
    }
    if (first.current) { camera.position.copy(camPos); smoothLook.copy(camTarget); first.current = false; }
    camera.position.lerp(camPos, k);
    smoothLook.lerp(camTarget, k);
    camera.up.copy(camUp);
    camera.lookAt(smoothLook);
    const pc = camera as THREE.PerspectiveCamera;
    const fov = 62 + Math.min(10, Math.max(0, ship.speed)) * 0.8 + ship.warp * 25;
    pc.fov += (fov - pc.fov) * k;
    pc.updateProjectionMatrix();
  });
  return null;
}

/** 갈림길 포털: 보기 A/B/C와 같은 색. 2번 이상 틀리면 정답 쪽 흐름을 강조한다. */
const PORTAL_COLORS = ['#4ff0ff', '#ffc04d', '#a6ff6b'];
function GatePortals() {
  const gate = useGame((s) => s.gate);
  const streak = useRef<THREE.InstancedMesh>(null);
  const placed = useMemo(() => {
    if (!gate) return null;
    const fr = frameAt(gate.def.segment, gate.def.at, { pos: new THREE.Vector3(), tangent: new THREE.Vector3(), normal: new THREE.Vector3(), binormal: new THREE.Vector3() });
    const up = ship.up.clone();
    const side = new THREE.Vector3().crossVectors(fr.tangent, up).normalize();
    return gate.def.options.map((o, i) => ({
      opt: o, color: PORTAL_COLORS[i], letter: 'ABC'[i],
      pos: fr.pos.clone().addScaledVector(fr.tangent, 3.2).addScaledVector(side, o.dir[0] * 2.6).addScaledVector(up, o.dir[1] * 2.2),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fr.tangent),
    }));
  }, [gate?.def.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame(() => {
    const mesh = streak.current;
    if (!mesh || !placed) return;
    const correct = placed.find((p) => p.opt.correct)!;
    for (let i = 0; i < 18; i++) {
      const u = (sim.time * 0.45 + i / 18) % 1;
      tmp.p.copy(ship.pos).lerp(correct.pos, u);
      tmp.s.setScalar(0.12 + 0.1 * Math.sin(u * Math.PI));
      tmp.m.compose(tmp.p, new THREE.Quaternion(), tmp.s);
      mesh.setMatrixAt(i, tmp.m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (!gate || !placed) return null;
  return (
    <group>
      {placed.map((p) => {
        const emph = gate.highlight && p.opt.correct;
        return (
          <group key={p.opt.id} position={p.pos} quaternion={p.quat}>
            <mesh scale={emph ? 1.25 + 0.1 * Math.sin(Date.now() / 150) : 1}>
              <torusGeometry args={[0.85, 0.09, 12, 48]} />
              <meshBasicMaterial color={p.color} transparent opacity={0.9} />
            </mesh>
            <mesh>
              <circleGeometry args={[0.8, 40]} />
              <meshBasicMaterial color={p.color} transparent opacity={emph ? 0.35 : 0.12} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <Html center distanceFactor={9} zIndexRange={[5, 0]}>
              <div className="portal-letter" style={{ borderColor: p.color, color: p.color }}>{p.letter}</div>
            </Html>
          </group>
        );
      })}
      {/* 적혈구 흐름 힌트: 첫 오답부터 표시 */}
      {gate.wrong > 0 && (
        <instancedMesh ref={streak} args={[undefined, undefined, 18]} frustumCulled={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#ff8fab" transparent opacity={0.9} />
        </instancedMesh>
      )}
    </group>
  );
}

function Atmosphere({ quality }: { quality: Quality }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#1a0b26');
    scene.fog = new THREE.FogExp2('#2a0e35', 0.0105);
  }, [scene]);
  const motes = QUALITY_PRESETS[quality].motes;
  return (
    <>
      <ambientLight intensity={0.55} color="#ffd6e6" />
      <hemisphereLight args={['#ffb0c8', '#2a1050', 0.8]} />
      <directionalLight position={[20, 40, 30]} intensity={0.9} color="#fff0f5" />
      <Sparkles count={motes} scale={[60, 140, 50]} position={[-5, -15, 0]} size={3} speed={0.3} opacity={0.5} color="#ffc6dd" />
      <pointLight position={[LUNG_CENTER.x, LUNG_CENTER.y + 8, LUNG_CENTER.z + 10]} intensity={60} distance={50} color="#a8e8ff" />
      <pointLight position={[MUSCLE_CENTER.x, MUSCLE_CENTER.y + 6, MUSCLE_CENTER.z + 12]} intensity={60} distance={45} color="#ffb18f" />
    </>
  );
}

/** 각 구간을 지날 때만 무거운 장기를 그리면 더 가볍지만, 첫 버전은 전체를 항상 그린다(장면이 작음). */
export function GameCanvas({ quality, onContextLost, onContextRestored }: { quality: Quality; onContextLost: () => void; onContextRestored: () => void }) {
  const preset = QUALITY_PRESETS[quality];
  const target = useGame((s) => s.objective.target);
  const phase = useGame((s) => s.phase);
  return (
    <Canvas
      dpr={preset.dpr}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
      camera={{ fov: 62, near: 0.1, far: 400, position: [0, -60, 10] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost(); });
        gl.domElement.addEventListener('webglcontextrestored', onContextRestored);
      }}
    >
      <Atmosphere quality={quality} />
      <Director />
      <CameraRig />
      <Circulation quality={quality} highlight={phase === 'travel' ? target : null} />
      <Heart />
      <Lungs quality={quality} />
      <Muscle />
      <GasExchange where="lung" count={quality === 'low' ? 60 : 160} />
      <GasExchange where="muscle" count={quality === 'low' ? 50 : 130} />
      <Ship />
      <GatePortals />
      {preset.bloom && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.75} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}

