// 박동하는 심장, 숨쉬는 폐(허파꽈리), 달리면 수축하는 근육, 기체 교환 입자.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS, type Quality } from '../lib/device';
import { makeGasMaterial, makeOrganicMaterial } from './materials';
import { sim } from './runtime';
import { curveData, HEART_CENTER, LUNG_CENTER, MUSCLE_CENTER, SEG, type SegmentId } from './world';

// 시드 고정 난수 (매번 같은 모양)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function heartGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const bump = (q: THREE.Vector3, c: [number, number, number], s: number, a: number) => a * Math.exp(-q.distanceToSquared(new THREE.Vector3(...c)) / (s * s));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const q = v.clone();
    let y = v.y * 1.2;
    let x = v.x, z = v.z * 0.85;
    if (y < 0) {
      const k = 1 + y * 0.42; // 아래로 갈수록 좁아지는 심첨
      x *= k; z *= k;
      x += -y * 0.28; // 심첨이 몸 왼쪽(화면 오른쪽)으로 기울어짐
    }
    // 위쪽 두 심방 부풂 + 심실 사이 홈
    const r = 1 + bump(q, [-0.55, 0.7, 0.2], 0.45, 0.18) + bump(q, [0.6, 0.65, 0.1], 0.45, 0.15) - bump(q, [0.15, -0.1, 0.95], 0.18, 0.06);
    v.set(x * r, y * r, z * r);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.scale(8.2, 7.6, 7);
  return g;
}

export function Heart() {
  const geo = useMemo(heartGeometry, []);
  const outer = useMemo(() => makeOrganicMaterial({ color: '#d8395f', rim: '#ffb3c8', opacity: 0.42, noiseAmp: 0.05, side: THREE.DoubleSide }), []);
  const inner = useMemo(() => makeOrganicMaterial({ color: '#7a1a3a', rim: '#ff6f91', opacity: 0.25, noiseAmp: 0.08, side: THREE.BackSide }), []);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    const inside = camera.position.distanceTo(HEART_CENTER) < 8.5;
    outer.uniforms.uOpacity.value += ((inside ? 0.12 : 0.42) - outer.uniforms.uOpacity.value) * 0.1;
    inner.uniforms.uOpacity.value = inside ? 0.06 : 0.25;
    for (const m of [outer, inner]) {
      m.uniforms.uTime.value = sim.time;
      m.uniforms.uPulse.value = sim.beat * 0.07;
      m.uniforms.uGlow.value = sim.beat * 0.6 + sim.alarm * (0.5 + 0.5 * Math.sin(sim.time * 10));
    }
    if (light.current) light.current.intensity = 40 + sim.beat * 120 + sim.alarm * 80;
  });
  return (
    <group position={HEART_CENTER}>
      <mesh geometry={geo} material={outer} renderOrder={3} />
      <mesh geometry={geo} material={inner} scale={0.96} renderOrder={0} />
      <pointLight ref={light} color="#ff5a7a" distance={45} decay={1.6} />
    </group>
  );
}

function pointsAround(seg: SegmentId, n: number, min: number, max: number, seed: number) {
  const r = rng(seed);
  const { curve } = curveData(seg);
  const out: THREE.Vector3[] = [];
  const dir = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const c = curve.getPointAt(0.05 + r() * 0.9);
    dir.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    out.push(c.addScaledVector(dir, min + r() * (max - min)));
  }
  return out;
}

export function Lungs({ quality }: { quality: Quality }) {
  const n = QUALITY_PRESETS[quality].alveoli;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 3), []);
  const mat = useMemo(() => makeOrganicMaterial({ color: '#f07aa0', rim: '#ffe0ec', opacity: 0.5, noiseAmp: 0.12 }), []);
  const lobeMat = useMemo(() => makeOrganicMaterial({ color: '#c24d7a', rim: '#ffc6dc', opacity: 0.12, noiseAmp: 0.15, side: THREE.DoubleSide }), []);
  const alveoli = useMemo(() => {
    const r = rng(7);
    return pointsAround('lung_cap', n, 2.6, 6.5, 11).map((p) => ({ p, s: 1.3 + r() * 1.9 }));
  }, [n]);
  const lobeGeo = useMemo(() => new THREE.SphereGeometry(16, 48, 32), []);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const breath = 1 + 0.09 * Math.sin(sim.breathPhase * Math.PI * 2);
    for (const m of [mat, lobeMat]) { m.uniforms.uTime.value = sim.time; m.uniforms.uGlow.value = sim.exchangeBoost * 0.3; }
    const mesh = ref.current;
    if (!mesh) return;
    alveoli.forEach((a, i) => {
      sc.setScalar(a.s * breath);
      m4.compose(a.p, q, sc);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={ref} args={[geo, mat, alveoli.length]} frustumCulled={false} renderOrder={3} />
      <mesh geometry={lobeGeo} material={lobeMat} position={LUNG_CENTER} scale={[0.9, 1.25, 0.8]} renderOrder={4} />
      <Bronchi />
    </group>
  );
}

function Bronchi() {
  const { geo, mat } = useMemo(() => {
    const r = rng(3);
    const root = new THREE.Vector3(LUNG_CENTER.x + 8, LUNG_CENTER.y + 22, LUNG_CENTER.z);
    const fork = new THREE.Vector3(LUNG_CENTER.x + 3, LUNG_CENTER.y + 9, LUNG_CENTER.z);
    const geos: THREE.BufferGeometry[] = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3([root, fork]), 16, 1.1, 10)];
    for (let i = 0; i < 6; i++) {
      const end = new THREE.Vector3(LUNG_CENTER.x + (r() - 0.5) * 16, LUNG_CENTER.y + (r() - 0.6) * 14, LUNG_CENTER.z + (r() - 0.5) * 10);
      const mid = fork.clone().lerp(end, 0.5).add(new THREE.Vector3((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([fork, mid, end]), 20, 0.45, 8));
    }
    return { geo: geos, mat: makeOrganicMaterial({ color: '#f3c6d6', rim: '#ffffff', opacity: 0.25, noiseAmp: 0.04, side: THREE.DoubleSide }) };
  }, []);
  return <group>{geo.map((g, i) => <mesh key={i} geometry={g} material={mat} />)}</group>;
}

export function Muscle() {
  const fibers = useMemo(() => {
    const r = rng(21);
    const { curve } = curveData('body_cap');
    const pts = curve.getSpacedPoints(40);
    const out: { p: THREE.Vector3; s: number; rot: THREE.Euler }[] = [];
    let guard = 0;
    while (out.length < 34 && guard++ < 500) {
      const p = new THREE.Vector3(MUSCLE_CENTER.x + (r() - 0.5) * 26, MUSCLE_CENTER.y + (r() - 0.5) * 6, MUSCLE_CENTER.z + (r() - 0.5) * 18);
      if (pts.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 3.2)) continue; // 혈관 길은 비워 둔다
      out.push({ p, s: 0.9 + r() * 0.9, rot: new THREE.Euler((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.25) });
    }
    return out;
  }, []);
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 36, 20, 40), []);
  const mat = useMemo(() => makeOrganicMaterial({ color: '#c8324f', rim: '#ff9fb0', opacity: 0.45, noiseAmp: 0.08, striation: 6 }), []);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    mat.uniforms.uTime.value = sim.time;
    mat.uniforms.uGlow.value = sim.muscleBoost * (0.3 + 0.3 * Math.sin(sim.time * 8));
    const stride = sim.running ? Math.sin(sim.time * 9) : 0;
    group.current?.children.forEach((c, i) => {
      const k = 1 + 0.12 * stride * (i % 2 ? 1 : -1);
      c.scale.set(fibers[i].s * k, 1 / k, fibers[i].s * k);
    });
  });
  return (
    <group ref={group}>
      {fibers.map((f, i) => (
        <mesh key={i} geometry={geo} material={mat} position={f.p} rotation={f.rot} renderOrder={3} />
      ))}
    </group>
  );
}

/** 기체 교환: 폐에서는 O2가 혈관으로, CO2가 밖으로 / 근육에서는 반대 */
export function GasExchange({ where, count }: { where: 'lung' | 'muscle'; count: number }) {
  const { geo, mat } = useMemo(() => {
    const seg: SegmentId = where === 'lung' ? 'lung_cap' : 'body_cap';
    const r = rng(where === 'lung' ? 5 : 9);
    const { curve } = curveData(seg);
    const from: number[] = [], to: number[] = [], seed: number[] = [], kind: number[] = [], pos: number[] = [];
    for (let i = 0; i < count; i++) {
      const u = 0.25 + r() * 0.5; // 교환이 일어나는 가운데 구간
      const inVessel = curve.getPointAt(u);
      const out = inVessel.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(SEG[seg].radius + 2 + r() * 3));
      const isCO2 = r() < 0.45;
      // 폐: O2 밖→안, CO2 안→밖 / 근육: O2 안→밖, CO2 밖→안
      const intoVessel = where === 'lung' ? !isCO2 : isCO2;
      const a = intoVessel ? out : inVessel, b = intoVessel ? inVessel : out;
      from.push(a.x, a.y, a.z); to.push(b.x, b.y, b.z); pos.push(a.x, a.y, a.z);
      seed.push(r()); kind.push(isCO2 ? 1 : 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aFrom', new THREE.Float32BufferAttribute(from, 3));
    g.setAttribute('aTo', new THREE.Float32BufferAttribute(to, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
    g.boundingSphere = new THREE.Sphere(curve.getPointAt(0.5), 40);
    return { geo: g, mat: makeGasMaterial() };
  }, [where, count]);
  useFrame(({ gl }) => {
    mat.uniforms.uTime.value = sim.time;
    mat.uniforms.uPixel.value = gl.getPixelRatio() * (gl.domElement.height / gl.getPixelRatio()) / 900;
    mat.uniforms.uBoost.value = where === 'lung' ? 0.35 + sim.exchangeBoost * 0.65 : 0.25 + sim.muscleBoost * 0.75;
  });
  return <points geometry={geo} material={mat} renderOrder={5} />;
}
