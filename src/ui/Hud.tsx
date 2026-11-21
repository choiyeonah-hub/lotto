/** 타이틀 화면, 상단 바, 상호작용 안내, 고무줄놀이 진행판, 자막. */
import { BAND_LEVELS, BAND_STEPS } from '../game/rubberBand'
import { pushAction } from '../state/input'
import { useStore } from '../state/store'

export function Title() {
  const go = useStore((s) => s.go)
  return (
    <div className="title" onClick={() => go('alley')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('alley')}>
      <div className="title-card">
        <p className="kicker">나를 찾는 추억여행</p>
        <h1>
          by<span>1998</span>
        </h1>
        <p className="sub">1998년, 나의 동네로 돌아가다</p>
        <p className="motto">“너다운 게 가장 좋아. 아무것도 잘하지 못해도 너는 소중한 사람이야.”</p>
        <button className="primary big">눌러서 골목으로 들어가기</button>
        <p className="fine">휴식·자기돌봄·기억 탐색을 위한 체험이에요. 치료나 진단을 하지 않아요.</p>
      </div>
    </div>
  )
}

const ROOM_NAME = { had: '그때 나의 방', wanted: '갖고 싶었던 방', imagined: '상상 속의 내 방' } as const

export function TopBar() {
  const scene = useStore((s) => s.scene)
  const roomKind = useStore((s) => s.profile.roomKind)
  const open = useStore((s) => s.openPanel)
  const band = useStore((s) => s.band)
  const endBand = useStore((s) => s.endBand)
  const go = useStore((s) => s.go)
  return (
    <div className="topbar">
      <span className="place">{scene === 'room' ? (roomKind ? ROOM_NAME[roomKind] : '나의 방') : band ? '공터 · 고무줄놀이' : '1998년 골목'}</span>
      <div className="tools">
        {scene === 'room' && <button onClick={() => open('decorate')}>방 꾸미기</button>}
        {scene === 'room' && <button onClick={() => open('memoryBox')}>고무줄 상자</button>}
        {scene === 'room' && <button onClick={() => go('alley', 'fromRoom')}>골목으로 나가기</button>}
        {band && (
          <button onClick={endBand} className="soft">
            놀이 그만하기
          </button>
        )}
        <button onClick={() => pushAction('wave')} title="손 흔들기 (Q)">
          👋
        </button>
        <button onClick={() => open('about')} title="연결 상태 · 개인정보">
          ⓘ
        </button>
        <button onClick={() => open('settings')} aria-label="설정">
          ⚙
        </button>
      </div>
    </div>
  )
}

export function InteractPrompt() {
  const nearby = useStore((s) => s.nearby)
  const dialogue = useStore((s) => s.dialogue)
  const placing = useStore((s) => s.placing)
  if (placing) return <div className="prompt">방바닥을 눌러 놓아요 · <button onClick={() => useStore.getState().select(null)}>취소</button></div>
  if (!nearby || dialogue) return null
  return (
    <button className="prompt" onClick={() => pushAction('interact')}>
      <kbd>E</kbd> {nearby.label}
    </button>
  )
}

export function BandBoard() {
  const band = useStore((s) => s.band)
  const setLevel = useStore((s) => s.setLevel)
  const openDialogue = useStore((s) => s.openDialogue)
  const dialogue = useStore((s) => s.dialogue)
  if (!band) return null
  const done = band.stepIndex >= BAND_STEPS.length
  return (
    <div className="band" aria-live="polite">
      <ol className="steps">
        {BAND_STEPS.map((s, i) => (
          <li key={s.id} className={i < band.stepIndex ? 'ok' : i === band.stepIndex ? 'now' : ''} data-step={s.id}>
            {i < band.stepIndex ? '✓ ' : ''}
            {s.label}
          </li>
        ))}
      </ol>
      <p className="band-msg">{band.message}</p>
      <div className="band-row">
        <span>줄 높이</span>
        {BAND_LEVELS.map((l) => (
          <button key={l.id} className={band.level === l.id ? 'sel' : ''} onClick={() => setLevel(l.id)}>
            {l.label}
          </button>
        ))}
        {done && !dialogue && (
          <button className="primary" onClick={openDialogue}>
            어린 나와 이야기하기
          </button>
        )}
      </div>
      <p className="keys">
        이동 WASD/방향키 · 달리기 Shift · 점프 Space · 밟기 J · 걸기 K(다시 누르면 풀기) · 돌기 L · 시점 드래그
      </p>
    </div>
  )
}

export function Subtitle() {
  const text = useStore((s) => s.subtitle)
  const on = useStore((s) => s.settings.subtitles)
  if (!text || !on) return null
  return (
    <div className="subtitle" role="status">
      {text}
    </div>
  )
}

export function Help() {
  const scene = useStore((s) => s.scene)
  const band = useStore((s) => s.band)
  if (band || scene === 'title') return null
  return (
    <p className="help">
      WASD/방향키 이동 · Shift 달리기 · Space 점프 · E 상호작용 · Q 손 흔들기 · C 앉기 · 마우스 드래그로 시점
      {scene === 'alley' ? ' · 공터(동쪽)에서 고무줄놀이, 초록 대문이 우리 집' : ''}
    </p>
  )
}
