/** 키보드 + 가상 조이스틱 + 터치 버튼을 하나의 입력 상태로 합친다. */
export type Action = 'jump' | 'step' | 'hook' | 'turn' | 'interact' | 'wave' | 'sit'

const keys = new Set<string>()
const queue: Action[] = []
export const stick = { x: 0, y: 0 }

const KEY_ACTION: Record<string, Action> = {
  Space: 'jump',
  KeyJ: 'step',
  KeyK: 'hook',
  KeyL: 'turn',
  KeyE: 'interact',
  KeyQ: 'wave',
  KeyC: 'sit',
}

export function pushAction(a: Action) {
  queue.push(a)
}

export function takeActions(): Action[] {
  return queue.splice(0, queue.length)
}

/** 화면 기준 이동 축: x=오른쪽, y=앞쪽. -1..1 */
export function moveAxis(): { x: number; y: number; run: boolean } {
  let x = stick.x
  let y = stick.y
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1
  const m = Math.hypot(x, y)
  if (m > 1) {
    x /= m
    y /= m
  }
  return { x, y, run: keys.has('ShiftLeft') || keys.has('ShiftRight') }
}

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

export function installKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (typing(e)) return
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
    if (!e.repeat && KEY_ACTION[e.code]) pushAction(KEY_ACTION[e.code])
    keys.add(e.code)
  }
  const up = (e: KeyboardEvent) => keys.delete(e.code)
  const blur = () => keys.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}

export function clearInput() {
  keys.clear()
  queue.length = 0
  stick.x = stick.y = 0
}
