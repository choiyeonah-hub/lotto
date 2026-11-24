// 에피소드 1 진행 상태 머신: 이동 → 갈림길 → 관찰 → 구술 질문 → 피드백/분기 → 다음 미션.
import { create } from 'zustand';
import { getQuestion, type MissionId } from '../../shared/curriculum';
import { branchesFor, decideNext, firstQuestion, MISSIONS, updateLevel, type LabId, type NextStep, type QuestionState } from '../../shared/flow';
import { completeEpisode, recordAttempt, recordChoice, type Checkpoint } from '../../shared/progress';
import type { Assessment, Level } from '../../shared/types';
import { assess } from '../lib/api';
import { speak } from '../lib/speech';
import { cam, resetRuntime, ship, sim, type CamMode } from '../game/runtime';
import { GATES, RESUME_POINTS, SEG, type GateDef, type SegmentId } from '../game/world';
import { useApp } from './useApp';

export type Phase = 'intro' | 'travel' | 'gate' | 'cinematic' | 'question' | 'assessing' | 'feedback' | 'lab' | 'scaffold' | 'ending';

export interface DialogLine { text: string; mood?: 'normal' | 'alert' | 'happy' | 'think' }
interface Dialog { lines: DialogLine[]; i: number; blocking: boolean; onDone?: () => void }

interface Objective { title: string; goal: string; target: SegmentId }

interface GameState {
  phase: Phase;
  dialog: Dialog | null;
  objective: Objective;
  checkpoint: Checkpoint;
  level: Level;
  gate: { def: GateDef; wrong: number; message: string | null; highlight: boolean } | null;
  gatesDone: string[];
  fired: string[];
  question: QuestionState | null;
  hint: string | null;
  assessment: Assessment | null;
  lastAnswer: string;
  pending: NextStep | null;
  lab: { id: LabId; then: QuestionState } | null;
  scaffoldId: string | null;
  cinematic: { mode: CamMode; captions: string[]; next: () => void } | null;
  banner: { icon: string; text: string; tone: 'alert' | 'info' } | null;
  visited: SegmentId[];

  begin(): void;
  say(lines: DialogLine[], opts?: { blocking?: boolean; onDone?: () => void }): void;
  advanceDialog(): void;
  onPosition(seg: SegmentId, t: number): void;
  chooseGate(optionId: string): void;
  endCinematic(): void;
  submitAnswer(text: string): Promise<void>;
  continueAfterFeedback(): void;
  finishLab(): void;
  finishScaffold(): void;
  gateBlocks(seg: SegmentId): number | null;
}

const OBJECTIVES: Record<string, Objective> = {
  m1: { title: '미션 1 · 혈액의 이동 방향', goal: '혈류를 따라 심장으로! 갈림길에서 혈액이 가는 길을 찾아라', target: 'ra' },
  m2_heart: { title: MISSIONS.m2_heart.title, goal: '폐동맥 입구에서 박동하는 심장을 관찰하라', target: 'pulm_artery' },
  m3_lungs: { title: MISSIONS.m3_lungs.title, goal: '폐동맥을 따라 폐로 이동해 혈액의 변화를 관찰하라', target: 'lung_cap' },
  m4_running: { title: MISSIONS.m4_running.title, goal: '산소가 많은 혈액을 따라 좌심장을 지나 대동맥으로!', target: 'aorta' },
  m5_final: { title: MISSIONS.m5_final.title, goal: MISSIONS.m5_final.goal, target: 'body_cap' },
  done: { title: '탐사 완료!', goal: '오늘의 복습 미션을 확인하라', target: 'body_cap' },
};

const CINEMATIC_CAPTIONS: Record<MissionId, string[]> = {
  m2_heart: ['심장이 꽉 오므라들면(수축) 안의 혈액이 혈관으로 밀려 나가.', '다시 부풀면(이완) 정맥에서 혈액이 들어와.', '판막 문은 한쪽 방향으로만 열려!'],
  m3_lungs: ['포도송이 같은 허파꽈리 사이로 모세혈관이 지나가.', '반짝이는 산소 알갱이가 적혈구로 들어가고…', '회색 이산화탄소 알갱이는 밖으로 나가!'],
  m4_running: ['다리 근육이 힘차게 움직이기 시작했어!', '심장 박동 수를 봐 — 점점 빨라지고 있어.', '근육 속으로 산소 알갱이가 빨려 들어가고 있어.'],
  m5_final: [],
};

const app = () => useApp.getState();

function placeShip(seg: SegmentId, t: number) {
  ship.seg = seg;
  ship.t = t;
  ship.ox = 0;
  ship.oy = 0;
  ship.speed = 0;
}

function setCheckpoint(ck: Checkpoint) {
  app().updateProgress((p) => ({ ...p, checkpoint: ck, status: p.status === 'completed' ? 'completed' : 'in_progress' }));
  useGame.setState({ checkpoint: ck });
}

export const useGame = create<GameState>((set, get) => {
  const voice = (text: string) => speak(text, app().voiceGuide);

  function askQuestion(q: QuestionState, hint: string | null) {
    set({ phase: 'question', question: q, hint, assessment: null });
    voice(getQuestion(q.questionId).prompt);
  }

  function startMission(id: MissionId) {
    const first = firstQuestion(id, get().level);
    if (id === 'm5_final') {
      set({ banner: { icon: '🏔', text: '새로운 사건: 높은 산 위의 탐사 대상!', tone: 'info' } });
      askQuestion(first, null);
      return;
    }
    cam.mode = id === 'm2_heart' ? 'heart' : id === 'm3_lungs' ? 'lungs' : 'muscle';
    if (id === 'm3_lungs') sim.exchangeBoost = 1;
    set({ phase: 'cinematic', cinematic: { mode: cam.mode, captions: CINEMATIC_CAPTIONS[id], next: () => askQuestion(first, null) } });
    voice(CINEMATIC_CAPTIONS[id][0]);
  }

  function completeMission(id: MissionId) {
    sim.alarm = 0;
    set({ question: null, assessment: null, hint: null, pending: null, banner: null });
    if (id === 'm2_heart') {
      setCheckpoint('m2_heart');
      set({ objective: OBJECTIVES.m3_lungs, phase: 'travel' });
      get().say([{ text: '심장 관찰 완료! 이제 이 혈액이 산소를 얻으러 어디로 가는지 따라가 보자.', mood: 'happy' }]);
    } else if (id === 'm3_lungs') {
      sim.exchangeBoost = 0;
      setCheckpoint('m3_lungs');
      set({ objective: OBJECTIVES.m4_running, phase: 'travel' });
      get().say([{ text: '산소 충전 완료! 빨개진 적혈구와 함께 폐정맥을 타고 왼쪽 심장으로 가자.', mood: 'happy' }]);
    } else if (id === 'm4_running') {
      setCheckpoint('m4_running');
      set({ objective: OBJECTIVES.m5_final });
      startMission('m5_final');
    } else {
      app().updateProgress((p) => completeEpisode(p));
      sim.running = false;
      sim.targetBpm = 72;
      set({ phase: 'ending', objective: OBJECTIVES.done, checkpoint: 'ending' });
    }
  }

  function startRunningEvent() {
    // 탐사선을 다리 근육 구역으로 이동 + 달리기 시작
    ship.warp = 1;
    placeShip('body_cap', 0.22);
    sim.running = true;
    sim.targetBpm = 150;
    sim.muscleBoost = 1;
    set({ objective: { title: MISSIONS.m4_running.title, goal: '달리기 시작! 심박수가 빨라진 이유를 추리하라', target: 'body_cap' } });
    set({ banner: { icon: '🏃', text: '사건 발생! 이 사람이 달리기 시작했어!', tone: 'alert' } });
    get().say([
      { text: '긴급 호출! 탐사선이 다리 근육 구역으로 순간 이동했어!', mood: 'alert' },
      { text: '이 사람이 갑자기 달리기 시작했어. 근육과 심장 박동을 잘 관찰해 봐!', mood: 'alert' },
    ], { blocking: true, onDone: () => startMission('m4_running') });
  }

  return {
    phase: 'intro',
    dialog: null,
    objective: OBJECTIVES.m1,
    checkpoint: 'start',
    level: 'intermediate',
    gate: null,
    gatesDone: [],
    fired: [],
    question: null,
    hint: null,
    assessment: null,
    lastAnswer: '',
    pending: null,
    lab: null,
    scaffoldId: null,
    cinematic: null,
    banner: null,
    visited: [],

    begin() {
      resetRuntime();
      const p = app().progress;
      let ck: Checkpoint = p?.checkpoint ?? 'start';
      if (ck === 'ending') ck = 'start'; // 완료 후 다시 하기
      const resume = RESUME_POINTS[ck] ?? RESUME_POINTS.start;
      placeShip(resume.seg, resume.t);
      app().updateProgress((pp) => ({ ...pp, status: pp.status === 'completed' ? 'completed' : 'in_progress', startedAt: pp.startedAt ?? new Date().toISOString() }));

      const gatesDone = ck === 'start' ? [] : GATES.map((g) => g.id);
      const objective = ck === 'start' ? OBJECTIVES.m1 : ck === 'm1_done' ? OBJECTIVES.m2_heart : ck === 'm2_heart' ? OBJECTIVES.m3_lungs : ck === 'm3_lungs' ? OBJECTIVES.m4_running : OBJECTIVES.m5_final;
      set({
        phase: 'intro', dialog: null, objective, checkpoint: ck, level: p?.level ?? 'intermediate', gate: null, gatesDone, fired: [],
        question: null, hint: null, assessment: null, pending: null, lab: null, scaffoldId: null, cinematic: null, banner: null,
        visited: [resume.seg],
      });

      if (ck === 'start') {
        get().say([
          { text: '안녕, 탐사대원! 나는 안내 AI "루미"야. 우리는 지금 아주 작아져서 사람의 정맥 속에 들어왔어.', mood: 'happy' },
          { text: '긴급 상황! 우리 몸의 근육에 산소가 충분히 도착하지 않고 있어요. 혈액이 이동하는 길을 조사해 원인을 찾아주세요!', mood: 'alert' },
          { text: '앞으로 가기(▲ 또는 W)로 혈류를 타고 심장을 향해 출발하자. 화면을 끌면 주위를 둘러볼 수 있어. 오른쪽 위 지도에서 위치를 확인해!', mood: 'normal' },
        ], { blocking: true, onDone: () => set({ phase: 'travel' }) });
      } else if (ck === 'm4_running') {
        sim.running = true;
        sim.targetBpm = 150;
        set({ phase: 'travel' });
        get().say([{ text: '이어서 탐사하자! 마지막 사건이 기다리고 있어.', mood: 'normal' }], { blocking: true, onDone: () => startMission('m5_final') });
      } else {
        get().say([{ text: `이어서 탐사하자! 목표: ${objective.goal}`, mood: 'normal' }], { blocking: true, onDone: () => set({ phase: 'travel' }) });
      }
    },

    say(lines, opts) {
      set({ dialog: { lines, i: 0, blocking: opts?.blocking ?? false, onDone: opts?.onDone } });
      voice(lines[0].text);
    },

    advanceDialog() {
      const d = get().dialog;
      if (!d) return;
      if (d.i + 1 < d.lines.length) {
        set({ dialog: { ...d, i: d.i + 1 } });
        voice(d.lines[d.i + 1].text);
      } else {
        set({ dialog: null });
        d.onDone?.();
      }
    },

    gateBlocks(seg) {
      const g = GATES.find((x) => x.segment === seg && !get().gatesDone.includes(x.id));
      return g ? g.at : null;
    },

    onPosition(seg, t) {
      const s = get();
      if (!s.visited.includes(seg)) {
        set({ visited: [...s.visited, seg] });
        app().updateProgress((p) => (p.visitedSegments.includes(seg) ? p : { ...p, visitedSegments: [...p.visitedSegments, seg] }));
      }
      if (s.phase !== 'travel') return;
      const fire = (id: string) => {
        if (get().fired.includes(id)) return false;
        set({ fired: [...get().fired, id] });
        return true;
      };

      for (const g of GATES) {
        if (seg === g.segment && t >= g.at - 0.02 && !s.gatesDone.includes(g.id)) {
          ship.speed = 0;
          set({ phase: 'gate', gate: { def: g, wrong: 0, message: null, highlight: false } });
          voice(g.question);
          return;
        }
      }
      const ck = s.checkpoint;
      if (ck === 'm1_done' && seg === 'pulm_artery' && t >= 0.1) { ship.speed = 0; startMission('m2_heart'); return; }
      if (ck === 'm2_heart' && seg === 'lung_cap' && t >= 0.5) { ship.speed = 0; startMission('m3_lungs'); return; }
      if (ck === 'm3_lungs' && seg === 'aorta' && t >= 0.5) { ship.speed = 0; set({ phase: 'cinematic', cinematic: null }); startRunningEvent(); return; }

      // 모든 학생이 보는 개념 안내 (동맥/정맥 오개념 예방)
      if (seg === 'pulm_artery' && t >= 0.4 && fire('note_pa')) {
        get().say([{ text: '여기는 "폐동맥"! 이름은 동맥인데 적혈구가 아직 보랏빛이지? 동맥은 "심장에서 나가는 혈관"이라는 뜻이야. 산소가 많다는 뜻이 아니야!', mood: 'think' }]);
      }
      if (seg === 'lung_cap' && t >= 0.15 && fire('note_lung')) {
        get().say([{ text: '폐에 도착! 혈관이 아주 가늘어졌어. 이게 모세혈관이야. 주위의 동그란 주머니가 허파꽈리야.', mood: 'normal' }]);
      }
      if (seg === 'pulm_vein' && t >= 0.3 && fire('note_pv')) {
        get().say([{ text: '여기는 "폐정맥". 정맥은 심장으로 들어가는 혈관이야. 그런데 산소가 많은 빨간 혈액이 흐르고 있지? 지도의 색과 선 모양을 비교해 봐!', mood: 'think' }]);
      }
      if (seg === 'lv' && t >= 0.35 && fire('note_lv')) {
        get().say([{ text: '좌심실은 벽 근육이 가장 두꺼워. 온몸 구석구석까지 혈액을 힘차게 밀어 보내야 하거든!', mood: 'normal' }]);
      }
      if (seg === 'vena_cava' && t >= 0.55 && ck === 'start' && fire('note_vc')) {
        get().say([{ text: '보랏빛 적혈구는 산소를 근육에 내려 주고 돌아오는 중이야. 대정맥은 심장으로 들어가는 혈관이지.', mood: 'normal' }]);
      }
    },

    chooseGate(optionId) {
      const g = get().gate;
      if (!g) return;
      const opt = g.def.options.find((o) => o.id === optionId);
      if (!opt) return;
      app().updateProgress((p) => recordChoice(p, g.def.id, opt.id, opt.correct));
      if (!opt.correct) {
        ship.bump = 1;
        ship.t = Math.max(0, ship.t - 0.08);
        const wrong = g.wrong + 1;
        // 1회: 관찰 힌트 · 2회 이상: 시각 힌트(정답 쪽 흐름 강조) — 벌점 없음
        const hint = g.def.hints[Math.min(wrong - 1, 1)];
        set({ gate: { ...g, wrong, message: `${opt.feedback}\n💡 ${hint}`, highlight: wrong >= 2 } });
        voice(opt.feedback);
        return;
      }
      const gatesDone = [...get().gatesDone, g.def.id];
      set({ gate: null, gatesDone, phase: 'travel' });
      if (opt.to && SEG[opt.to]) {
        placeShip(opt.to, 0.01);
        ship.speed = 3;
      }
      const allDone = GATES.every((x) => gatesDone.includes(x.id));
      if (allDone) {
        // 갈림길 실수 횟수로 처음 질문 수준을 정한다 (많이 헤맨 학생은 쉬운 질문부터)
        const wrongs = app().progress?.choices.filter((c) => !c.correct && GATES.some((x) => x.id === c.gateId)).length ?? 0;
        const level: Level = wrongs >= 3 ? 'beginner' : get().level;
        set({ level, objective: OBJECTIVES.m2_heart });
        const flowMastery = Math.max(40, 100 - wrongs * 15);
        app().updateProgress((p) => ({ ...p, level, mastery: { ...p.mastery, flow_direction: Math.max(p.mastery.flow_direction ?? 0, flowMastery) } }));
        setCheckpoint('m1_done');
        get().say([
          { text: g.def.success, mood: 'happy' },
          { text: '미션 1 완료! 혈액이 지나는 길을 직접 찾아냈어. 이제 폐동맥 입구에서 심장이 일하는 모습을 관찰하자.', mood: 'happy' },
        ]);
      } else {
        set({ objective: { ...OBJECTIVES.m1, target: 'rv' } });
        get().say([{ text: g.def.success, mood: 'happy' }]);
      }
    },

    endCinematic() {
      const c = get().cinematic;
      cam.mode = 'chase';
      set({ cinematic: null });
      c?.next();
    },

    async submitAnswer(text) {
      const q = get().question;
      if (!q || !text.trim()) return;
      set({ phase: 'assessing', lastAnswer: text });
      const a = await assess({ questionId: q.questionId, answer: text, attempt: q.attempt, branches: branchesFor(q) });
      const level = updateLevel(get().level, a);
      app().updateProgress((p) => ({ ...recordAttempt(p, q.questionId, 'game', q.attempt, text, a), level }));
      const step = decideNext(q, a);
      set({ phase: 'feedback', assessment: a, pending: step, level });
      voice(a.feedback);
    },

    continueAfterFeedback() {
      const step = get().pending;
      const q = get().question;
      if (!step || !q) return;
      switch (step.type) {
        case 'retry':
          askQuestion(step.question, step.hint);
          break;
        case 'lab':
          set({ phase: 'lab', lab: { id: step.lab, then: step.then } });
          break;
        case 'scaffold':
          set({ phase: 'scaffold', scaffoldId: step.questionId });
          break;
        case 'ask':
          if (step.reason === 'challenge') {
            sim.alarm = 1;
            set({ banner: { icon: '⚠', text: '심화 사건 발생! 탐사대원의 추리력이 필요해', tone: 'alert' } });
          }
          askQuestion(step.question, null);
          break;
        case 'advance':
          completeMission(q.missionId);
          break;
      }
    },

    finishLab() {
      const lab = get().lab;
      if (!lab) return;
      set({ lab: null });
      askQuestion(lab.then, '실험에서 본 것을 떠올리며 다시 말해 봐!');
    },

    finishScaffold() {
      const q = get().question;
      set({ scaffoldId: null });
      if (q) completeMission(q.missionId);
    },
  };
});
