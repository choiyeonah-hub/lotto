/**
 * 로컬 대화 모드(규칙 기반). LLM API가 없을 때 실제로 동작하는 '어린 나와의 대화'.
 * 흐름: 공감 → 판단 없는 질문 하나 → 어린 나에게 해줄 말 → 지금의 나에게도? → 물건에 저장.
 * 언제든 '그만할래'로 조용히 끝낼 수 있고, 위기 표현에는 도움 연락처를 먼저 안내한다.
 */

export type DialogueNodeId = 'open' | 'fun' | 'excluded' | 'unsure' | 'heard' | 'words' | 'forMe' | 'save' | 'saved' | 'quiet' | 'crisis'

export interface Choice {
  label: string
  value: string
}

export interface DialogueView {
  node: DialogueNodeId
  ai: string
  choices: Choice[]
  freeText: boolean
  placeholder?: string
  ended: boolean
}

export interface DialogueState {
  node: DialogueNodeId
  words: string | null
  alsoForMe: boolean | null
  /** 사용자가 '남길래'를 고른 순간 true — 호출 측이 저장한다 */
  saveRequested: boolean
}

const QUIT: Choice = { label: '오늘은 그만할래', value: '__quit' }

export const CRISIS_PATTERN = /(죽고\s*싶|자살|자해|사라지고\s*싶|살고\s*싶지\s*않|끝내고\s*싶|목숨|해치고\s*싶)/

export const CRISIS_RESOURCES = [
  { label: '자살예방 상담전화', tel: '109' },
  { label: '정신건강 위기상담', tel: '1577-0199' },
  { label: '긴급 상황', tel: '112 / 119' },
]

export const WORD_SUGGESTIONS = ['너도 함께 놀 자격이 있어.', '잘 못해도 괜찮아.', '너다운 게 가장 좋아.']

export function startDialogue(): DialogueState {
  return { node: 'open', words: null, alsoForMe: null, saveRequested: false }
}

export function view(s: DialogueState): DialogueView {
  const v = (ai: string, choices: Choice[], freeText = false, placeholder?: string): DialogueView => ({
    node: s.node,
    ai,
    choices,
    freeText,
    placeholder,
    ended: false,
  })
  switch (s.node) {
    case 'open':
      return v(
        '오늘 고무줄놀이 어땠어?',
        [
          { label: '재밌었어', value: 'fun' },
          { label: '어렸을 땐 끼고 싶어도 못 끼었어', value: 'excluded' },
          { label: '잘 모르겠어', value: 'unsure' },
          QUIT,
        ],
        true,
        '편하게 적어도 돼 (건너뛰어도 괜찮아)',
      )
    case 'fun':
      return v('같이 뛰니까 즐거웠구나. 어릴 때도 이렇게 몸을 움직이며 노는 걸 좋아했어?', [
        { label: '응, 좋아했어', value: 'next' },
        { label: '잘 기억나지 않아', value: 'next' },
        QUIT,
      ])
    case 'excluded':
      return v('그때 같이 놀고 싶었겠구나.', [{ label: '응', value: 'next' }, QUIT])
    case 'unsure':
      return v('그럴 수 있어. 천천히 해도 되고, 여기서 쉬어도 돼.', [
        { label: '조금 더 이야기할래', value: 'next' },
        QUIT,
      ])
    case 'heard':
      return v('말해줘서 고마워. 그 마음 그대로 괜찮아.', [{ label: '응', value: 'next' }, QUIT])
    case 'words':
      return v(
        '지금, 그때의 어린 너에게 어떤 말을 해주고 싶어?',
        [...WORD_SUGGESTIONS.map((w) => ({ label: w, value: 'say:' + w })), QUIT],
        true,
        '어린 나에게 해주고 싶은 말',
      )
    case 'forMe':
      return v(`“${s.words}” — 이 말, 지금의 너에게도 듣고 싶은 말일까?`, [
        { label: '응, 나에게도', value: 'yes' },
        { label: '어린 나에게만', value: 'no' },
        { label: '잘 모르겠어', value: 'skip' },
      ])
    case 'save':
      return v('이 말을 고무줄 상자에 남겨둘까? 방에서 언제든 다시 열어볼 수 있어.', [
        { label: '고무줄 상자에 남길래', value: 'save' },
        { label: '남기지 않을래', value: 'nosave' },
      ])
    case 'saved':
      return { ...v('고무줄 상자에 담아뒀어. 집에 가면 책상 위 상자를 눌러 다시 들어볼 수 있어.', []), ended: true }
    case 'quiet':
      return { ...v('그래, 오늘은 조용히 쉬자. 아무것도 하지 않아도 괜찮아.', []), ended: true }
    case 'crisis':
      return {
        ...v(
          '많이 힘든 마음이 느껴져. 나는 상담사가 아니라서, 지금은 사람의 도움을 받는 게 가장 중요해. 아래 번호로 언제든 이야기할 수 있어.',
          [{ label: '조금 쉬었다 할래', value: '__quit' }],
        ),
        ended: false,
      }
  }
}

/** 사용자의 선택(value) 또는 자유 입력(text)을 받아 다음 상태로. */
export function answer(s: DialogueState, input: { value?: string; text?: string }): DialogueState {
  const text = input.text?.trim() ?? ''
  if (text && CRISIS_PATTERN.test(text)) return { ...s, node: 'crisis' }
  const value = input.value
  if (value === '__quit') return { ...s, node: 'quiet' }
  switch (s.node) {
    case 'open':
      if (value === 'fun' || value === 'excluded' || value === 'unsure') return { ...s, node: value }
      if (text) return { ...s, node: 'heard' }
      return { ...s, node: 'quiet' }
    case 'fun':
    case 'excluded':
    case 'unsure':
    case 'heard':
      return { ...s, node: 'words' }
    case 'words': {
      const w = value?.startsWith('say:') ? value.slice(4) : text
      return w ? { ...s, node: 'forMe', words: w } : s
    }
    case 'forMe':
      return { ...s, node: 'save', alsoForMe: value === 'yes' ? true : value === 'no' ? false : null }
    case 'save':
      return value === 'save' ? { ...s, node: 'saved', saveRequested: true } : { ...s, node: 'quiet' }
    default:
      return s
  }
}
