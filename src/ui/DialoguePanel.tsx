/** 어린 나와의 대화 (로컬 대화 모드). 선택지·자유 입력·건너뛰기, 언제든 조용히 끝내기. */
import { useState } from 'react'
import { CRISIS_RESOURCES, view } from '../game/dialogue'
import { AiCompanionAdapter } from '../services/adapters'
import { useStore } from '../state/store'

export function DialoguePanel() {
  const d = useStore((s) => s.dialogue)
  const answerDialogue = useStore((s) => s.answerDialogue)
  const close = useStore((s) => s.closeDialogue)
  const [text, setText] = useState('')
  if (!d) return null
  const v = view(d)
  const send = (input: { value?: string; text?: string }) => {
    setText('')
    void answerDialogue(input)
  }
  return (
    <div className="dialogue" role="dialog" aria-label="어린 나와의 대화">
      <div className="dlg-head">
        <span className="dlg-who">어린 나</span>
        <span className="badge" title="LLM이 연결되지 않은 규칙 기반 대화입니다">{AiCompanionAdapter.status.label}</span>
        <button className="x" onClick={close} aria-label="대화 닫기">
          ✕
        </button>
      </div>
      <p className="dlg-ai" data-node={v.node}>
        {v.ai}
      </p>
      {v.node === 'crisis' && (
        <ul className="crisis">
          {CRISIS_RESOURCES.map((r) => (
            <li key={r.tel}>
              {r.label} <a href={`tel:${r.tel.split(' ')[0]}`}>{r.tel}</a>
            </li>
          ))}
        </ul>
      )}
      <div className="choices">
        {v.choices.map((c) => (
          <button key={c.value + c.label} className="choice" onClick={() => send({ value: c.value })}>
            {c.label}
          </button>
        ))}
      </div>
      {v.freeText && (
        <form
          className="free"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) send({ text })
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={v.placeholder} maxLength={200} aria-label="자유 입력" />
          <button type="submit" disabled={!text.trim()}>
            말하기
          </button>
        </form>
      )}
      {v.ended && (
        <button className="primary" onClick={close}>
          닫기
        </button>
      )}
      <p className="fine">대화 내용은 저장하지 않고, 남기기로 고른 말만 이 기기(IndexedDB)에 저장돼요. 다른 사람에게 보이지 않으며 상담·치료를 대신하지 않습니다.</p>
    </div>
  )
}
