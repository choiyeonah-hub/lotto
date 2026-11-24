// 탐험 세계의 '혈관 길' 정의. 3D 곡선과 2D 지도 경로가 같은 구간 ID를 공유해 위치가 동기화된다.
// 정확한 순환 경로: 좌심실 → 대동맥 → 온몸 → 대정맥 → 우심방 → 우심실 → 폐동맥 → 폐 → 폐정맥 → 좌심방 → 좌심실
import * as THREE from 'three';

export type SegmentId = 'vena_cava' | 'ra' | 'rv' | 'pulm_artery' | 'lung_cap' | 'pulm_vein' | 'la' | 'lv' | 'aorta' | 'body_cap';
export type VesselKind = 'vein' | 'artery' | 'chamber' | 'capillary';

export interface SegmentDef {
  id: SegmentId;
  name: string;
  kind: VesselKind;
  kindLabel: string;
  zone: 'body' | 'heart' | 'lung';
  /** 0 = 산소 적음, 1 = 산소 많음 (구간 시작 → 끝) */
  o2: [number, number];
  radius: number;
  /** 심방·심실처럼 가운데가 부푼 정도 */
  bulge?: number;
  points: [number, number, number][];
  next: SegmentId;
  /** 지도(SVG, viewBox 0 0 160 260) 경로 */
  map: string;
}

export const SEGMENTS: SegmentDef[] = [
  {
    id: 'vena_cava', name: '대정맥', kind: 'vein', kindLabel: '정맥 · 심장으로 들어가는 혈관', zone: 'body', o2: [0, 0], radius: 2.6,
    points: [[-6, -70, 2], [-7.5, -52, 4], [-7, -34, 2.5], [-6, -18, 1], [-5.5, -8, 0.8], [-5, -2, 1]],
    next: 'ra', map: 'M70,214 C64,180 70,140 73,118 C74,108 76,100 77,95',
  },
  {
    id: 'ra', name: '우심방', kind: 'chamber', kindLabel: '심장 · 오른쪽 위 방', zone: 'heart', o2: [0, 0], radius: 2.4, bulge: 1.5,
    points: [[-5, -2, 1], [-6.2, 1.5, 1.4], [-5.5, 4.2, 1.5], [-4, 4.6, 1.6]],
    next: 'rv', map: 'M77,95 C73,96 73,101 76,103',
  },
  {
    id: 'rv', name: '우심실', kind: 'chamber', kindLabel: '심장 · 오른쪽 아래 방', zone: 'heart', o2: [0, 0], radius: 2.4, bulge: 1.6,
    points: [[-4, 4.6, 1.6], [-5.4, 0.5, 2.2], [-4, -4, 2.6], [-1.2, -5.4, 2.8]],
    next: 'pulm_artery', map: 'M76,103 C77,108 81,110 84,107 C86,104 85,100 84,97',
  },
  {
    id: 'pulm_artery', name: '폐동맥', kind: 'artery', kindLabel: '동맥 · 심장에서 나가는 혈관 (산소 적은 혈액!)', zone: 'heart', o2: [0, 0], radius: 2.3,
    points: [[-1.2, -5.4, 2.8], [0.2, -1, 4.2], [0.6, 5, 3.5], [-2.5, 10, 2], [-10, 17, -1], [-18, 22.5, -3.5], [-22, 25, -4.5]],
    next: 'lung_cap', map: 'M84,97 C84,86 74,80 62,85',
  },
  {
    id: 'lung_cap', name: '폐 모세혈관', kind: 'capillary', kindLabel: '모세혈관 · 폐에서 기체 교환', zone: 'lung', o2: [0, 1], radius: 1.7,
    points: [[-22, 25, -4.5], [-27, 29, -6], [-31, 34, -3], [-29, 39.5, 1.5], [-23, 41, 4], [-17, 38, 4.5]],
    next: 'pulm_vein', map: 'M62,85 C52,86 49,98 55,103 C61,107 67,99 64,92',
  },
  {
    id: 'pulm_vein', name: '폐정맥', kind: 'vein', kindLabel: '정맥 · 심장으로 들어가는 혈관 (산소 많은 혈액!)', zone: 'lung', o2: [1, 1], radius: 2.3,
    points: [[-17, 38, 4.5], [-9, 28, 4], [0, 18, 2.5], [5, 10, 0.5], [6, 5.5, 0]],
    next: 'la', map: 'M64,92 C72,84 87,82 93,92',
  },
  {
    id: 'la', name: '좌심방', kind: 'chamber', kindLabel: '심장 · 왼쪽 위 방', zone: 'heart', o2: [1, 1], radius: 2.4, bulge: 1.5,
    points: [[6, 5.5, 0], [7.3, 3, 0.2], [6.6, 0.5, 0.5], [5.5, -0.5, 0.8]],
    next: 'lv', map: 'M93,92 C97,95 96,100 93,103',
  },
  {
    id: 'lv', name: '좌심실', kind: 'chamber', kindLabel: '심장 · 왼쪽 아래 방 (가장 두꺼운 근육)', zone: 'heart', o2: [1, 1], radius: 2.5, bulge: 1.8,
    points: [[5.5, -0.5, 0.8], [5.2, -4.2, 1.2], [2.8, -6, 1.6], [1.2, -3, 1.8]],
    next: 'aorta', map: 'M93,103 C92,109 87,109 86,104 C85,100 87,96 88,92',
  },
  {
    id: 'aorta', name: '대동맥', kind: 'artery', kindLabel: '동맥 · 심장에서 나가는 혈관', zone: 'body', o2: [1, 1], radius: 2.8,
    points: [[1.2, -3, 1.8], [1.4, 3, 1.5], [2.5, 9, 0], [6, 11, -2], [8.5, 7, -4], [8, -8, -4], [6, -30, -3], [4, -50, -1.5], [2, -66, 0]],
    next: 'body_cap', map: 'M88,92 C88,76 100,76 99,92 C98,130 94,170 78,205',
  },
  {
    id: 'body_cap', name: '근육 모세혈관', kind: 'capillary', kindLabel: '모세혈관 · 근육에 산소 배달', zone: 'body', o2: [1, 0], radius: 1.7,
    points: [[2, -66, 0], [0.5, -74, 2.5], [-3, -78.5, 4], [-7, -76, 3.5], [-7.5, -71, 2.5], [-6, -70, 2]],
    next: 'vena_cava', map: 'M78,205 C80,214 76,224 70,224 C64,223 64,216 70,214',
  },
];

export const SEG: Record<SegmentId, SegmentDef> = Object.fromEntries(SEGMENTS.map((s) => [s.id, s])) as Record<SegmentId, SegmentDef>;

export const HEART_CENTER = new THREE.Vector3(0, -0.5, 1.4);
export const LUNG_CENTER = new THREE.Vector3(-25, 33, -1);
export const MUSCLE_CENTER = new THREE.Vector3(-2.5, -73, 2.5);

// ── 곡선 + 프레임(평행 이동 프레임) 캐시 ──
interface CurveData { curve: THREE.CatmullRomCurve3; length: number; frames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] }; samples: number }
const cache = new Map<SegmentId, CurveData>();

export function curveData(id: SegmentId): CurveData {
  let d = cache.get(id);
  if (!d) {
    const curve = new THREE.CatmullRomCurve3(SEG[id].points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const samples = 200;
    d = { curve, length: curve.getLength(), frames: curve.computeFrenetFrames(samples, false), samples };
    cache.set(id, d);
  }
  return d;
}

/** 구간 안의 위치 t(0~1, 길이 기준)의 점과 프레임 */
export function frameAt(id: SegmentId, t: number, out: { pos: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3; binormal: THREE.Vector3 }) {
  const d = curveData(id);
  const tt = THREE.MathUtils.clamp(t, 0, 1);
  d.curve.getPointAt(tt, out.pos);
  d.curve.getTangentAt(tt, out.tangent);
  const i = Math.round(tt * d.samples);
  out.normal.copy(d.frames.normals[i]);
  out.binormal.copy(d.frames.binormals[i]);
  return out;
}

/** 구간 길이 방향 반지름(심방·심실은 가운데가 부푼다) */
export function radiusAt(def: SegmentDef, t: number): number {
  const b = def.bulge ?? 0;
  const taper = Math.min(1, t * 6, (1 - t) * 6); // 양 끝은 이웃 혈관과 맞닿게
  return def.radius * (1 + b * Math.sin(Math.PI * t) * taper);
}

export function o2At(def: SegmentDef, t: number): number {
  // 모세혈관에서는 가운데쯤에서 빠르게 바뀐다 (기체 교환 구간)
  const k = def.kind === 'capillary' ? THREE.MathUtils.smoothstep(t, 0.3, 0.7) : t;
  return THREE.MathUtils.lerp(def.o2[0], def.o2[1], k);
}

const LOW = new THREE.Color('#6d6cf0');
const HIGH = new THREE.Color('#ff3d5e');
export function o2Color(o2: number, out = new THREE.Color()): THREE.Color {
  return out.copy(LOW).lerp(HIGH, o2);
}

// ── 미션 1 갈림길 ──
export interface GateOption { id: string; label: string; correct: boolean; feedback: string; /** 3D 포털 방향 (프레임 기준 normal, binormal) */ dir: [number, number]; to?: SegmentId }
export interface GateDef { id: string; segment: SegmentId; at: number; title: string; question: string; options: GateOption[]; hints: [string, string]; success: string }

export const GATES: GateDef[] = [
  {
    id: 'gate_ra', segment: 'ra', at: 0.9, title: '갈림길 ①  우심방',
    question: '대정맥을 지나 심장의 첫 번째 방(우심방)에 들어왔어! 혈액은 어느 쪽으로 흘러갈까?',
    options: [
      { id: 'to_rv', label: '아래쪽 문(판막)을 지나 아래 방으로', correct: true, feedback: '', dir: [0.2, -1], to: 'rv' },
      { id: 'to_la', label: '벽 너머 왼쪽 방으로 건너가기', correct: false, feedback: '쿵! 오른쪽 방과 왼쪽 방 사이에는 두꺼운 벽이 있어서 바로 건너갈 수 없어.', dir: [1, 0.3] },
      { id: 'back', label: '왔던 대정맥으로 되돌아가기', correct: false, feedback: '뒤에서 밀려오는 혈액이 탐사선을 다시 앞으로 밀어냈어! 혈액은 거꾸로 흐르지 않아.', dir: [-1, 0.4] },
    ],
    hints: ['적혈구들이 한꺼번에 몰려가는 쪽을 잘 봐! 반짝이는 흐름을 따라가면 돼.', '아래쪽 문(판막)이 박동에 맞춰 열릴 때, 적혈구가 그 문으로 쏟아져 들어가는 게 보여?'],
    success: '판막이 열렸어! 우심방의 혈액은 아래쪽 우심실로 내려가. 판막은 한 방향으로만 열리는 문이라서 혈액이 거꾸로 못 가.',
  },
  {
    id: 'gate_rv', segment: 'rv', at: 0.9, title: '갈림길 ②  우심실',
    question: '우심실이 힘차게 오므라들 준비를 해! 여기 혈액은 아직 산소가 적어(보랏빛). 어디로 나가야 할까?',
    options: [
      { id: 'to_pa', label: '위로 솟은 혈관 — "폐" 표지판', correct: true, feedback: '', dir: [0.3, 1], to: 'pulm_artery' },
      { id: 'to_aorta', label: '가장 굵은 혈관 — "온몸" 표지판', correct: false, feedback: '문이 꽉 닫혀 있어! 온몸으로 가는 대동맥은 왼쪽 심장(좌심실)에서 출발해. 산소가 적은 이 혈액은 먼저 어디에 들러야 할까?', dir: [1, -0.2] },
      { id: 'back_ra', label: '위쪽 방(우심방)으로 되돌아가기', correct: false, feedback: '판막이 닫혀서 되돌아갈 수 없어. 심장 속 문은 한 방향으로만 열려!', dir: [-1, 0.2] },
    ],
    hints: ['적혈구 색을 봐. 산소가 적은 혈액이 산소를 얻으려면 어디로 가야 할까?', '심장이 오므라들 때 적혈구가 빨려 들어가는 문을 찾아봐. 그 문 위에 어떤 표지판이 있지?'],
    success: '정답! 우심실은 산소가 적은 혈액을 폐동맥을 통해 폐로 보내. 폐에서 산소를 받아 올 거야.',
  },
];

/** 체크포인트에서 이어하기 위치 */
export const RESUME_POINTS: Record<string, { seg: SegmentId; t: number }> = {
  start: { seg: 'vena_cava', t: 0.06 },
  m1_done: { seg: 'pulm_artery', t: 0.03 },
  m2_heart: { seg: 'pulm_artery', t: 0.2 },
  m3_lungs: { seg: 'pulm_vein', t: 0.05 },
  m4_running: { seg: 'body_cap', t: 0.2 },
};
