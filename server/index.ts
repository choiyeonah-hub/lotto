// BODY QUEST API 서버 (+ 배포 시 정적 파일 제공).
// - POST /api/assess : 구술 답변 채점 (키가 있으면 AI, 없으면 데모 규칙 채점)
// - /api/push/*      : 복습 알림 구독/발송
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { QUESTIONS } from '../shared/curriculum';
import { demoEvaluate } from '../shared/scoring';
import type { AssessRequest } from '../shared/types';
import { aiEnabled, aiEvaluate } from './ai';
import { initPush, isValidSubscription, pushEnabled, removeSubscription, sendDueReminders, sendTest, upsertSubscription, type Reminder } from './push';

const PORT = Number(process.env.PORT || 8787);
const DIST = join(process.cwd(), 'dist');
const PROD = process.env.NODE_ENV === 'production';

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit = 20_000): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(c as Buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('invalid json'), { status: 400 }); }
}

// IP별 간단한 요청 제한 (API 비용 보호)
const hits = new Map<string, number[]>();
function rateLimited(req: IncomingMessage, max = 20, windowMs = 60_000): boolean {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '?';
  const now = Date.now();
  const xs = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  xs.push(now);
  hits.set(ip, xs);
  return xs.length > max;
}

function parseAssess(body: unknown): AssessRequest | string {
  const b = body as Partial<AssessRequest>;
  if (typeof b?.questionId !== 'string' || !QUESTIONS[b.questionId]) return 'unknown questionId';
  if (typeof b.answer !== 'string') return 'answer must be a string';
  if (b.answer.length > 600) return 'answer too long';
  const attempt = Number.isInteger(b.attempt) && (b.attempt as number) > 0 ? (b.attempt as number) : 1;
  const branches = { followUp: b.branches?.followUp === true, challenge: b.branches?.challenge === true };
  return { questionId: b.questionId, answer: b.answer, attempt, branches };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  if (path === '/api/health' && req.method === 'GET') {
    return json(res, 200, { ok: true, ai: aiEnabled(), push: pushEnabled() });
  }

  if (path === '/api/assess' && req.method === 'POST') {
    if (rateLimited(req)) return json(res, 429, { error: '잠시 후 다시 시도해 주세요.' });
    const parsed = parseAssess(await readJson(req));
    if (typeof parsed === 'string') return json(res, 400, { error: parsed });
    const q = QUESTIONS[parsed.questionId];
    const route = { hasFollowUp: parsed.branches.followUp, hasChallenge: parsed.branches.challenge };
    if (!aiEnabled()) return json(res, 200, demoEvaluate(q, parsed.answer, parsed.attempt, route));
    try {
      return json(res, 200, await aiEvaluate(q, parsed.answer, parsed.attempt, route));
    } catch (err) {
      // 학생 답변 내용은 로그에 남기지 않는다
      console.error('[assess] AI failed:', (err as Error).message);
      return json(res, 200, demoEvaluate(q, parsed.answer, parsed.attempt, route, 'AI 연결 문제로 데모 채점을 사용했어요'));
    }
  }

  if (path === '/api/push/public-key' && req.method === 'GET') {
    return pushEnabled() ? json(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY }) : json(res, 503, { error: 'push not configured' });
  }

  if (path === '/api/push/subscribe' && req.method === 'POST') {
    if (!pushEnabled()) return json(res, 503, { error: 'push not configured' });
    if (rateLimited(req, 10)) return json(res, 429, { error: 'too many requests' });
    const b = (await readJson(req)) as { subscription?: unknown; reminders?: Reminder[] };
    if (!isValidSubscription(b.subscription)) return json(res, 400, { error: 'invalid subscription' });
    const reminders = (Array.isArray(b.reminders) ? b.reminders : [])
      .filter((r) => typeof r?.stage === 'string' && !Number.isNaN(Date.parse(r.notifyAt)))
      .slice(0, 5)
      .map((r) => ({ stage: r.stage, notifyAt: new Date(r.notifyAt).toISOString() }));
    const id = upsertSubscription(b.subscription, reminders);
    return json(res, 200, { ok: true, id, reminders: reminders.length });
  }

  if (path === '/api/push/unsubscribe' && req.method === 'POST') {
    const b = (await readJson(req)) as { endpoint?: string };
    if (typeof b.endpoint === 'string') removeSubscription(b.endpoint);
    return json(res, 200, { ok: true });
  }

  if (path === '/api/push/test' && req.method === 'POST') {
    if (!pushEnabled()) return json(res, 503, { error: 'push not configured' });
    if (rateLimited(req, 3)) return json(res, 429, { error: 'too many requests' });
    const b = (await readJson(req)) as { subscription?: unknown };
    if (!isValidSubscription(b.subscription)) return json(res, 400, { error: 'invalid subscription' });
    try { await sendTest(b.subscription); return json(res, 200, { ok: true }); }
    catch (err) { return json(res, 502, { error: 'push service rejected', status: (err as { statusCode?: number }).statusCode }); }
  }

  return json(res, 404, { error: 'not found' });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function serveStatic(res: ServerResponse, path: string) {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, safe);
  if (!file.startsWith(DIST)) return json(res, 403, { error: 'forbidden' });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html'); // SPA fallback
  }
  try {
    const data = await readFile(file);
    const ext = extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(data);
  } catch {
    json(res, 404, { error: 'build not found — run npm run build' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname);
    if (PROD) return await serveStatic(res, url.pathname);
    return json(res, 404, { error: 'dev server: open the Vite URL (port 5173)' });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    if (status === 500) console.error(err);
    json(res, status, { error: status === 500 ? 'server error' : (err as Error).message });
  }
});

initPush();
if (pushEnabled()) {
  // 1분마다 예약된 복습 알림 확인 (서버가 계속 켜져 있어야 함)
  setInterval(() => { sendDueReminders().catch((e) => console.error('[push] scheduler', e)); }, 60_000).unref();
}

server.listen(PORT, () => {
  console.log(`[body-quest] API on http://localhost:${PORT}  ai=${aiEnabled() ? 'ON' : 'OFF(데모 채점)'}  push=${pushEnabled() ? 'ON' : 'OFF'}`);
});
