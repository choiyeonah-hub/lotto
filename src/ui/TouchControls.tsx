/** 모바일 가상 조이스틱 + 동작 버튼 (점프/밟기/걸기/돌기/상호작용). */
import { useRef, useState } from 'react'
import { pushAction, stick, type Action } from '../state/input'

const BUTTONS: { a: Action; label: string; key: string }[] = [
  { a: 'step', label: '밟기', key: 'J' },
  { a: 'hook', label: '걸기', key: 'K' },
  { a: 'turn', label: '돌기', key: 'L' },
  { a: 'jump', label: '점프', key: 'Space' },
]

export function TouchControls({ interact }: { interact: boolean }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const id = useRef<number | null>(null)
  const R = 46

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const m = Math.hypot(dx, dy)
    if (m > R) {
      dx = (dx / m) * R
      dy = (dy / m) * R
    }
    setKnob({ x: dx, y: dy })
    stick.x = dx / R
    stick.y = -dy / R
  }
  const end = () => {
    id.current = null
    setKnob({ x: 0, y: 0 })
    stick.x = stick.y = 0
  }

  return (
    <div className="touch" aria-label="터치 조작">
      <div
        ref={base}
        className="stick"
        onPointerDown={(e) => {
          id.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          update(e)
        }}
        onPointerMove={(e) => id.current === e.pointerId && update(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="tbtns">
        {interact && (
          <button className="tbtn wide" onPointerDown={() => pushAction('interact')}>
            들어가기·하기 <small>E</small>
          </button>
        )}
        {BUTTONS.map((b) => (
          <button key={b.a} className={`tbtn ${b.a === 'jump' ? 'big' : ''}`} onPointerDown={() => pushAction(b.a)} aria-label={`${b.label} (${b.key})`}>
            {b.label}
            <small>{b.key}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
