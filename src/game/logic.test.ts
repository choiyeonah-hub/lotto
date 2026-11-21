import { describe, expect, it } from 'vitest'
import { resolveCircle, boxAt } from './collision'
import { createRope, stepRope, maxDepression, maxDisplacement, nearestPoint } from './rope'
import { solveLegIK, legFK, selectAnim, poseFor, HIP_HEIGHT, LEG } from './animation'
import { initBand, updateBand, currentStep, type BandObs } from './rubberBand'
import { startDialogue, answer, view } from './dialogue'

describe('collision', () => {
  it('pushes a circle out of a box and keeps it in bounds', () => {
    const bounds = boxAt(0, 0, 10, 10)
    const r = resolveCircle(0.9, 0, 0.3, [boxAt(1.5, 0, 1, 1)], bounds)
    expect(r.x).toBeCloseTo(0.7, 5)
    const b = resolveCircle(20, 0, 0.3, [], bounds)
    expect(b.x).toBeCloseTo(4.7, 5)
  })
})

describe('rope simulation', () => {
  const a = { x: -1.8, y: 0.12, z: 0 }
  const b = { x: 1.8, y: 0.12, z: 0 }
  it('stays taut and straight with no contact', () => {
    const rope = createRope(a, b)
    for (let i = 0; i < 120; i++) stepRope(rope, 1 / 60, [], null)
    expect(maxDisplacement(rope)).toBeLessThan(0.02)
  })
  it('is pressed down by a foot coming from above, then springs back', () => {
    const rope = createRope(a, b)
    let y = 0.4
    for (let i = 0; i < 30; i++) {
      const prevY = y
      y = Math.max(0.05, y - 0.06) // 낮은 프레임레이트에서 크게 내려와도 뚫지 않아야 한다
      stepRope(rope, 1 / 15, [{ x: 0, y, z: 0, r: 0.09, prevY }], null)
    }
    expect(maxDepression(rope)).toBeGreaterThan(0.06)
    for (let i = 0; i < 200; i++) stepRope(rope, 1 / 60, [], null)
    expect(maxDepression(rope)).toBeLessThan(0.02)
  })
  it('follows a hooked foot and becomes stretched', () => {
    const rope = createRope(a, b)
    const { index } = nearestPoint(rope, { x: 0.2, y: 0.12, z: 0 })
    for (let i = 0; i < 60; i++) stepRope(rope, 1 / 60, [], { index, target: { x: 0.2, y: 0.25, z: 0.5 } })
    expect(rope.pos[index].z).toBeCloseTo(0.5, 3)
    expect(maxDisplacement(rope)).toBeGreaterThan(0.4)
  })
})

describe('leg IK / animation', () => {
  it('IK places the ankle where asked (FK round-trip)', () => {
    for (const [f, h] of [[0.3, 0.45], [0.15, 0.4], [0.4, 0.3]]) {
      const ik = solveLegIK(f, h)
      const fk = legFK(ik.thigh, ik.knee)
      expect(fk.f).toBeCloseTo(f, 4)
      expect(fk.h).toBeCloseTo(h, 4)
    }
    const straight = solveLegIK(0, LEG.thigh + LEG.shin)
    expect(straight.knee).toBeCloseTo(0, 1)
  })
  it('selects states from physical context', () => {
    const base = { grounded: true, vy: 0, speed: 0, action: null, hooked: false, sitting: false }
    expect(selectAnim(base)).toBe('idle')
    expect(selectAnim({ ...base, speed: 2 })).toBe('walk')
    expect(selectAnim({ ...base, grounded: false, vy: 2 })).toBe('jump')
    expect(selectAnim({ ...base, hooked: true })).toBe('hook')
    expect(selectAnim({ ...base, action: 'turn', hooked: true })).toBe('turn')
  })
  it('walk swings legs opposite; jump tucks feet up', () => {
    const w = poseFor('walk', { t: 0, phase: Math.PI / 2, speed: 2, ik: null })
    expect(Math.sign(w.lThigh)).toBe(-Math.sign(w.rThigh))
    const j = poseFor('jump', { t: 0, phase: 0, speed: 0, ik: null })
    expect(legFK(j.lThigh, j.lKnee).h).toBeLessThan(HIP_HEIGHT - LEG.ankle - 0.12)
  })
})

describe('rubber band game progression', () => {
  const g = { halfLen: 1.8, halfGap: 0.2 }
  const obs = (o: Partial<BandObs>): BandObs => ({ x: 0, z: -1, grounded: true, depression: 0, anim: 'idle', hooked: false, hookedYaw: 0, ...o })
  const run = (seq: Partial<BandObs>[]) => {
    let s = initBand()
    const events: string[] = []
    for (const o of seq) {
      const r = updateBand(s, obs(o), g)
      s = r.state
      events.push(...r.events)
    }
    return { s, events }
  }
  it('completes approach → jump → step → hook+turn → release only from observed motion', () => {
    const { s, events } = run([
      { z: -1 },
      { z: -0.5 },
      { z: -0.2, grounded: false },
      { z: 0.1, grounded: false },
      { z: 0.5, grounded: false },
      { z: 0.6, grounded: true },
      { z: 0.5, anim: 'step', depression: 0.08 },
      { z: 0.5, hooked: true, hookedYaw: 1 },
      { z: 0.5, hooked: true, hookedYaw: 3.1 },
      { z: 0.7, grounded: false },
      { z: 0.9, grounded: true },
    ])
    expect(currentStep(s)).toBe('done')
    expect(events).toContain('finished')
  })
  it('walking through the band is not a jump and only produces a gentle stumble', () => {
    const { s, events } = run([{ z: -1 }, { z: -0.5 }, { z: 0 }, { z: 0.5 }])
    expect(currentStep(s)).toBe('jump')
    expect(events).toContain('stumble')
  })
  it('pressing J without touching the rope does not count as a step', () => {
    const { s } = run([{ z: -1 }, { z: -0.5, grounded: false }, { z: 0.1, grounded: false }, { z: 0.6 }, { z: 0.6, anim: 'step', depression: 0.005 }])
    expect(currentStep(s)).toBe('step')
  })
})

describe('local dialogue', () => {
  it('walks the empathy → words → for-me → save path', () => {
    let s = startDialogue()
    s = answer(s, { value: 'excluded' })
    expect(view(s).ai).toContain('같이 놀고 싶었겠구나')
    s = answer(s, { value: 'next' })
    s = answer(s, { text: '너도 함께 놀 자격이 있어. 잘 못해도 괜찮아.' })
    expect(s.words).toContain('자격')
    s = answer(s, { value: 'yes' })
    s = answer(s, { value: 'save' })
    expect(s.saveRequested).toBe(true)
    expect(s.alsoForMe).toBe(true)
    expect(view(s).ended).toBe(true)
  })
  it('routes crisis language to help resources and allows quiet exit', () => {
    expect(answer(startDialogue(), { text: '그냥 죽고 싶어' }).node).toBe('crisis')
    expect(view(answer(startDialogue(), { value: '__quit' })).ended).toBe(true)
  })
})
