import { useEffect } from 'react'
import { installKeyboard } from './state/input'
import { exposeDebug } from './state/runtime'
import { useStore } from './state/store'
import { World1998 } from './three/World1998'
import { DialoguePanel } from './ui/DialoguePanel'
import { BandBoard, Help, InteractPrompt, Subtitle, Title, TopBar } from './ui/Hud'
import { Panels, PropActions } from './ui/Panels'
import { TouchControls } from './ui/TouchControls'

export default function App() {
  const scene = useStore((s) => s.scene)
  const touch = useStore((s) => s.settings.touch)
  const nearby = useStore((s) => s.nearby)
  const dialogue = useStore((s) => s.dialogue)

  useEffect(() => {
    void useStore.getState().load()
    exposeDebug(() => useStore.getState(), {})
    return installKeyboard()
  }, [])

  return (
    <div className="app">
      <World1998 />
      {scene === 'title' ? (
        <Title />
      ) : (
        <>
          <TopBar />
          <BandBoard />
          <InteractPrompt />
          <Help />
          {touch && !dialogue && <TouchControls interact={!!nearby} />}
          <PropActions />
          <Panels />
          <DialoguePanel />
        </>
      )}
      <Subtitle />
    </div>
  )
}
