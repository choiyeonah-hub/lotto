// 브라우저 E2E: 실제 키 입력으로 3D 캐릭터를 조작하고, window.__by1998 런타임 상태로
// 위치·애니메이션·관절·고무줄 변형·저장/재입장을 관찰한다. 렌더링이 멈추면 실패.
// 사용법: (개발 서버 실행 후) BASE=http://127.0.0.1:5173 node e2e/play.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// CPU 소프트웨어 렌더러(SwiftShader)에서는 그림자 고화질이 매우 느리므로 기본은 '가볍게' 화질로 검증한다.
const QUALITY = process.env.QUALITY ?? 'low'
const initSettings = (q) => localStorage.setItem('by1998.settings', JSON.stringify({ quality: q }))
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors = []

async function rt(page) {
  return page.evaluate(() => {
    const d = window.__by1998
    const ui = d.ui
    return {
      frame: d.runtime.frame,
      time: d.runtime.time,
      p: { ...d.runtime.player },
      joints: { ...d.runtime.joints },
      band: { ...d.runtime.band },
      hook: d.runtime.hook,
      ui: { scene: ui.scene, band: ui.band && { stepIndex: ui.band.stepIndex, message: ui.band.message }, dialogue: ui.dialogue?.node ?? null, room: ui.room.length, panel: ui.panel, nearby: ui.nearby?.id ?? null, notes: ui.memories['rubber-band-box']?.notes.map((n) => n.text) ?? [] },
    }
  })
}

/** 조건이 참이 될 때까지 키를 누른 채 상태를 폴링 */
async function holdUntil(page, keys, pred, timeout = 12000) {
  for (const k of keys) await page.keyboard.down(k)
  const t0 = Date.now()
  let s = await rt(page)
  while (!pred(s) && Date.now() - t0 < timeout) {
    await sleep(30)
    s = await rt(page)
  }
  for (const k of keys) await page.keyboard.up(k)
  return s
}

async function waitFor(page, pred, timeout = 6000) {
  const t0 = Date.now()
  let s = await rt(page)
  while (!pred(s) && Date.now() - t0 < timeout) {
    await sleep(40)
    s = await rt(page)
  }
  return s
}

/** 게임 시간(ms) 동안 상태를 표본 추출 — 렌더러가 느려도 같은 시뮬레이션 구간을 본다 */
async function sample(page, ms, every = 30) {
  const out = [await rt(page)]
  const g0 = out[0].time
  const t0 = Date.now()
  while (out.at(-1).time - g0 < ms / 1000 && Date.now() - t0 < 60000) {
    await sleep(every)
    out.push(await rt(page))
  }
  return out
}
const gameSleep = (page, ms) => sample(page, ms, 50)

async function enterAlley(page) {
  await page.goto(BASE)
  await page.waitForFunction(() => window.__by1998?.runtime, null, { timeout: 30000 })
  await sleep(1500)
  await page.screenshot({ path: OUT + '00-title.png' })
  await page.mouse.click(480, 300)
  await page.waitForFunction(() => window.__by1998.ui.scene === 'alley')
  await sleep(1200)
}

async function walkHomeAndEnter(page) {
  // 카메라 yaw=π/2(동쪽 바라봄) 기준: S=서쪽(-x), A=북쪽(-z)
  await page.keyboard.down('Shift')
  let s = await holdUntil(page, ['KeyA'], (s) => s.p.z < -1.6, 6000)
  s = await holdUntil(page, ['KeyS'], (s) => s.p.x <= -5.9, 15000)
  await page.keyboard.up('Shift')
  s = await holdUntil(page, ['KeyA'], (s) => s.ui.nearby === 'home', 4000)
  await page.keyboard.press('KeyE')
  return waitFor(page, (s) => s.ui.scene === 'room')
}

// ---------------- 데스크톱 시나리오 ----------------
{
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
  await page.addInitScript(initSettings, QUALITY)
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(BASE)
  await page.evaluate(() => indexedDB.deleteDatabase('by1998'))
  await enterAlley(page)

  // 렌더링 루프가 실제로 돌고 있는지
  const f0 = (await rt(page)).frame
  await sleep(1000)
  const f1 = (await rt(page)).frame
  check('3D 렌더 루프 동작 (프레임 증가)', f1 - f0 > 3, `${f1 - f0} frames/s`)
  const webgl = await page.evaluate(() => !!document.querySelector('canvas')?.getContext('webgl2'))
  check('WebGL 캔버스 존재', webgl)

  // WASD 걷기 + 다리 애니메이션
  const start = await rt(page)
  await page.keyboard.down('KeyW')
  const walk = await sample(page, 1000)
  await page.keyboard.up('KeyW')
  const end = await rt(page)
  check('W로 캐릭터가 이동', end.p.x - start.p.x > 1.5, `x ${start.p.x.toFixed(2)} → ${end.p.x.toFixed(2)}`)
  check('걷기 애니메이션 상태', walk.some((s) => s.p.anim === 'walk'))
  const thighs = walk.map((s) => s.joints.lThigh)
  check('다리 관절이 앞뒤로 흔들림', Math.max(...thighs) > 0.2 && Math.min(...thighs) < -0.2, `lThigh ${Math.min(...thighs).toFixed(2)}..${Math.max(...thighs).toFixed(2)}`)
  await page.screenshot({ path: OUT + '01-alley-walk.png' })

  // 점프
  await page.keyboard.press('Space')
  const jump = await sample(page, 1100, 25)
  const maxY = Math.max(...jump.map((s) => s.p.y))
  check('Space로 공중에 뛰어오름', maxY > 0.3, `최고 높이 ${maxY.toFixed(2)}m`)
  check('점프 → 착지', jump.some((s) => s.p.anim === 'jump') && jump.at(-1).p.grounded && jump.some((s) => s.p.anim === 'land'))

  // 공터로 이동
  await page.keyboard.down('Shift')
  await holdUntil(page, ['KeyA'], (s) => s.p.z < -1.15, 4000)
  let s = await holdUntil(page, ['KeyW'], (s) => s.p.x >= 15.6, 15000)
  await page.keyboard.up('Shift')
  check('공터 고무줄 앞까지 걸어감', s.p.x >= 15.6 && s.ui.nearby === 'band', `(${s.p.x.toFixed(1)}, ${s.p.z.toFixed(1)}) nearby=${s.ui.nearby}`)
  await page.keyboard.press('KeyE')
  s = await waitFor(page, (s) => s.ui.band?.stepIndex >= 1)
  check('고무줄놀이 시작 + 다가가기 완료', s.ui.band?.stepIndex >= 1, s.ui.band?.message)
  await page.screenshot({ path: OUT + '02-band-start.png' })

  // 걸어서 통과하면 넘기 인정 안 됨 (가짜 진행 방지) — 대신 점프로 넘기
  await page.keyboard.down('KeyD')
  s = await waitFor(page, (s) => s.p.z > -0.85, 10000)
  await page.keyboard.press('Space')
  const air = await sample(page, 500, 20)
  await page.screenshot({ path: OUT + '03-jump-over-band.png' })
  s = await waitFor(page, (s) => s.p.grounded && s.p.z > 0.4, 10000)
  await page.keyboard.up('KeyD')
  const minFoot = Math.min(...air.filter((a) => Math.abs(a.p.z) < 0.3).map((a) => a.p.y))
  check('넘기: 공중에서 두 줄을 건넘', s.ui.band?.stepIndex >= 2, `z=${s.p.z.toFixed(2)}, 줄 위 통과 시 몸 높이 ≥ ${isFinite(minFoot) ? minFoot.toFixed(2) : '?'}m`)

  // 돌아서 밟기
  await page.keyboard.press('KeyL')
  await waitFor(page, (s) => !s.p.action, 3000)
  // 줄에서 너무 멀리 착지했으면 줄 쪽으로 다가간다 (S=카메라 쪽, 현재 줄 방향)
  await holdUntil(page, ['KeyA'], (s) => s.p.z < 0.75, 4000)
  // 밟기: 줄에 닿지 않으면(위치가 어긋나면) 한 걸음 다가가 다시 시도 — 실제 플레이어와 같은 방식
  let step = []
  let attempts = 0
  for (; attempts < 3; ) {
    attempts++
    await page.keyboard.press('KeyJ')
    step = step.concat(await sample(page, 1000, 25))
    const cur = await rt(page)
    if (cur.ui.band?.stepIndex >= 3) break
    await holdUntil(page, ['KeyA'], (x) => x.p.z < cur.p.z - 0.15, 3000)
  }
  const depth = Math.max(...step.map((x) => x.band.depression))
  check('밟기: 발이 줄을 실제로 눌러 휨', depth > 0.04, `시도 ${attempts}회, 최대 눌림 ${(depth * 100).toFixed(1)}cm, rThigh 최대 ${Math.max(...step.map((x) => x.joints.rThigh)).toFixed(2)}`)
  s = await rt(page)
  check('밟기 단계 완료', s.ui.band?.stepIndex >= 3, s.ui.band?.message)
  // 스크린샷용으로 한 번 더 밟고, 발이 줄을 누른 순간을 찍는다
  await page.keyboard.press('KeyJ')
  await waitFor(page, (s) => s.band.depression > 0.05, 8000)
  await page.screenshot({ path: OUT + '04-step-press.png' })
  await waitFor(page, (s) => !s.p.action, 8000)

  // 걸기 → 돌기
  await page.keyboard.press('KeyK')
  s = await waitFor(page, (s) => s.p.hooked, 10000)
  check('걸기: 발에 줄이 걸림', s.p.hooked && !!s.hook, `strand=${s.hook?.strand} idx=${s.hook?.index}`)
  await gameSleep(page, 300)
  const hookDisp = (await rt(page)).band.displacement
  await page.screenshot({ path: OUT + '05-hook.png' })
  await page.keyboard.press('KeyL')
  const turn = await sample(page, 800, 25)
  const turnDisp = Math.max(...turn.map((x) => x.band.displacement))
  await page.screenshot({ path: OUT + '06-hook-turn.png' })
  s = await rt(page)
  check('돌기: 몸 방향이 바뀌고 줄이 당겨짐', s.p.hookedYaw > 2.6 && turnDisp > 0.12, `회전 ${((s.p.hookedYaw * 180) / Math.PI).toFixed(0)}°, 줄 변위 ${hookDisp.toFixed(2)} → ${turnDisp.toFixed(2)}m`)
  check('걸고 돌기 단계 완료', s.ui.band?.stepIndex >= 4)

  // 놓고 착지
  await page.keyboard.press('Space')
  s = await waitFor(page, (s) => s.ui.band?.stepIndex >= 5, 8000)
  const after = await sample(page, 800)
  check('놓고 착지: 줄이 풀리고 복원', s.ui.band?.stepIndex >= 5 && !s.p.hooked && after.at(-1).band.displacement < 0.1, `복원 후 변위 ${after.at(-1).band.displacement.toFixed(3)}m`)

  // 대화 → 고무줄 상자 저장
  s = await waitFor(page, (s) => s.ui.dialogue === "open", 12000)
  check('놀이 후 어린 나와의 대화 열림 (로컬 대화 모드)', s.ui.dialogue === 'open')
  await page.screenshot({ path: OUT + '07-dialogue.png' })
  await page.getByRole('button', { name: '어렸을 땐 끼고 싶어도 못 끼었어' }).click()
  await page.getByRole('button', { name: '응', exact: true }).click()
  const WORDS = '너도 함께 놀 자격이 있어. 잘 못해도 괜찮아.'
  await page.getByLabel('자유 입력').fill(WORDS)
  await page.getByRole('button', { name: '말하기' }).click()
  await page.getByRole('button', { name: '응, 나에게도' }).click()
  await page.getByRole('button', { name: '고무줄 상자에 남길래' }).click()
  s = await waitFor(page, (s) => s.ui.notes.includes(WORDS))
  check('사용자가 쓴 말이 고무줄 상자에 저장', s.ui.notes.includes(WORDS))
  await page.getByRole('button', { name: '닫기', exact: true }).click()

  // 줄 높이 변경 (발목 → 무릎): 줄잡이 발목의 고정점이 실제로 올라감
  await page.getByRole('button', { name: '무릎' }).click()
  await gameSleep(page, 300)
  const ropeY = await page.evaluate(() => window.__by1998.runtime.ropes[0].a.y)
  check('줄 높이를 무릎으로 올리면 고무줄 고정점이 올라감', Math.abs(ropeY - 0.4) < 1e-6, `y=${ropeY}`)
  await page.getByRole('button', { name: '놀이 그만하기' }).click()
  // 손 흔들기 · 앉기
  await page.keyboard.press('KeyQ')
  const wave = await sample(page, 400)
  check('Q: 손 흔들기 애니메이션', wave.some((x) => x.p.anim === 'wave'))
  await waitFor(page, (s) => !s.p.action, 8000)
  await page.keyboard.press('KeyC')
  const sit = await sample(page, 400)
  check('C: 앉기 (엉덩이가 내려감)', sit.some((x) => x.p.anim === 'sit') && Math.min(...sit.map((x) => x.joints.hipY)) < -0.3, `hipY ${Math.min(...sit.map((x) => x.joints.hipY)).toFixed(2)}`)
  await page.screenshot({ path: OUT + '07b-sit.png' })

  // 집으로 → 방
  s = await walkHomeAndEnter(page)
  check('초록 대문으로 들어가 방으로 전환', s.ui.scene === 'room')
  await page.getByRole('button', { name: '그때 실제로 내가 지내던 방' }).click()
  await sleep(800)
  await page.screenshot({ path: OUT + '08-room.png' })

  // 방 안에서 걷기
  const r0 = await rt(page)
  await page.keyboard.down('KeyW')
  await gameSleep(page, 600)
  await page.keyboard.up('KeyW')
  const r1 = await rt(page)
  check('방 안에서도 이동', Math.hypot(r1.p.x - r0.p.x, r1.p.z - r0.p.z) > 0.5)

  // 소품 배치 (실제 3D 좌표)
  await page.getByRole('button', { name: '방 꾸미기' }).click()
  await page.getByRole('button', { name: /곰인형/ }).click()
  // 가구가 없는 방바닥 지점 중 화면에 보이는 곳을 화면 좌표로 변환해 클릭
  const pt = await page.evaluate(() => {
    const d = window.__by1998
    const p = d.runtime.player
    for (let x = -1.0; x <= 0.7; x += 0.34)
      for (let z = -1.0; z <= 1.5; z += 0.25) {
        if (Math.hypot(x - p.x, z - p.z) < 0.6) continue
        const q = d.project(x, 0, z)
        if (q && q.x > 40 && q.x < innerWidth - 40 && q.y > 160 && q.y < innerHeight - 60) return { ...q, wx: x, wz: z }
      }
    return null
  })
  await page.screenshot({ path: OUT + '09a-placing.png' })
  await page.mouse.move(pt.x, pt.y)
  await sleep(200)
  await page.mouse.click(pt.x, pt.y)
  s = await waitFor(page, (s) => s.ui.room >= 1)
  const placed = await page.evaluate(() => window.__by1998.ui.room[0])
  check('곰인형을 방바닥 3D 좌표에 배치', s.ui.room === 1, placed && `(${placed.x.toFixed(2)}, ${placed.z.toFixed(2)})`)
  await page.getByRole('button', { name: '↻ 돌리기' }).click()
  await sleep(500)
  await page.screenshot({ path: OUT + '09-room-placed.png' })

  // 새로고침 → 재입장 → 저장 확인
  await enterAlley(page)
  s = await walkHomeAndEnter(page)
  await sleep(800)
  s = await rt(page)
  const placedAgain = await page.evaluate(() => window.__by1998.ui.room[0])
  check('새로고침 후 배치한 소품이 다시 나타남', s.ui.room === 1 && Math.abs(placedAgain.rotY - Math.PI / 4) < 1e-6, `rotY=${placedAgain?.rotY.toFixed(2)}`)
  const boxPt = await page.evaluate(() => window.__by1998.project(-1.85, 0.82, -0.85))
  await page.mouse.click(boxPt.x, boxPt.y)
  const opened = await page.getByRole('dialog', { name: '고무줄 상자' }).isVisible().catch(() => false)
  if (!opened) await page.getByRole('button', { name: '고무줄 상자' }).click()
  const visible = await page.getByText(WORDS).isVisible()
  check('재입장 후 고무줄 상자를 열어 저장된 말 다시 읽기', visible, opened ? '3D 상자 클릭으로 열림' : '상단 버튼으로 열림')
  await page.screenshot({ path: OUT + '10-box-reread.png' })
  await page.close()
}

// ---------------- 모바일 시나리오 ----------------
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await ctx.newPage()
  await page.addInitScript(initSettings, 'low')
  page.on('pageerror', (e) => errors.push('mobile: ' + String(e)))
  await page.goto(BASE)
  await page.waitForFunction(() => window.__by1998?.runtime, null, { timeout: 30000 })
  await sleep(1200)
  await page.screenshot({ path: OUT + '11-mobile-title.png' })
  await page.touchscreen.tap(195, 420)
  await page.waitForFunction(() => window.__by1998.ui.scene === 'alley')
  await sleep(800)
  const hasStick = await page.locator('.stick').isVisible()
  check('모바일: 가상 조이스틱 표시', hasStick)
  const box = await page.locator('.stick').boundingBox()
  const s0 = await rt(page)
  // 조이스틱 위로 끌기 (CDP 터치)
  const cdp = await ctx.newCDPSession(page)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] })
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - i * 8, id: 1 }] })
  await gameSleep(page, 1000)
  const mid = await rt(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  check('모바일: 조이스틱으로 걷기', mid.p.x - s0.p.x > 0.8 && mid.p.anim === 'walk', `x ${s0.p.x.toFixed(2)} → ${mid.p.x.toFixed(2)}`)
  await page.getByRole('button', { name: '점프 (Space)' }).tap()
  const j = await sample(page, 700, 25)
  check('모바일: 점프 버튼', Math.max(...j.map((x) => x.p.y)) > 0.3)
  await page.screenshot({ path: OUT + '12-mobile-alley.png' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  check('모바일: 가로 넘침 없음', !overflow)
  await ctx.close()
}

check('콘솔/페이지 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed. 스크린샷: ${OUT}`)
process.exit(failed.length ? 1 : 0)
