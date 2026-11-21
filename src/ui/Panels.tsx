/** 방/설정 패널: 고무줄 상자, 음악 선반, 방 꾸미기, 소품 메모, 방 종류 선택, 설정, 연결 상태. */
import { useState } from 'react'
import { MUSIC_SHELF } from '../data/music'
import { PROP_CATALOG, propById } from '../data/props'
import { GAMES } from '../game/games'
import { AiCompanionAdapter, AvatarGenerationAdapter, MultiplayerAdapter, MusicProviderAdapter } from '../services/adapters'
import { RUBBER_BAND_BOX, wipeAll } from '../services/storage'
import { useStore } from '../state/store'

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sheet" role="dialog" aria-label={title}>
      <div className="sheet-head">
        <h2>{title}</h2>
        <button className="x" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      <div className="sheet-body">{children}</div>
    </div>
  )
}

function MemoryList({ objectId }: { objectId: string }) {
  const notes = useStore((s) => s.memories[objectId]?.notes ?? [])
  const last = useStore((s) => s.lastSavedNoteId)
  const removeNote = useStore((s) => s.removeNote)
  const addNote = useStore((s) => s.addNote)
  const [text, setText] = useState('')
  return (
    <>
      {notes.length === 0 ? (
        <p className="muted">아직 담긴 말이 없어요. 원할 때 천천히 채워도 괜찮아요.</p>
      ) : (
        <ul className="notes">
          {notes.map((n) => (
            <li key={n.id} className={n.id === last ? 'fresh' : ''}>
              <q>{n.text}</q>
              <span className="meta">
                {new Date(n.createdAt).toLocaleDateString('ko-KR')} · {n.source === 'dialogue' ? '대화에서' : '직접 쓴 말'}
                {n.alsoForMe ? ' · 지금의 나에게도' : ''}
              </span>
              <button className="link" onClick={() => void removeNote(objectId, n.id)}>
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="free"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          void addNote(objectId, text.trim())
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="이 물건에 남길 말이나 기억" maxLength={200} aria-label="메모 입력" />
        <button type="submit" disabled={!text.trim()}>
          남기기
        </button>
      </form>
      <p className="fine">목소리 녹음은 다음 단계에서 마이크 권한 동의 후 지원 예정이에요(미구현).</p>
    </>
  )
}

export function Panels() {
  const panel = useStore((s) => s.panel)
  const open = useStore((s) => s.openPanel)
  const close = () => open(null)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const beginPlace = useStore((s) => s.beginPlace)
  const setRoomKind = useStore((s) => s.setRoomKind)

  switch (panel) {
    case 'memoryBox':
      return (
        <Sheet title="고무줄 상자" onClose={close}>
          <p className="muted">놀이 뒤 대화에서 어린 나에게 해준 말이 여기에 담겨요.</p>
          <MemoryList objectId={RUBBER_BAND_BOX} />
        </Sheet>
      )
    case 'music':
      return (
        <Sheet title="카세트 · 음악 선반" onClose={close}>
          <p className="muted">{MusicProviderAdapter.status.label}. 음원은 앱에 들어 있지 않아요 — 공식 서비스에서 들어주세요.</p>
          <ul className="music">
            {MUSIC_SHELF.map((m) => (
              <li key={m.id}>
                <div>
                  <b>{m.title}</b> · {m.artist} <span className="meta">{m.year ?? '발매연도 확인 필요'}</span>
                </div>
                <div className="links">
                  {MusicProviderAdapter.links(m.artist, m.title).map((l) => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener">
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="fine">내 시대의 곡 직접 추가하기는 다음 단계에서 지원 예정(미구현).</p>
        </Sheet>
      )
    case 'decorate':
      return (
        <Sheet title="방 꾸미기 · 소품" onClose={close}>
          <p className="muted">고른 뒤 방바닥을 눌러 놓아요. 놓은 소품을 누르면 돌리기·옮기기·메모를 할 수 있어요. 모든 소품은 무료예요.</p>
          <div className="grid">
            {PROP_CATALOG.map((p) => (
              <button
                key={p.id}
                className="card"
                onClick={() => {
                  beginPlace(p.id)
                  close()
                }}
              >
                <b>{p.name}</b>
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )
    case 'roomKind':
      return (
        <Sheet title="어떤 방으로 시작할까?" onClose={() => setRoomKind('imagined')}>
          <p className="muted">정답은 없어요. 언제든 바꿀 수 있어요.</p>
          <div className="choices col">
            <button className="choice" onClick={() => setRoomKind('had')}>
              그때 실제로 내가 지내던 방
            </button>
            <button className="choice" onClick={() => setRoomKind('wanted')}>
              그때 갖고 싶었던 방
            </button>
            <button className="choice" onClick={() => setRoomKind('imagined')}>
              내 방은 없었어 — 지금 상상하는 방으로
            </button>
          </div>
        </Sheet>
      )
    case 'settings':
      return (
        <Sheet title="설정" onClose={close}>
          <label className="row">
            시간
            <select value={settings.time} onChange={(e) => setSettings({ time: e.target.value as typeof settings.time })}>
              <option value="sunset">노을</option>
              <option value="day">낮</option>
              <option value="night">밤</option>
            </select>
          </label>
          <label className="row">
            비 오는 날
            <input type="checkbox" checked={settings.rain} onChange={(e) => setSettings({ rain: e.target.checked })} />
          </label>
          <label className="row">
            화질
            <select value={settings.quality} onChange={(e) => setSettings({ quality: e.target.value as typeof settings.quality })}>
              <option value="high">선명하게 (그림자)</option>
              <option value="low">가볍게 (모바일)</option>
            </select>
          </label>
          <label className="row">
            자막
            <input type="checkbox" checked={settings.subtitles} onChange={(e) => setSettings({ subtitles: e.target.checked })} />
          </label>
          <label className="row">
            터치 조작 버튼
            <input type="checkbox" checked={settings.touch} onChange={(e) => setSettings({ touch: e.target.checked })} />
          </label>
          <p className="fine">소리: 빗소리·골목 생활음은 아직 없어요(미구현). 기본은 무음입니다.</p>
          <button
            className="danger"
            onClick={async () => {
              if (!confirm('이 기기에 저장된 방 배치·상자의 말·프로필을 모두 지울까요?')) return
              await wipeAll()
              location.reload()
            }}
          >
            내 기록 모두 지우기
          </button>
        </Sheet>
      )
    case 'about':
      return (
        <Sheet title="연결 상태 · 개인정보" onClose={close}>
          <ul className="status">
            {[AiCompanionAdapter.status, AvatarGenerationAdapter.status, MusicProviderAdapter.status, MultiplayerAdapter.status].map((s) => (
              <li key={s.label}>
                <span className={s.connected ? 'on' : 'off'}>{s.connected ? '연결됨' : '연결 예정'}</span> {s.label}
              </li>
            ))}
          </ul>
          <h3 className="h3">골목 놀이</h3>
          <ul className="status">
            {GAMES.map((g) => (
              <li key={g.id}>
                <span className={g.status === 'playable' ? 'on' : 'off'}>{g.status === 'playable' ? '놀 수 있어요' : '준비 중'}</span> {g.name}
              </li>
            ))}
          </ul>
          <p className="fine">
            모든 기록은 이 기기 브라우저(IndexedDB)에만 저장되고 서버로 보내지 않아요. 이 앱은 휴식·자기돌봄·기억 탐색을 돕는 체험이며, 치료나 진단을 하지 않습니다.
          </p>
        </Sheet>
      )
    default:
      return null
  }
}

/** 방에서 선택한 소품의 조작 바 */
export function PropActions() {
  const selected = useStore((s) => s.selected)
  const placed = useStore((s) => s.room.find((p) => p.id === s.selected))
  const rotate = useStore((s) => s.rotateSelected)
  const remove = useStore((s) => s.removeSelected)
  const beginPlace = useStore((s) => s.beginPlace)
  const select = useStore((s) => s.select)
  const [memo, setMemo] = useState(false)
  if (!selected || !placed) return null
  const def = propById(placed.propId)
  return (
    <div className="propbar" role="toolbar" aria-label="소품 조작">
      <b>{def?.name}</b>
      <button onClick={() => rotate(Math.PI / 4)}>↻ 돌리기</button>
      <button onClick={() => beginPlace(placed.propId, placed.id)}>✥ 옮기기</button>
      <button onClick={() => setMemo((m) => !m)}>✎ 기억 남기기</button>
      <button onClick={remove}>치우기</button>
      <button className="x" onClick={() => select(null)} aria-label="선택 해제">
        ✕
      </button>
      {memo && (
        <div className="propmemo">
          <MemoryList objectId={placed.id} />
        </div>
      )}
    </div>
  )
}
