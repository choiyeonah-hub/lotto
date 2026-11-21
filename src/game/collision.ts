/** 바닥 평면(XZ)에서의 원(캐릭터) vs 축정렬 박스(벽·건물·가구) 충돌. */
export interface Box2 {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function boxAt(cx: number, cz: number, w: number, d: number): Box2 {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 }
}

/** 원을 bounds 안에 가두고, 겹치는 박스 밖으로 최소 거리만큼 밀어낸다. */
export function resolveCircle(
  x: number,
  z: number,
  r: number,
  boxes: readonly Box2[],
  bounds: Box2,
): { x: number; z: number } {
  for (const b of boxes) {
    const nx = Math.max(b.minX, Math.min(x, b.maxX))
    const nz = Math.max(b.minZ, Math.min(z, b.maxZ))
    const dx = x - nx
    const dz = z - nz
    const d2 = dx * dx + dz * dz
    if (d2 >= r * r) continue
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2)
      x = nx + (dx / d) * r
      z = nz + (dz / d) * r
    } else {
      // 중심이 박스 안: 가장 가까운 면으로 밀어냄
      const pushes = [
        { v: x - b.minX + r, ax: 'x', s: -1 },
        { v: b.maxX - x + r, ax: 'x', s: 1 },
        { v: z - b.minZ + r, ax: 'z', s: -1 },
        { v: b.maxZ - z + r, ax: 'z', s: 1 },
      ].sort((a, c) => a.v - c.v)
      const p = pushes[0]
      if (p.ax === 'x') x += p.s * p.v
      else z += p.s * p.v
    }
  }
  x = Math.max(bounds.minX + r, Math.min(bounds.maxX - r, x))
  z = Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, z))
  return { x, z }
}
