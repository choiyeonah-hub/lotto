// 실제 브라우저(Chromium)로 에피소드 1을 처음부터 끝까지 플레이하는 점검 스크립트.
// 사용: 서버 실행(npm run build && npm start) 후  node scripts/e2e.cjs [baseUrl] [screenshotDir]
// 이동 구간은 시간을 아끼려고 탐사선 위치를 직접 옮기지만, 갈림길·질문·분기·저장은 실제 UI를 클릭해 진행한다.
const { chromium, devices } = require('playwright');
const assert = require('assert');

const BASE = process.argv[2] || 'http://localhost:8787';
const OUT = process.argv[3] || 'test-results';
require('fs').mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);

async function shipState(page) {
  return page.evaluate(() => ({ seg: window.__bq.ship.seg, t: window.__bq.ship.t, phase: window.__bq.game.getState().phase }));
}
async function teleport(page, seg, t) {
  await recoverIfNeeded(page);
  await page.evaluate(([s, tt]) => { window.__bq.ship.seg = s; window.__bq.ship.t = tt; }, [seg, t]);
}
// 소프트웨어 렌더링에서 그래픽 컨텍스트를 잃으면 복구 화면이 뜬다 → '다시 시도'로 이어서 진행 (복구 기능 점검 겸용)
async function recoverIfNeeded(page) {
  if (await page.getByTestId('gl-error').isVisible().catch(() => false)) {
    console.log('• 3D 복구 화면 감지 → 다시 시도');
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.locator('canvas').waitFor({ timeout: 20000 });
    globalThis.__recovered = (globalThis.__recovered || 0) + 1;
  }
}
async function waitCinematic(page) {
  for (let i = 0; i < 4; i++) {
    try { await page.getByTestId('cinematic').waitFor({ timeout: 6000 }); return; } catch { await recoverIfNeeded(page); }
  }
  throw new Error('관찰 모드가 시작되지 않음');
}
async function closeDialogs(page) {
  for (let i = 0; i < 8; i++) {
    const d = page.getByTestId('dialog');
    if (!(await d.isVisible().catch(() => false))) return;
    await d.click();
    await page.waitForTimeout(150);
  }
}
async function answer(page, kind) {
  await page.getByTestId('answer-panel').waitFor();
  const label = { good: '잘 이해한 답', partial: '부분 답', wrong: '오개념 답' }[kind];
  await page.getByRole('button', { name: label }).click();
  await page.getByTestId('answer-submit').click();
  await page.getByTestId('feedback').waitFor();
  const level = await page.locator('.fb-level b').textContent();
  const action = await page.getByTestId('feedback-continue').textContent();
  return { level, action };
}
async function phase(page) { return (await shipState(page)).phase; }

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  globalThis.__page = page;
  const errors = [];
  globalThis.__errors = errors;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // ── 1. 메인 → 프로필 → 게임 시작 ──
  await page.goto(BASE);
  await page.getByTestId('nickname').fill('테스트대원');
  await page.getByTestId('create-profile').click();
  await page.getByTestId('start-game').click();
  await page.locator('canvas').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/01-intro.png` });
  await closeDialogs(page);
  assert.equal(await phase(page), 'travel');

  // ── 2. 탐사선 이동 + 지도 동기화 ──
  const before = await shipState(page);
  const dotBefore = await page.locator('.ship-dot').getAttribute('transform');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const after = await shipState(page);
  const dotAfter = await page.locator('.ship-dot').getAttribute('transform');
  log('이동', before, '→', after, '| 지도', dotBefore, '→', dotAfter);
  assert(after.seg !== before.seg || after.t > before.t + 0.02, '탐사선이 앞으로 움직여야 함');
  assert.notEqual(dotBefore, dotAfter, '지도 위 위치가 바뀌어야 함');
  await page.screenshot({ path: `${OUT}/02-travel.png` });

  // 뒤로 가기: 구간 시작에서 막힘 안내
  await teleport(page, 'vena_cava', 0.004);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyS');
  assert((await shipState(page)).t >= 0, '거꾸로 가지 않음');

  // ── 3. 미션 1: 갈림길 (오답 2번 → 힌트 강조 → 정답) ──
  await teleport(page, 'ra', 0.86);
  await page.getByTestId('gate-choice').waitFor({ timeout: 8000 });
  await page.getByTestId('gate-opt-to_la').click();
  const msg1 = await page.getByTestId('gate-msg').textContent();
  assert(msg1.includes('💡'), '오답 후 힌트가 보여야 함');
  await page.getByTestId('gate-opt-back').click();
  assert(await page.locator('.gate-opt.glow').count() === 1, '두 번 틀리면 정답 쪽 시각 힌트');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/03-gate-hint.png` });
  await page.getByTestId('gate-opt-to_rv').click();
  log('갈림길 ① 통과:', await shipState(page));
  await closeDialogs(page);
  await teleport(page, 'rv', 0.86);
  await page.getByTestId('gate-choice').waitFor({ timeout: 8000 });
  await page.getByTestId('gate-opt-to_pa').click();
  await closeDialogs(page);
  assert.equal((await shipState(page)).seg, 'pulm_artery');

  // ── 4. 미션 2 (A 경로): 오답 → 힌트 재도전 → 실험실 → 빈칸 정리 ──
  await teleport(page, 'pulm_artery', 0.08);
  await waitCinematic(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-heart-observe.png` });
  await page.getByRole('button', { name: '관찰 끝내기 ▶' }).click();
  let r = await answer(page, 'wrong');
  log('M2 1차(오개념):', r);
  assert(r.action.includes('힌트'), 'A: 첫 오답은 힌트 재도전');
  await page.screenshot({ path: `${OUT}/05-feedback-hint.png` });
  await page.getByTestId('feedback-continue').click();
  assert(await page.locator('.ap-hint').isVisible(), '힌트가 질문과 함께 보여야 함');
  const easyQ = await page.locator('.ap-question').textContent();
  assert(easyQ.includes('짧게'), `더 쉬운 질문으로 바뀌어야 함: ${easyQ}`);
  r = await answer(page, 'wrong');
  log('M2 2차:', r);
  assert(r.action.includes('실험실'));
  await page.getByTestId('feedback-continue').click();
  await page.getByTestId('lab-pump').waitFor();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /꾹 누르기/ }).click();
  await page.screenshot({ path: `${OUT}/06-lab.png` });
  await page.getByRole('button', { name: '관찰 끝! 다시 설명하기' }).click();
  r = await answer(page, 'wrong');
  log('M2 3차:', r);
  assert(r.action.includes('정리'));
  await page.getByTestId('feedback-continue').click();
  await page.getByTestId('scaffold').waitFor();
  await page.getByRole('button', { name: '펌프', exact: true }).click();
  await page.getByRole('button', { name: '밀어', exact: true }).click();
  await page.getByRole('button', { name: '다음 탐사로' }).click();
  await closeDialogs(page);
  assert.equal(await phase(page), 'travel');

  // ── 5. 미션 3: A 경로를 거친 학생은 쉬운 질문부터 → 잘 답하면 한 단계 깊은 질문 ──
  await teleport(page, 'lung_cap', 0.48);
  await waitCinematic(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/07-lung-observe.png` });
  await page.getByRole('button', { name: '관찰 끝내기 ▶' }).click();
  assert((await page.locator('.ap-question').textContent()).includes('파란 알갱이'), '이전 미션에서 어려워한 학생은 쉬운 질문부터');
  r = await answer(page, 'good');
  log('M3 쉬운 질문 좋은 답:', r);
  assert(r.action.includes('한 가지 더'), '잘하면 한 단계 깊은 질문');
  await page.getByTestId('feedback-continue').click();
  r = await answer(page, 'good');
  await page.getByTestId('feedback-continue').click();
  await closeDialogs(page);

  // ── 6. 미션 4 (B 경로) + 최종 응용 ──
  await teleport(page, 'aorta', 0.49);
  await page.getByTestId('banner').waitFor({ timeout: 8000 });
  assert.equal((await shipState(page)).seg, 'body_cap', '근육 구역으로 순간 이동');
  await closeDialogs(page);
  await waitCinematic(page);
  await page.waitForTimeout(3000);
  const bpm = Number(await page.locator('.heartrate b').textContent());
  log('달리기 심박:', bpm);
  assert(bpm > 85, '심박수가 빨라져야 함');
  await page.screenshot({ path: `${OUT}/09-running.png` });
  await page.getByRole('button', { name: '관찰 끝내기 ▶' }).click();
  r = await answer(page, 'partial');
  log('M4 부분 답:', r);
  assert(r.action.includes('한 가지 더'), 'B: 추가 왜 질문');
  await page.getByTestId('feedback-continue').click();
  r = await answer(page, 'good');
  await page.getByTestId('feedback-continue').click();
  const finalQ = await page.locator('.ap-question').textContent();
  log('최종 질문:', finalQ.slice(0, 40));
  assert(/사건/.test(finalQ) && !finalQ.includes('달리기'), '앞 질문과 다른 새로운 응용 사건');
  r = await answer(page, 'good');
  await page.getByTestId('feedback-continue').click();
  await page.getByTestId('ending').waitFor();
  await page.screenshot({ path: `${OUT}/10-ending.png` });

  // ── 7. 저장 확인 ──
  const saved = await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('bq:v1:active'));
    return JSON.parse(localStorage.getItem(`bq:v1:progress:${id}`));
  });
  log('저장:', saved.status, saved.checkpoint, 'attempts', saved.attempts.length, 'choices', saved.choices.length, 'reviews', saved.reviews.map((x) => x.stage + '@' + x.availableAt));
  assert.equal(saved.status, 'completed');
  assert.equal(saved.reviews.length, 3);

  // ── 8. D+0 복습 ──
  await page.getByTestId('go-review').click();
  await page.getByTestId('start-review').click();
  for (let i = 0; i < 3; i++) {
    r = await answer(page, 'good');
    await page.getByTestId('feedback-continue').click();
  }
  await page.getByTestId('review-screen').waitFor();
  const nextTxt = await page.getByTestId('next-review').textContent();
  log('다음 복습 안내:', nextTxt);
  assert(nextTxt.includes('D+1'));
  await page.screenshot({ path: `${OUT}/11-review.png`, fullPage: true });

  // ── 9. 새로고침 후 복원 + 다음 날(D+1) 자동 표시 ──
  await page.evaluate(() => {
    const id = JSON.parse(localStorage.getItem('bq:v1:active'));
    const k = `bq:v1:progress:${id}`;
    const p = JSON.parse(localStorage.getItem(k));
    p.reviews = p.reviews.map((r) => (r.stage === 'review_d1' ? { ...r, availableAt: new Date(Date.now() - 60000).toISOString() } : r));
    localStorage.setItem(k, JSON.stringify(p));
  });
  await page.reload();
  await page.getByTestId('today-review').waitFor({ timeout: 5000 });
  log('다시 열기 → 오늘의 복습 표시:', (await page.getByTestId('today-review').textContent()).trim());
  await page.getByTestId('open-records').click();
  await page.getByTestId('records').waitFor();
  await page.screenshot({ path: `${OUT}/12-records.png`, fullPage: true });

  // ── 9b. C 경로: 새 대원, 갈림길 모두 정답 → 미션 2 좋은 답 → 심화 사건 ──
  await page.getByRole('button', { name: '← 메인' }).click();
  await page.getByRole('button', { name: '대원 바꾸기' }).click();
  await page.getByTestId('nickname').fill('심화대원');
  await page.getByTestId('create-profile').click();
  await page.getByTestId('start-game').click();
  await page.locator('canvas').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await closeDialogs(page);
  await teleport(page, 'ra', 0.86);
  await page.getByTestId('gate-opt-to_rv').click();
  await closeDialogs(page);
  await teleport(page, 'rv', 0.86);
  await page.getByTestId('gate-opt-to_pa').click();
  await closeDialogs(page);
  await teleport(page, 'pulm_artery', 0.08);
  await waitCinematic(page);
  await page.getByRole('button', { name: '관찰 끝내기 ▶' }).click();
  r = await answer(page, 'good');
  log('C 경로 M2:', r);
  assert(r.action.includes('심화'), 'C: 심화 사건');
  await page.getByTestId('feedback-continue').click();
  await page.getByTestId('banner').waitFor();
  assert((await page.locator('.ap-question').textContent()).includes('판막'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/08-challenge.png` });

  // ── 10. 모바일 ──
  const m = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('[mobile] ' + e.message));
  await mp.goto(BASE);
  await mp.getByTestId('nickname').fill('모바일');
  await mp.getByTestId('create-profile').click();
  await mp.screenshot({ path: `${OUT}/13-mobile-home.png` });
  await mp.getByTestId('start-game').click();
  await mp.locator('canvas').waitFor({ timeout: 20000 });
  await mp.waitForTimeout(2000);
  await mp.screenshot({ path: `${OUT}/14-mobile-intro.png` });
  for (let i = 0; i < 3; i++) { await mp.getByTestId('dialog').click(); await mp.waitForTimeout(150); }
  const thr = mp.getByRole('button', { name: '앞으로' });
  const box = await thr.boundingBox();
  assert(box.width >= 44 && box.height >= 44, '터치 버튼이 충분히 커야 함');
  const t0 = await mp.evaluate(() => window.__bq.ship.t);
  await thr.dispatchEvent('pointerdown', { pointerId: 1 });
  await mp.waitForTimeout(1500);
  await thr.dispatchEvent('pointerup', { pointerId: 1 });
  const t1 = await mp.evaluate(() => window.__bq.ship.t);
  log('모바일 터치 이동', t0, '→', t1);
  assert(t1 > t0);
  await mp.screenshot({ path: `${OUT}/15-mobile-travel.png` });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!overflow, '가로 스크롤 없음');

  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
  log('참고: 헤드리스(소프트웨어 렌더링) 프레임', fps);

  const realErrors = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
  if (realErrors.length) { console.log('콘솔 오류:', realErrors); }
  await browser.close();
  assert.equal(realErrors.length, 0, '콘솔 오류 없어야 함');
  console.log('\nE2E 통과 ✅');
})().catch(async (e) => {
  console.error('E2E 실패 ❌', e);
  try { const st = await globalThis.__page?.evaluate(() => ({ ship: { seg: window.__bq.ship.seg, t: window.__bq.ship.t, speed: window.__bq.ship.speed }, g: (({ phase, checkpoint, dialog, fired }) => ({ phase, checkpoint, dialog: dialog && dialog.lines[dialog.i].text, fired }))(window.__bq.game.getState()) })); console.error('상태:', JSON.stringify(st)); console.error('오류:', globalThis.__errors, 'gl-error:', await globalThis.__page.getByTestId('gl-error').isVisible()); } catch (x) { console.error(x); }
  process.exit(1);
});
