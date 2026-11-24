// 에피소드 1 학습 내용: 핵심 개념, 질문, 데모 채점 규칙.
// 데모 채점 규칙(pattern)은 '같은 단어'가 아니라 같은 의미의 여러 표현을 넓게 받도록 만든다.
// 공백을 모두 지운 문장에 대해 검사한다 (normalizeAnswer 참고).

import type { ConceptId, QuestionKind, Stage } from './types';

export interface ConceptDef {
  id: ConceptId;
  label: string; // 학생에게 보이는 말
  description: string; // AI 채점자에게 주는 정의
  patterns: RegExp[]; // 데모 채점: 하나라도 맞으면 그 개념을 설명한 것으로 본다
}

export const CONCEPTS: Record<ConceptId, ConceptDef> = {
  flow_direction: {
    id: 'flow_direction',
    label: '혈액은 정해진 한 방향으로 돈다',
    description:
      '혈액은 심장→동맥→온몸→정맥→심장, 심장→폐→심장의 정해진 한 방향으로 순환하며 판막이 역류를 막는다.',
    patterns: [
      /한쪽?방향/, /정해진(길|방향|순서)/, /거꾸로.{0,6}(안|않|못|막)/, /반대로.{0,6}(안|않|못|막)/,
      /되돌아.{0,4}(안|않|못)/, /순환/, /돌고돌/, /(다시|또).{0,4}심장으로/, /빙(빙|글)/, /(문|판막).{0,8}(막|닫)/,
    ],
  },
  heart_pump: {
    id: 'heart_pump',
    label: '심장은 펌프처럼 혈액을 밀어 보낸다',
    description: '심장은 근육으로 된 펌프로, 수축(오므라듦)하면서 혈액을 혈관으로 밀어 내보낸다.',
    patterns: [
      /펌프/, /밀어/, /밀(고|면|어서)/, /쥐어짜/, /짜(서|주|내|듯)/, /수축/, /오므/, /조여|조이/, /꽉/, /뿜/,
      /내보내|내보냄/, /(피|혈액)를?.{0,6}보내/, /(피|혈액)를?.{0,6}(돌려|돌게|순환시)/, /쭉쭉|팍팍/,
    ],
  },
  lung_exchange: {
    id: 'lung_exchange',
    label: '폐에서 산소를 받고 이산화탄소를 내보낸다',
    description:
      '폐(허파꽈리)에서 혈액은 산소를 받아들이고 이산화탄소를 내보낸다. 그래서 산소가 적던 혈액이 산소가 많은 혈액이 된다.',
    patterns: [
      /산소를?.{0,8}(받|얻|충전|채우|채워|가져|흡수|넣|싣|실어|담)/,
      /(폐|허파).{0,12}산소.{0,6}(들어|받|얻|채)/,
      /이산화탄소.{0,10}(내보|버리|버려|빼|나가|내뱉|내쉬|배출|내놓|두고)/,
      /(산소|공기).{0,4}(교환|바꾸|바꿔|바뀌)/,
      /산소가?.{0,4}들어/,
    ],
  },
  oxygen_transport: {
    id: 'oxygen_transport',
    label: '혈액은 산소를 온몸에 나른다',
    description: '혈액(적혈구)은 산소를 온몸의 근육과 기관으로 운반하고, 이산화탄소를 거두어 온다.',
    patterns: [
      /산소.{0,10}(나르|날라|나름|운반|배달|전달|가져다|실어|공급|보내|보냄|주|줘|줬|준)/,
      /(온몸|전신|몸구석|몸곳곳|몸전체|근육|세포|팔|다리|뇌|머리|발).{0,10}산소/,
      /산소.{0,10}(온몸|전신|몸구석|몸곳곳|몸전체|근육|세포|팔|다리|뇌|머리|발)/,
      /이산화탄소.{0,10}(싣|실어|거두|가져|모아|담아)/,
      /(영양|에너지).{0,6}(나르|운반|배달|전달)/,
    ],
  },
  exercise_response: {
    id: 'exercise_response',
    label: '운동하면 근육이 산소를 더 많이 써서 심장이 빨리 뛴다',
    description:
      '운동하면 근육이 일을 많이 해서 산소가 더 필요하다. 심장은 더 빨리(세게) 뛰어 산소가 많은 혈액을 더 많이 보내고, 숨도 가빠진다.',
    patterns: [
      /(근육|몸).{0,12}(산소|에너지).{0,8}(더|많이|부족|모자|필요)/,
      /(산소|에너지).{0,8}(더|많이).{0,6}(필요|써|쓰|사용|소모)/,
      /(산소|에너지).{0,6}(부족|모자)/,
      /(빨리|빠르게|많이|더).{0,8}(보내|나르|공급|배달|전달)/,
    ],
  },
  artery_vein: {
    id: 'artery_vein',
    label: '동맥은 심장에서 나가는 혈관, 정맥은 심장으로 들어오는 혈관',
    description:
      '동맥과 정맥은 산소량이 아니라 혈액이 흐르는 방향으로 나뉜다. 동맥은 심장에서 나가는 혈관, 정맥은 심장으로 돌아오는 혈관이다. 폐동맥에는 산소가 적은 혈액, 폐정맥에는 산소가 많은 혈액이 흐른다.',
    patterns: [
      /동맥.{0,12}(심장에서|나가|나오|출발)/, /(심장에서|심장으로부터).{0,10}(나가|나오|출발).{0,10}동맥/,
      /정맥.{0,12}(심장으로|들어|돌아)/, /(방향|어디로|나가는지|들어오는지).{0,10}(기준|나눠|나누|구분)/,
    ],
  },
};

export interface MisconceptionDef {
  id: string;
  label: string;
  pattern: RegExp;
  /** 정답을 말하지 않고 다시 생각하게 하는 질문 */
  probe: string;
}

export const MISCONCEPTIONS: Record<string, MisconceptionDef> = {
  heart_makes_oxygen: {
    id: 'heart_makes_oxygen',
    label: '심장이 산소를 만든다',
    pattern: /심장.{0,8}산소.{0,4}(만들|만드|생기|생산)/,
    probe: '심장을 지나는 동안 적혈구 색이 바뀌었니? 심장이 산소를 만든다면 색이 바뀌어야 하지 않을까?',
  },
  heart_makes_blood: {
    id: 'heart_makes_blood',
    label: '심장이 피를 만든다',
    pattern: /(심장|펌프).{0,8}(피|혈액).{0,4}(만들|만드|생산)|(피|혈액)를?만들(?!지않|지는않|지못)/,
    probe: '심장은 피를 새로 만드는 곳일까, 아니면 이미 있는 피를 움직이는 곳일까?',
  },
  artery_always_oxygen: {
    id: 'artery_always_oxygen',
    label: '동맥에는 항상 산소가 많은 혈액이 흐른다',
    pattern: /동맥.{0,10}(항상|언제나|무조건|모두|다).{0,8}산소.{0,4}많/,
    probe: '폐동맥 안의 적혈구는 무슨 색이었지? 그 혈액에는 산소가 많았을까?',
  },
  lung_pumps_blood: {
    id: 'lung_pumps_blood',
    label: '폐가 혈액을 밀어 보낸다',
    pattern: /(폐|허파).{0,6}(피|혈액).{0,6}(밀어|펌프|뿜)/,
    probe: '혈액을 밀어 보내는 펌프는 폐일까, 다른 기관일까?',
  },
  blood_backward_ok: {
    id: 'blood_backward_ok',
    label: '혈액은 거꾸로도 흐를 수 있다',
    pattern: /(거꾸로|반대로|양쪽으로).{0,4}(흘러도|가도|흐를수있|갈수있|왔다갔다)/,
    probe: '심장 안의 문(판막)은 어떤 방향으로만 열렸는지 다시 떠올려 봐.',
  },
  exercise_less_oxygen_need: {
    id: 'exercise_less_oxygen_need',
    label: '운동하면 산소가 덜 필요하다',
    pattern: /(운동|달리|뛰).{0,12}산소.{0,6}(덜|적게|필요없|안필요)/,
    probe: '달릴 때 근육은 쉴 때보다 일을 더 할까, 덜 할까? 일을 하려면 무엇이 필요하지?',
  },
};

export const REASONING_CONNECTORS =
  /[가-힣](아|어|여|워|와|내|해|돼|져|쳐|라)서|왜냐하면|때문|그래서|그러니까|니까|므로|해서|하려고|하기위해|위해서|위해|려고|덕분|그러면|그럼|면.{0,6}(되|돼|해|하|져|진)/;

export type MissionId = 'm2_heart' | 'm3_lungs' | 'm4_running' | 'm5_final';

export interface QuestionDef {
  id: string;
  stage: Stage;
  missionId?: MissionId;
  kind: QuestionKind;
  prompt: string;
  /** 이 질문에서 꼭 드러나야 하는 개념 */
  targets: ConceptId[];
  /** AI 채점자에게 주는 '좋은 답'의 의미 기준 (단어 목록이 아님) */
  criteria: string;
  /** 응용 질문에서 데모 채점이 확인하는 '새 상황 적용' 요소 */
  application?: { label: string; pattern: RegExp }[];
  misconceptions: string[];
  /** 정답을 주지 않는 단계별 힌트 */
  hints: [string, string];
  /** 데모 모드에서 테스트용으로 고를 수 있는 예시 답변 */
  demoAnswers: { good: string; partial: string; wrong: string };
  /** 빈칸 채우기 (실험실 후에도 어려워할 때 함께 정리) */
  scaffold?: { sentence: string; blanks: { options: string[]; answer: string }[] };
}

const Q: QuestionDef[] = [
  // ───────── 미션 2: 심장의 역할 ─────────
  {
    id: 'm2_main', stage: 'game', missionId: 'm2_heart', kind: 'concept',
    prompt: '방금 관찰한 심장은 무슨 일을 하고 있었을까? 네 말로 설명해 줘.',
    targets: ['heart_pump', 'oxygen_transport'],
    criteria: '심장이 오므라들며(수축) 혈액을 밀어 혈관으로 보낸다는 것, 그 결과 혈액이 온몸(또는 폐)으로 이동한다는 것을 설명한다. "펌프" 같은 단어가 없어도 "꽉 짜서 피를 보낸다" 같은 표현이면 인정한다.',
    misconceptions: ['heart_makes_oxygen', 'heart_makes_blood', 'lung_pumps_blood'],
    hints: [
      '심장이 꽉 오므라들 때, 안에 있던 적혈구들은 어디로 갔는지 다시 떠올려 봐.',
      '물풍선을 손으로 꽉 쥐면 물이 어떻게 될까? 심장도 비슷한 일을 해.',
    ],
    demoAnswers: {
      good: '심장이 펌프처럼 꽉 조였다 풀었다 하면서 피를 밀어서 온몸으로 보내 줘요. 그래야 산소가 몸 곳곳에 가요.',
      partial: '음... 심장이 쿵쿵 뛰면서 피를 보내요.',
      wrong: '심장이 산소를 만들어요.',
    },
    scaffold: {
      sentence: '심장은 [ ]처럼 오므라들면서 혈액을 [ ] 보낸다.',
      blanks: [
        { options: ['펌프', '스펀지', '필터'], answer: '펌프' },
        { options: ['밀어', '멈춰', '만들어'], answer: '밀어' },
      ],
    },
  },
  {
    id: 'm2_easy', stage: 'game', missionId: 'm2_heart', kind: 'concept',
    prompt: '심장이 꽉 오므라들면 안에 있던 피는 어떻게 될까? 짧게 말해도 괜찮아.',
    targets: ['heart_pump'],
    criteria: '심장이 오므라들면 혈액이 밖(혈관)으로 밀려 나간다는 것을 말한다.',
    misconceptions: ['heart_makes_blood'],
    hints: ['아까 실험에서 통을 누르면 물이 어디로 갔는지 떠올려 봐.', '누르면 → 밀려서 → 어디로?'],
    demoAnswers: {
      good: '꽉 짜지니까 피가 밖으로 밀려 나가요.',
      partial: '피가 움직여요.',
      wrong: '피가 만들어져요.',
    },
  },
  {
    id: 'm2_follow', stage: 'game', missionId: 'm2_heart', kind: 'reasoning',
    prompt: '좋아! 그런데 심장은 왜 잠잘 때도 쉬지 않고 계속 뛰어야 할까?',
    targets: ['heart_pump', 'oxygen_transport'],
    criteria: '몸의 모든 부분이 계속 산소(와 영양분)를 필요로 하므로 심장이 계속 혈액을 보내야 한다는 원인-결과를 설명한다.',
    misconceptions: ['heart_makes_oxygen'],
    hints: ['잠잘 때도 우리 몸의 근육과 뇌는 무엇을 계속 필요로 할까?', '혈액이 멈추면 몸 곳곳에 무엇이 도착하지 못할까?'],
    demoAnswers: {
      good: '잘 때도 몸이 계속 산소가 필요하니까 심장이 피를 계속 보내서 산소를 날라야 해요.',
      partial: '안 뛰면 죽으니까요.',
      wrong: '심장이 피를 만들어야 해서요.',
    },
  },
  {
    id: 'm2_challenge', stage: 'game', missionId: 'm2_heart', kind: 'application',
    prompt: '⚠ 판막 경보! 심장 속 문(판막)이 제대로 닫히지 않는 사람이 있대. 이 사람의 심장 속에서 혈액 흐름에 어떤 일이 생길까?',
    targets: ['flow_direction', 'heart_pump'],
    criteria: '판막이 혈액의 역류를 막아 한 방향 흐름을 만든다는 것을 적용해, 닫히지 않으면 일부 혈액이 거꾸로 새어 돌아가 한 번에 보내는 혈액이 줄고 심장이 더 힘들게 일한다는 것을 추리한다.',
    application: [
      { label: '혈액이 거꾸로 샌다', pattern: /(거꾸로|반대로|뒤로|역류|되돌아|새)/ },
      { label: '앞으로 보내는 혈액이 줄거나 심장이 더 힘들다', pattern: /(덜|적게|줄|모자|부족|힘들|무리|더많이뛰|더세게|빨리뛰)/ },
    ],
    misconceptions: ['blood_backward_ok'],
    hints: ['판막이 닫힐 때, 혈액이 어느 쪽으로 못 가게 막아 주었지?', '문이 열린 채로 펌프를 누르면 물이 전부 앞으로만 갈까?'],
    demoAnswers: {
      good: '판막이 안 닫히면 피가 거꾸로 새서 뒤로 돌아가요. 그래서 앞으로 보내는 피가 줄어들고 심장이 더 힘들게 일해야 해요.',
      partial: '피가 이상하게 흘러요.',
      wrong: '아무 일도 안 생겨요. 피는 거꾸로 흘러도 돼요.',
    },
  },

  // ───────── 미션 3: 폐에서 산소 얻기 ─────────
  {
    id: 'm3_main', stage: 'game', missionId: 'm3_lungs', kind: 'reasoning',
    prompt: '폐를 지나면서 적혈구 색이 바뀌었어! 폐에서 혈액에 어떤 일이 일어났고, 혈액은 왜 꼭 폐를 지나야 할까?',
    targets: ['lung_exchange', 'oxygen_transport'],
    criteria: '폐에서 혈액이 산소를 받고 이산화탄소를 내보낸다(최소한 산소를 받는다)는 것, 그 산소를 온몸에 나르기 위해 폐를 지나야 한다는 원인-결과를 연결한다.',
    misconceptions: ['heart_makes_oxygen', 'lung_pumps_blood'],
    hints: [
      '반짝이는 파란 알갱이(산소)는 어디에서 어디로 이동했니?',
      '혈액이 폐에서 받은 것을 나중에 어디에 가져다줄까?',
    ],
    demoAnswers: {
      good: '폐에서 혈액이 산소를 받고 이산화탄소를 내보내요. 그래서 산소가 많아진 피가 온몸에 산소를 나를 수 있어요.',
      partial: '피 색깔이 빨개졌어요. 산소가 들어간 것 같아요.',
      wrong: '폐가 피를 펌프처럼 밀어 줘요.',
    },
    scaffold: {
      sentence: '폐에서 혈액은 [ ]를 받고 [ ]를 내보낸다.',
      blanks: [
        { options: ['산소', '이산화탄소', '물'], answer: '산소' },
        { options: ['이산화탄소', '산소', '영양분'], answer: '이산화탄소' },
      ],
    },
  },
  {
    id: 'm3_easy', stage: 'game', missionId: 'm3_lungs', kind: 'concept',
    prompt: '폐에서 반짝이는 파란 알갱이(산소)는 어디로 들어갔어?',
    targets: ['lung_exchange'],
    criteria: '산소가 폐(허파꽈리)에서 혈액(적혈구) 속으로 들어간다는 것을 말한다.',
    misconceptions: [],
    hints: ['적혈구 색이 바뀌는 순간을 다시 봐.', '산소 알갱이가 빨간 원반(적혈구)에 닿으면 무슨 일이 생겼지?'],
    demoAnswers: {
      good: '산소가 폐에서 피 속 적혈구로 들어갔어요. 그래서 산소를 받았어요.',
      partial: '적혈구요.',
      wrong: '밖으로 나갔어요.',
    },
  },
  {
    id: 'm3_follow', stage: 'game', missionId: 'm3_lungs', kind: 'reasoning',
    prompt: '숨을 내쉴 때 나가는 공기에는 무엇이 더 많을까? 그건 어디에서 왔을까?',
    targets: ['lung_exchange', 'oxygen_transport'],
    criteria: '내쉬는 숨에는 이산화탄소가 더 많고, 그것은 온몸에서 혈액이 거두어 와 폐에서 내보낸 것이라고 연결한다.',
    misconceptions: [],
    hints: ['폐에서 회색 알갱이는 어느 쪽으로 나갔지?', '그 회색 알갱이는 혈액이 어디를 돌다가 싣고 온 걸까?'],
    demoAnswers: {
      good: '이산화탄소가 많아요. 온몸을 돌던 혈액이 이산화탄소를 싣고 와서 폐에서 내보내니까요.',
      partial: '이산화탄소요.',
      wrong: '산소가 더 많아요.',
    },
  },
  {
    id: 'm3_challenge', stage: 'game', missionId: 'm3_lungs', kind: 'application',
    prompt: '🔍 이상한 이름 사건! 방금 지나온 "폐동맥"은 이름에 "동맥"이 있는데 산소가 적은 혈액이 흘렀어. 그럼 동맥과 정맥은 무엇을 기준으로 나누는 걸까?',
    targets: ['artery_vein'],
    criteria: '동맥/정맥은 산소량이 아니라 혈액이 심장에서 나가는지(동맥), 심장으로 들어오는지(정맥)로 나뉜다는 것을 폐동맥·폐정맥 사례에 적용한다.',
    application: [
      { label: '심장에서 나가는 쪽 = 동맥', pattern: /(심장에서|심장으로부터).{0,10}(나가|나오|출발)|나가는.{0,6}(혈관|쪽|게|것)/ },
      { label: '심장으로 들어오는 쪽 = 정맥', pattern: /(심장으로).{0,8}(들어|돌아|오는)|들어오는.{0,6}(혈관|쪽|게|것)/ },
    ],
    misconceptions: ['artery_always_oxygen'],
    hints: ['폐동맥은 심장에서 출발했어, 아니면 심장으로 도착했어?', '대동맥과 폐동맥의 공통점은 혈액이 어디에서 출발한다는 거지?'],
    demoAnswers: {
      good: '산소가 많고 적은 게 아니라 방향으로 나눠요. 심장에서 나가는 혈관이 동맥이고 심장으로 들어오는 혈관이 정맥이에요.',
      partial: '방향이 다른 것 같아요.',
      wrong: '동맥은 항상 산소가 많은 피가 흘러요.',
    },
  },

  // ───────── 미션 4: 달리기 사건 ─────────
  {
    id: 'm4_main', stage: 'game', missionId: 'm4_running', kind: 'reasoning',
    prompt: '이 사람이 달리기 시작하자 심장이 훨씬 빨리 뛰기 시작했어! 왜 그럴까? 근육을 떠올리며 추리해 봐.',
    targets: ['exercise_response', 'oxygen_transport', 'heart_pump'],
    criteria: '달리면 근육이 일을 많이 해 산소가 더 필요하다 → 심장이 빨리 뛰어 산소를 실은 혈액을 더 많이/빨리 보낸다는 원인-결과를 연결한다.',
    misconceptions: ['exercise_less_oxygen_need', 'heart_makes_oxygen'],
    hints: ['달리는 동안 다리 근육은 쉴 때보다 무엇이 더 필요할까?', '그 필요한 것을 근육까지 실어 오는 건 누구고, 그걸 밀어 보내는 건 누구지?'],
    demoAnswers: {
      good: '달리면 다리 근육이 산소를 더 많이 써요. 그래서 심장이 빨리 뛰어서 산소가 많은 피를 근육에 더 많이 보내 줘요.',
      partial: '달리면 근육이 산소가 더 필요해요.',
      wrong: '달리면 산소가 덜 필요해서요.',
    },
    scaffold: {
      sentence: '달리면 근육이 [ ]를 더 많이 쓰기 때문에 심장이 [ ] 뛰어 혈액을 더 많이 보낸다.',
      blanks: [
        { options: ['산소', '이산화탄소', '물'], answer: '산소' },
        { options: ['빨리', '느리게', '멈춰서'], answer: '빨리' },
      ],
    },
  },
  {
    id: 'm4_easy', stage: 'game', missionId: 'm4_running', kind: 'concept',
    prompt: '달릴 때 근육은 산소가 더 필요할까, 덜 필요할까? 그럼 심장은 어떻게 뛸까?',
    targets: ['exercise_response'],
    criteria: '달리면 근육이 산소를 더 필요로 하고, 그래서 심장이 더 빨리 뛴다는 것을 말한다.',
    misconceptions: ['exercise_less_oxygen_need'],
    hints: ['실험실에서 달리기 속도를 올렸을 때 산소 필요 막대는 어떻게 됐지?', '필요한 게 많아지면 배달도 더 자주 해야 하겠지?'],
    demoAnswers: {
      good: '더 필요해요. 그래서 심장이 빨리 뛰어서 산소를 더 많이 보내요.',
      partial: '더 필요해요.',
      wrong: '덜 필요해요.',
    },
  },
  {
    id: 'm4_follow', stage: 'game', missionId: 'm4_running', kind: 'reasoning',
    prompt: '달릴 때 심장만 빨라질까? 숨쉬기는 어떻게 변하고, 그건 왜 필요할까?',
    targets: ['exercise_response', 'lung_exchange'],
    criteria: '숨도 빨라지고 깊어져 폐에서 산소를 더 많이 받아들이고 이산화탄소를 더 많이 내보낸다는 것을 심장 박동 변화와 연결한다.',
    misconceptions: [],
    hints: ['달리고 나면 숨이 어떻게 되지?', '심장이 혈액을 많이 보내도, 그 혈액이 폐에서 무엇을 충분히 받아야 할까?'],
    demoAnswers: {
      good: '숨도 빨라져요. 폐에서 산소를 더 많이 받고 이산화탄소를 더 많이 내보내야 하니까요.',
      partial: '숨이 차요.',
      wrong: '숨은 그대로예요.',
    },
  },

  // ───────── 최종 응용 문제 (이전 설명 반복으로는 풀 수 없는 새 상황) ─────────
  {
    id: 'final_normal', stage: 'game', missionId: 'm5_final', kind: 'application',
    prompt: '🏔 마지막 사건! 탐사 대상이 아주 높은 산에 올라갔어. 그곳 공기에는 산소가 평소보다 적어. 가만히 서 있어도 숨쉬기와 심장 박동은 어떻게 변할까? 이유도 연결해서 말해 줘.',
    targets: ['lung_exchange', 'oxygen_transport', 'heart_pump'],
    criteria: '공기 속 산소가 적어 폐에서 혈액이 받는 산소가 줄어든다 → 근육/몸에 도착하는 산소가 부족해진다 → 숨이 빨라지고 심장이 빨리 뛰어 혈액을 더 자주 폐와 몸으로 보낸다. 산소 부족과 호흡·심박 변화를 인과로 잇는다.',
    application: [
      { label: '폐에서 받는 산소가 줄어든다', pattern: /(산소).{0,10}(적|부족|모자|덜|줄)/ },
      { label: '숨이 빨라진다', pattern: /숨.{0,8}(빨리|빨라|빠르|가빠|헐떡|많이|자주|더|차)/ },
      { label: '심장이 빨리 뛴다', pattern: /(심장|심박|맥박|박동).{0,8}(빨리|빨라|빠르|더|세게|많이|올라)/ },
    ],
    misconceptions: ['heart_makes_oxygen', 'exercise_less_oxygen_need'],
    hints: ['산소가 적은 공기를 마시면 폐에서 혈액이 받는 산소는 어떻게 될까?', '근육에 산소가 부족하면, 달리기 사건 때 심장과 숨이 어떻게 대응했지?'],
    demoAnswers: {
      good: '공기에 산소가 적어서 폐에서 피가 받는 산소가 부족해요. 그래서 숨을 더 빨리 쉬고 심장도 빨리 뛰어서 산소를 더 많이 실어 보내려고 해요.',
      partial: '숨이 차요. 산소가 적으니까요.',
      wrong: '산은 시원해서 심장이 느려져요.',
    },
  },
  {
    id: 'final_easy', stage: 'game', missionId: 'm5_final', kind: 'application',
    prompt: '🏔 마지막 사건! 높은 산에서는 공기 속 산소가 적어. 그곳에서는 숨을 더 자주 쉬게 될까, 덜 쉬게 될까? 왜 그럴까?',
    targets: ['lung_exchange', 'oxygen_transport'],
    criteria: '산소가 적은 공기에서는 산소를 충분히 얻기 위해 숨을 더 자주 쉰다는 원인-결과를 말한다.',
    application: [
      { label: '숨을 더 자주 쉰다', pattern: /(더|많이|자주|빨리).{0,6}(쉬|쉰|쉼)|숨.{0,6}(빨리|가빠|차|자주|많이)/ },
      { label: '산소를 더 얻으려고', pattern: /산소.{0,10}(적|부족|모자|더|얻|받|채)/ },
    ],
    misconceptions: [],
    hints: ['공기 한 모금에 들어 있는 산소가 적다면, 같은 양의 산소를 얻으려면?', '폐에서 혈액이 받을 산소가 모자라면 몸은 어떻게 할까?'],
    demoAnswers: {
      good: '더 자주 쉬어요. 공기에 산소가 적으니까 산소를 충분히 받으려고요.',
      partial: '더 자주 쉬어요.',
      wrong: '덜 쉬어요.',
    },
  },
  {
    id: 'final_deep', stage: 'game', missionId: 'm5_final', kind: 'application',
    prompt: '🏅 심화 사건! 오래 훈련한 운동선수는 쉬고 있을 때 오히려 심장 박동이 보통 사람보다 느린 경우가 많아. 그런데도 몸에 산소가 부족하지 않아. 심장이 한 번 뛸 때 보내는 혈액의 양과 연결해서 이유를 추리해 봐.',
    targets: ['heart_pump', 'oxygen_transport'],
    criteria: '훈련으로 심장 근육이 강해져 한 번 수축할 때 더 많은 혈액을 내보내므로, 적게 뛰어도 같은 양의 산소를 실은 혈액을 몸에 보낼 수 있다는 추리. (보낸 혈액량 = 1회 박출량 × 박동 수의 개념을 쉬운 말로)',
    application: [
      { label: '한 번에 더 많은 혈액을 보낸다', pattern: /(한번|한번에|1번|한꺼번에).{0,12}(많이|많은|더)|(많이|더).{0,8}(보내|밀어|내보)/ },
      { label: '심장이 강해졌다', pattern: /(심장|근육).{0,8}(강|튼튼|크|세|힘)/ },
      { label: '그래서 적게 뛰어도 산소가 충분하다', pattern: /(적게|느리게|천천히|덜).{0,12}(충분|괜찮|돼|되|부족하지)/ },
    ],
    misconceptions: ['heart_makes_oxygen'],
    hints: ['물을 나르는 사람이 큰 양동이를 쓰면, 몇 번만 왔다 갔다 해도 될까?', '훈련하면 심장 근육은 어떻게 변할까? 그럼 한 번 짤 때 나가는 혈액은?'],
    demoAnswers: {
      good: '훈련해서 심장 근육이 튼튼해지면 한 번 뛸 때 피를 더 많이 보내요. 그래서 느리게 뛰어도 산소가 충분히 가요.',
      partial: '운동선수 심장이 튼튼해서요.',
      wrong: '운동선수는 산소가 필요 없어서요.',
    },
  },

  // ───────── 복습 D+0 (게임 직후) ─────────
  {
    id: 'r0_heart', stage: 'review_d0', kind: 'concept',
    prompt: '오늘 본 심장이 하는 일을 친구에게 설명하듯 말해 줘.',
    targets: ['heart_pump', 'oxygen_transport'],
    criteria: '심장이 오므라들며 혈액을 밀어 온몸으로 보내 산소를 나르게 한다는 것.',
    misconceptions: ['heart_makes_oxygen', 'heart_makes_blood'],
    hints: ['심장을 무엇에 비유할 수 있을까?', '심장이 보낸 혈액은 무엇을 싣고 어디로 가지?'],
    demoAnswers: {
      good: '심장은 펌프처럼 피를 밀어서 온몸에 보내. 그 피가 산소를 날라 줘.',
      partial: '심장은 뛰어.',
      wrong: '심장은 산소를 만들어.',
    },
  },
  {
    id: 'r0_lung', stage: 'review_d0', kind: 'reasoning',
    prompt: '폐를 지나기 전과 지난 후, 혈액은 어떻게 달라졌니? 왜 그런지도 말해 줘.',
    targets: ['lung_exchange'],
    criteria: '폐를 지나기 전에는 산소가 적고 이산화탄소가 많은 혈액, 지난 후에는 산소를 받아 산소가 많은 혈액이 된다.',
    misconceptions: ['lung_pumps_blood'],
    hints: ['적혈구 색이 어떻게 바뀌었는지 떠올려 봐.', '폐에서 들어온 알갱이와 나간 알갱이는?'],
    demoAnswers: {
      good: '지나기 전엔 산소가 적었는데 폐에서 산소를 받고 이산화탄소를 내보내서 산소가 많아졌어요.',
      partial: '색이 바뀌었어요.',
      wrong: '폐가 피를 밀어 줘서 빨라졌어요.',
    },
  },
  {
    id: 'r0_why', stage: 'review_d0', kind: 'reasoning',
    prompt: '달리기를 할 때 심장이 빨리 뛰는 이유를 한 문장으로 말해 볼래?',
    targets: ['exercise_response'],
    criteria: '근육이 산소를 더 필요로 해서 심장이 혈액을 더 많이 보내려고 빨리 뛴다.',
    misconceptions: ['exercise_less_oxygen_need'],
    hints: ['달릴 때 근육에게 더 필요한 건?', '그걸 배달하려면 심장은?'],
    demoAnswers: {
      good: '근육이 산소를 더 많이 써서 심장이 피를 빨리 보내려고 빨리 뛰어요.',
      partial: '힘들어서요.',
      wrong: '산소가 덜 필요해서요.',
    },
  },

  // ───────── 복습 D+1 (다음 날: 기억 확인, 처음과 다른 질문) ─────────
  {
    id: 'r1_pulm', stage: 'review_d1', kind: 'reasoning',
    prompt: '어제 탐험에서 폐동맥 안을 지날 때, 그 안의 혈액은 산소가 많았을까 적었을까? 그렇게 생각한 이유는?',
    targets: ['lung_exchange', 'oxygen_transport'],
    criteria: '폐동맥 혈액은 아직 폐에 가기 전이라 산소가 적다. 온몸을 돌고 돌아온 혈액이기 때문. 동맥이라도 산소가 적을 수 있다.',
    application: [{ label: '산소가 적다', pattern: /(적|부족|모자|덜)/ }],
    misconceptions: ['artery_always_oxygen'],
    hints: ['폐동맥은 폐에 가기 전이야, 다녀온 후야?', '혈액이 산소를 받는 곳은 어디였지?'],
    demoAnswers: {
      good: '적었어요. 아직 폐에 가기 전이라 산소를 받지 못했고 온몸을 돌고 와서 산소를 다 줬으니까요.',
      partial: '적었어요.',
      wrong: '동맥은 항상 산소가 많아서 많았어요.',
    },
  },
  {
    id: 'r1_pump', stage: 'review_d1', kind: 'concept',
    prompt: '심장을 "펌프"에 비유한다면, 펌프의 어떤 점이 심장과 닮았을까?',
    targets: ['heart_pump', 'flow_direction'],
    criteria: '눌러(수축해) 액체를 밀어 보낸다는 점, 한 방향으로만 흐르게 하는 문(판막)이 있다는 점.',
    misconceptions: ['heart_makes_blood'],
    hints: ['펌프를 누르면 물은 어떻게 되지?', '펌프 안의 문은 물이 어느 쪽으로만 가게 하지?'],
    demoAnswers: {
      good: '펌프처럼 꽉 눌러서 피를 밀어내고, 판막이 있어서 한쪽 방향으로만 흐르게 해요.',
      partial: '둘 다 뭔가를 보내요.',
      wrong: '펌프처럼 피를 만들어요.',
    },
  },
  {
    id: 'r1_order', stage: 'review_d1', kind: 'concept',
    prompt: '혈액 한 방울이 폐에서 출발해 다시 폐로 돌아오기까지 어떤 곳들을 지나는지 순서대로 말해 줘.',
    targets: ['flow_direction'],
    criteria: '폐 → (폐정맥) → 심장(좌심방·좌심실) → (대동맥) → 온몸 → (대정맥) → 심장(우심방·우심실) → (폐동맥) → 폐. 심장을 두 번 지난다는 점이 핵심.',
    application: [
      { label: '심장으로 간다', pattern: /폐.{0,12}심장/ },
      { label: '온몸을 거친다', pattern: /(온몸|전신|몸|근육)/ },
      { label: '다시 심장을 거쳐 폐로', pattern: /심장.{0,20}폐/ },
    ],
    misconceptions: ['blood_backward_ok'],
    hints: ['폐에서 산소를 받은 혈액은 먼저 어디로 갈까?', '심장을 몇 번 지나는지 세어 봐.'],
    demoAnswers: {
      good: '폐에서 폐정맥으로 심장에 가고, 심장이 대동맥으로 온몸에 보내요. 온몸을 돌고 대정맥으로 다시 심장에 와서 폐동맥으로 폐에 가요. 한쪽 방향으로 돌아요.',
      partial: '폐에서 심장, 그리고 몸이요.',
      wrong: '폐에서 바로 몸으로 가요.',
    },
  },

  // ───────── 복습 D+3 (처음 보는 새 사건, 여러 개념 연결) ─────────
  {
    id: 'r3_narrow', stage: 'review_d3', kind: 'application',
    prompt: '🆕 새 사건! 어떤 사람의 다리로 가는 혈관 일부가 좁아졌어. 이 사람이 오래 걸으면 다리 근육은 어떤 문제를 겪을까? 심장·혈액·산소를 연결해서 설명해 줘.',
    targets: ['oxygen_transport', 'exercise_response'],
    criteria: '혈관이 좁아지면 다리 근육으로 가는 혈액(산소)이 줄어든다 → 걸을수록 근육은 산소가 더 필요한데 충분히 받지 못해 아프거나 쉽게 지친다. 심장이 더 빨리 뛰어도 좁은 길 때문에 충분히 못 갈 수 있다.',
    application: [
      { label: '다리로 가는 혈액·산소가 줄어든다', pattern: /(혈액|피|산소).{0,10}(덜|적게|부족|모자|못|줄|안)/ },
      { label: '걸을 때 근육이 아프거나 지친다', pattern: /(아프|아파|지치|힘들|쥐|저리|피곤|약해)/ },
    ],
    misconceptions: ['heart_makes_oxygen'],
    hints: ['길이 좁아지면 지나가는 혈액의 양은 어떻게 될까?', '걸을 때 근육에 필요한 건 많아지는데, 도착하는 것이 줄면?'],
    demoAnswers: {
      good: '혈관이 좁으면 다리로 가는 피가 줄어서 산소가 부족해요. 걸으면 근육이 산소를 더 많이 써야 하는데 모자라서 다리가 아프고 금방 지쳐요.',
      partial: '다리가 아파요.',
      wrong: '아무 문제 없어요. 심장이 산소를 더 만들면 돼요.',
    },
  },
  {
    id: 'r3_swim', stage: 'review_d3', kind: 'application',
    prompt: '🆕 새 사건! 수영하다가 물속에서 숨을 오래 참고 나오면 "하아하아" 하고 숨을 크게 몰아쉬게 돼. 몸속에서 어떤 일이 이어서 일어난 걸까?',
    targets: ['lung_exchange', 'oxygen_transport', 'exercise_response'],
    criteria: '숨을 참는 동안 폐에서 새 산소를 받지 못하고 이산화탄소가 쌓인다 → 근육은 계속 산소를 쓰므로 부족해진다 → 물 밖에서 크게 숨을 쉬어 산소를 빨리 받고 이산화탄소를 내보낸다(심장도 빨리 뛴다).',
    application: [
      { label: '숨 참는 동안 산소를 못 받는다', pattern: /(산소).{0,10}(못|부족|모자|안들어|줄|떨어)/ },
      { label: '이산화탄소가 쌓인다/내보낸다', pattern: /이산화탄소/ },
      { label: '크게 숨쉬어 산소를 채운다', pattern: /(숨|호흡).{0,12}(산소|채우|받|들이)|(산소).{0,8}(채우|받|들이|보충)/ },
    ],
    misconceptions: [],
    hints: ['숨을 참는 동안 폐에서는 무엇이 들어오지 못할까?', '그동안 근육은 산소 쓰기를 멈출까?'],
    demoAnswers: {
      good: '숨을 참는 동안 폐로 산소가 못 들어오고 이산화탄소가 쌓여요. 근육은 계속 산소를 써서 부족해지니까 나와서 크게 숨을 쉬어 산소를 받아 채우는 거예요.',
      partial: '숨이 모자라서요.',
      wrong: '물이 차가워서요.',
    },
  },
  {
    id: 'r3_cold', stage: 'review_d3', kind: 'application',
    prompt: '🆕 새 사건! 줄넘기 100번을 하고 나니 얼굴이 빨개지고 심장이 쿵쾅거렸어. 쉬고 몇 분 지나자 다시 원래대로 돌아왔어. 왜 다시 느려졌을까?',
    targets: ['exercise_response', 'oxygen_transport'],
    criteria: '운동을 멈추면 근육이 쓰는 산소가 줄어든다 → 혈액을 많이 보낼 필요가 줄어 심장 박동이 원래대로 느려진다. 필요(수요)에 맞춰 심장이 조절된다는 적용.',
    application: [
      { label: '쉬면 근육의 산소 필요가 줄어든다', pattern: /(산소|에너지).{0,10}(덜|적게|줄|필요없|안필요)|(쉬|멈추|안뛰).{0,12}(덜|줄|필요)/ },
      { label: '그래서 심장이 덜 빨리 뛰어도 된다', pattern: /(심장|박동|심박).{0,10}(느려|천천히|원래|줄|덜)|(빨리|많이).{0,6}(안|않|필요없)/ },
    ],
    misconceptions: ['exercise_less_oxygen_need'],
    hints: ['쉬고 있을 때 근육이 쓰는 산소는 운동할 때보다 많을까, 적을까?', '필요한 산소가 줄면 심장은 계속 빨리 뛸 필요가 있을까?'],
    demoAnswers: {
      good: '쉬면 근육이 산소를 덜 쓰니까 피를 많이 보낼 필요가 줄어서 심장이 원래대로 느려져요.',
      partial: '쉬어서요.',
      wrong: '심장이 지쳐서 멈추려고 해서요.',
    },
  },
];

export const QUESTIONS: Record<string, QuestionDef> = Object.fromEntries(Q.map((q) => [q.id, q]));

export function getQuestion(id: string): QuestionDef {
  const q = QUESTIONS[id];
  if (!q) throw new Error(`Unknown question: ${id}`);
  return q;
}

export const REVIEW_SETS: Record<Exclude<Stage, 'game'>, string[]> = {
  review_d0: ['r0_heart', 'r0_lung', 'r0_why'],
  review_d1: ['r1_pulm', 'r1_pump', 'r1_order'],
  review_d3: ['r3_narrow', 'r3_swim', 'r3_cold'],
};
