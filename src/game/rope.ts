/**
 * RopeSimulation — 고무줄 한 가닥의 Verlet 시뮬레이션.
 * 양끝은 줄잡이(NPC) 발목에 고정되고, 플레이어 발(구)과 닿으면 밀려나며,
 * '걸기' 중에는 한 점이 발에 붙어 따라간다. 탄성(고무)이라 늘어났다가 복원된다.
 */
export interface V3 {
  x: number
  y: number
  z: number
}

export interface Rope {
  pos: V3[]
  prev: V3[]
  /** 점 사이 휴지 길이 (팽팽함을 위해 직선 간격보다 약간 짧다) */
  rest: number
  a: V3
  b: V3
}

export interface Sphere extends V3 {
  r: number
  /** 직전 프레임의 y. 위에서 내려 밟을 때 프레임이 낮아도 줄을 뚫지 않게 한다. */
  prevY?: number
}

export interface Hook {
  index: number
  target: V3
}

const GROUND = 0.012
const GRAVITY = -0.3 // 팽팽한 고무줄이라 처짐은 아주 작다
const RESTORE = 7 // 양끝을 잇는 직선으로 되돌아가려는 장력 근사(1/s²)
const DAMPING = 0.92
const STIFFNESS = 0.55 // <1: 고무처럼 늘어난다
const ITER = 10

const lerp3 = (a: V3, b: V3, t: number): V3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
})

export function createRope(a: V3, b: V3, n = 25): Rope {
  const pos: V3[] = []
  for (let i = 0; i < n; i++) pos.push(lerp3(a, b, i / (n - 1)))
  const seg = dist(a, b) / (n - 1)
  return { pos, prev: pos.map((p) => ({ ...p })), rest: seg * 0.97, a: { ...a }, b: { ...b } }
}

export function dist(p: V3, q: V3): number {
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
}

/** 줄 높이 변경 등으로 양끝 고정점을 옮긴다. */
export function setAnchors(rope: Rope, a: V3, b: V3): void {
  rope.a = { ...a }
  rope.b = { ...b }
  rope.rest = (dist(a, b) / (rope.pos.length - 1)) * 0.97
}

function collide(p: V3, pPrevY: number, feet: readonly Sphere[]): void {
  for (const f of feet) {
    const h = Math.hypot(p.x - f.x, p.z - f.z)
    if (f.prevY !== undefined && h < f.r && f.prevY > pPrevY && f.y < Math.max(p.y, pPrevY) + f.r) {
      // 위에서 내려온 발: 발바닥 아래로 줄을 누른다
      p.y = Math.max(GROUND, f.y - Math.sqrt(f.r * f.r - h * h))
      continue
    }
    const dx = p.x - f.x
    const dy = p.y - f.y
    const dz = p.z - f.z
    const d = Math.hypot(dx, dy, dz)
    if (d >= f.r || d < 1e-6) continue
    const k = f.r / d
    p.x = f.x + dx * k
    p.y = f.y + dy * k
    p.z = f.z + dz * k
  }
  if (p.y < GROUND) p.y = GROUND
}

export function stepRope(rope: Rope, dt: number, feet: readonly Sphere[], hook: Hook | null): void {
  const { pos, prev } = rope
  const n = pos.length
  const g = GRAVITY * dt * dt
  const k = Math.min(RESTORE * dt * dt * 60, 0.5)
  const prevY = pos.map((q) => q.y)
  for (let i = 1; i < n - 1; i++) {
    const p = pos[i]
    const q = prev[i]
    const r = lerp3(rope.a, rope.b, i / (n - 1))
    const vx = (p.x - q.x) * DAMPING + (r.x - p.x) * k
    const vy = (p.y - q.y) * DAMPING + (r.y - p.y) * k
    const vz = (p.z - q.z) * DAMPING + (r.z - p.z) * k
    q.x = p.x
    q.y = p.y
    q.z = p.z
    p.x += vx
    p.y += vy + g
    p.z += vz
  }
  for (let it = 0; it < ITER; it++) {
    pos[0] = { ...rope.a }
    pos[n - 1] = { ...rope.b }
    if (hook) pos[hook.index] = { ...hook.target }
    for (let i = 0; i < n - 1; i++) {
      const p = pos[i]
      const q = pos[i + 1]
      const d = dist(p, q) || 1e-6
      const diff = ((d - rope.rest) / d) * 0.5 * STIFFNESS
      const ox = (q.x - p.x) * diff
      const oy = (q.y - p.y) * diff
      const oz = (q.z - p.z) * diff
      const pinP = i === 0 || (hook && hook.index === i)
      const pinQ = i + 1 === n - 1 || (hook && hook.index === i + 1)
      if (!pinP) {
        p.x += ox * (pinQ ? 2 : 1)
        p.y += oy * (pinQ ? 2 : 1)
        p.z += oz * (pinQ ? 2 : 1)
      }
      if (!pinQ) {
        q.x -= ox * (pinP ? 2 : 1)
        q.y -= oy * (pinP ? 2 : 1)
        q.z -= oz * (pinP ? 2 : 1)
      }
    }
    for (let i = 1; i < n - 1; i++) if (!hook || hook.index !== i) collide(pos[i], prevY[i], feet)
  }
  // 고정점과 prev를 맞춰 끝점에 가짜 속도가 생기지 않게 한다
  prev[0] = { ...rope.a }
  prev[n - 1] = { ...rope.b }
}

/** 각 점이 양끝을 잇는 직선(휴지 상태)보다 아래로 눌린 최대 깊이(m). '밟기' 판정용. */
export function maxDepression(rope: Rope): number {
  const n = rope.pos.length
  let m = 0
  for (let i = 1; i < n - 1; i++) {
    const restY = rope.a.y + (rope.b.y - rope.a.y) * (i / (n - 1))
    m = Math.max(m, restY - rope.pos[i].y)
  }
  return m
}

/** 휴지 직선에서 벗어난 최대 변위(m). 줄이 실제로 휘었는지 관찰용. */
export function maxDisplacement(rope: Rope): number {
  const n = rope.pos.length
  let m = 0
  for (let i = 1; i < n - 1; i++) m = Math.max(m, dist(rope.pos[i], lerp3(rope.a, rope.b, i / (n - 1))))
  return m
}

/** 점 p(xz 평면 기준)에 가장 가까운 줄 점의 인덱스와 3D 거리. */
export function nearestPoint(rope: Rope, p: V3): { index: number; d: number } {
  let best = 1
  let bd = Infinity
  for (let i = 1; i < rope.pos.length - 1; i++) {
    const d = dist(rope.pos[i], p)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return { index: best, d: bd }
}
