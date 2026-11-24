// 혈관(반투명 튜브) + 흐르는 적혈구 + 판막.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS, type Quality } from '../lib/device';
import { makeVesselMaterial } from './materials';
import { flowMultiplier, sim } from './runtime';
import { curveData, o2At, o2Color, radiusAt, SEG, SEGMENTS, type SegmentDef, type SegmentId } from './world';

function buildTube(def: SegmentDef, tubular: number, radial: number) {
  const { curve } = curveData(def.id);
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    curve.getPointAt(u, c);
    const r = radiusAt(def, u);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeBoundingSphere();
  return geo;
}

function Vessel({ def, quality, highlight }: { def: SegmentDef; quality: Quality; highlight: boolean }) {
  const preset = QUALITY_PRESETS[quality];
  const { geo, mat } = useMemo(() => {
    const len = curveData(def.id).length;
    const tubular = Math.max(24, Math.round((preset.tubular * len) / 90));
    return {
      geo: buildTube(def, tubular, preset.radial),
      mat: makeVesselMaterial({ length: len, o2From: def.o2[0], o2To: def.o2[1], capillary: def.kind === 'capillary', chamber: def.kind === 'chamber' }),
    };
  }, [def, preset.tubular, preset.radial]);
  const flow = useRef(0);
  useFrame((_, dt) => {
    flow.current += dt * 3.2 * flowMultiplier();
    mat.uniforms.uTime.value = sim.time;
    mat.uniforms.uFlow.value = flow.current;
    mat.uniforms.uBeat.value = def.zone === 'heart' || def.kind === 'artery' ? sim.beat : sim.beat * 0.3;
    mat.uniforms.uHighlight.value = highlight ? 0.5 + 0.5 * Math.sin(sim.time * 5) : 0;
  });
  return <mesh geometry={geo} material={mat} renderOrder={2} />;
}

// 적혈구: 가운데가 오목한 원반 (Evans–Fung 모양)
function makeRbcGeometry() {
  const pts: THREE.Vector2[] = [];
  const h = (r: number) => 0.5 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.207 + 2.003 * r * r - 1.123 * r ** 4);
  const N = 14;
  for (let i = 0; i <= N; i++) { const r = (i / N) * 0.999; pts.push(new THREE.Vector2(r, h(r) + 0.02)); }
  for (let i = N; i >= 0; i--) { const r = (i / N) * 0.999; pts.push(new THREE.Vector2(r, -h(r) - 0.02)); }
  const g = new THREE.LatheGeometry(pts, 20);
  g.scale(0.42, 0.42, 0.42);
  g.computeVertexNormals();
  return g;
}

interface Cell { u: number; ang: number; rad: number; spin: number; speed: number; axis: THREE.Vector3 }

function BloodCells({ def, count }: { def: SegmentDef; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(makeRbcGeometry, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05, emissive: new THREE.Color('#3a0a1a'), emissiveIntensity: 0.6 }), []);
  const cells = useMemo<Cell[]>(
    () => Array.from({ length: count }, () => ({
      u: Math.random(), ang: Math.random() * Math.PI * 2, rad: Math.sqrt(Math.random()) * 0.8, spin: Math.random() * 6,
      speed: 0.8 + Math.random() * 0.5, axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    })),
    [count],
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), off: new THREE.Vector3(), c: new THREE.Color(), e: new THREE.Euler() }), []);
  const colorDirty = useRef(true);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1); // 탭 전환·첫 프레임의 긴 간격 방지
    const mesh = ref.current;
    if (!mesh) return;
    const { curve, length, frames, samples } = curveData(def.id);
    const flow = flowMultiplier();
    const varying = def.o2[0] !== def.o2[1];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      c.u += (dt * 4.2 * flow * c.speed) / length;
      c.u %= 1;
      c.spin += dt * c.speed * 1.5;
      curve.getPointAt(c.u, tmp.p);
      const k = Math.round(c.u * samples);
      const r = radiusAt(def, c.u) * c.rad;
      tmp.off.copy(frames.normals[k]).multiplyScalar(Math.cos(c.ang) * r).addScaledVector(frames.binormals[k], Math.sin(c.ang) * r);
      tmp.p.add(tmp.off);
      tmp.q.setFromAxisAngle(c.axis, c.spin);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      mesh.setMatrixAt(i, tmp.m);
      if (varying || colorDirty.current) mesh.setColorAt(i, o2Color(o2At(def, c.u), tmp.c));
    }
    colorDirty.current = false;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} renderOrder={1} />;
}

// 판막: 박동에 맞춰 한 방향으로만 열리는 세 장의 문
const VALVES: { seg: SegmentId; at: number; kind: 'av' | 'semilunar' }[] = [
  { seg: 'ra', at: 0.96, kind: 'av' },
  { seg: 'rv', at: 0.97, kind: 'semilunar' },
  { seg: 'la', at: 0.96, kind: 'av' },
  { seg: 'lv', at: 0.97, kind: 'semilunar' },
];

function Valve({ seg, at, kind }: (typeof VALVES)[number]) {
  const group = useRef<THREE.Group>(null);
  const leaves = useRef<(THREE.Group | null)[]>([]);
  const { position, quaternion, radius } = useMemo(() => {
    const d = curveData(seg);
    const p = d.curve.getPointAt(at);
    const t = d.curve.getTangentAt(at);
    return { position: p, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t), radius: radiusAt(SEG[seg], at) * 1.02 };
  }, [seg, at]);
  const leafGeo = useMemo(() => {
    // 테두리(경첩) 두 점 + 중심점으로 된 살짝 휜 삼각 잎
    const g = new THREE.BufferGeometry();
    const a0 = -Math.PI / 3, a1 = Math.PI / 3;
    const verts: number[] = [];
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps, t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      verts.push(0, 0, 0.15, Math.cos(t0) * radius, Math.sin(t0) * radius, 0, Math.cos(t1) * radius, Math.sin(t1) * radius, 0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [radius]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd9e6', transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: '#ff8fb3', emissiveIntensity: 0.25, depthWrite: false }), []);

  useFrame(() => {
    // 방실판막: 수축기에 닫힘 / 반월판막: 수축기에 열림
    const systole = sim.beat;
    const open = kind === 'av' ? 1 - systole : systole;
    leaves.current.forEach((l) => { if (l) l.rotation.y = open * 1.25; });
  });

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
          {/* 테두리에서 경첩처럼 회전 */}
          <group position={[radius, 0, 0]}>
            <group ref={(el) => { leaves.current[i] = el; }}>
              <mesh geometry={leafGeo} material={mat} position={[-radius, 0, 0]} />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

export function Circulation({ quality, highlight }: { quality: Quality; highlight: SegmentId | null }) {
  const preset = QUALITY_PRESETS[quality];
  return (
    <group>
      {SEGMENTS.map((def) => (
        <Vessel key={def.id} def={def} quality={quality} highlight={highlight === def.id} />
      ))}
      {SEGMENTS.map((def) => (
        <BloodCells key={`c-${def.id}`} def={def} count={Math.round(preset.cellsPerSeg * Math.min(2.2, Math.max(0.5, curveData(def.id).length / 45)))} />
      ))}
      {VALVES.map((v) => <Valve key={v.seg} {...v} />)}
    </group>
  );
}
