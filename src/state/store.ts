import { create } from 'zustand'
import { BAND_STEPS, initBand, type BandLevelId, type BandState } from '../game/rubberBand'
import { answer, startDialogue, type DialogueState } from '../game/dialogue'
import {
  addMemoryNote,
  deleteMemoryNote,
  loadMemories,
  loadProfile,
  loadRoom,
  saveProfile,
  saveRoom,
  RUBBER_BAND_BOX,
  type ObjectMemory,
  type PlacedProp,
  type Profile,
  type RoomKind,
} from '../services/storage'

export type SceneId = 'title' | 'alley' | 'room'
export type Panel = null | 'decorate' | 'memoryBox' | 'music' | 'settings' | 'roomKind' | 'about' | 'propMemo'

export interface Settings {
  time: 'sunset' | 'day' | 'night'
  rain: boolean
  quality: 'high' | 'low'
  subtitles: boolean
  touch: boolean
}

const SETTINGS_KEY = 'by1998.settings'
const defaultSettings = (): Settings => {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  const base: Settings = { time: 'sunset', rain: false, quality: coarse ? 'low' : 'high', subtitles: true, touch: coarse }
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return base
  }
}

interface UiState {
  scene: SceneId
  spawn: 'start' | 'fromRoom'
  nearby: { id: string; label: string } | null
  subtitle: string | null
  settings: Settings
  panel: Panel
  band: (BandState & { active: boolean; level: BandLevelId; rounds: number }) | null
  dialogue: DialogueState | null
  memories: Record<string, ObjectMemory>
  /** 대화 저장 직후, 방 상자를 열면 새 문장이 반짝이도록 */
  lastSavedNoteId: string | null
  room: PlacedProp[]
  placing: { propId: string; moveId?: string } | null
  selected: string | null
  profile: Profile
  loaded: boolean

  load(): Promise<void>
  go(scene: SceneId, spawn?: UiState['spawn']): void
  setNearby(n: UiState['nearby']): void
  say(text: string | null): void
  setSettings(p: Partial<Settings>): void
  openPanel(p: Panel): void
  startBand(): void
  setBand(s: BandState): void
  setLevel(l: BandLevelId): void
  endBand(): void
  openDialogue(): void
  answerDialogue(input: { value?: string; text?: string }): Promise<void>
  closeDialogue(): void
  addNote(objectId: string, text: string): Promise<void>
  removeNote(objectId: string, noteId: string): Promise<void>
  beginPlace(propId: string, moveId?: string): void
  place(x: number, z: number): void
  select(id: string | null): void
  rotateSelected(delta: number): void
  removeSelected(): void
  setRoomKind(k: RoomKind): void
}

let subtitleTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<UiState>((set, get) => ({
  scene: 'title',
  spawn: 'start',
  nearby: null,
  subtitle: null,
  settings: defaultSettings(),
  panel: null,
  band: null,
  dialogue: null,
  memories: {},
  lastSavedNoteId: null,
  room: [],
  placing: null,
  selected: null,
  profile: { roomKind: null, favoriteMusic: [] },
  loaded: false,

  async load() {
    const [memories, room, profile] = await Promise.all([loadMemories(), loadRoom(), loadProfile()])
    set({ memories, room, profile, loaded: true })
  },
  go(scene, spawn = 'start') {
    set({ scene, spawn, nearby: null, panel: null, band: null, placing: null, selected: null })
    if (scene === 'room' && get().profile.roomKind === null) set({ panel: 'roomKind' })
  },
  setNearby(n) {
    const cur = get().nearby
    if (cur?.id !== n?.id) set({ nearby: n })
  },
  say(text) {
    clearTimeout(subtitleTimer)
    set({ subtitle: text })
    if (text) subtitleTimer = setTimeout(() => set({ subtitle: null }), 5200)
  },
  setSettings(p) {
    const settings = { ...get().settings, ...p }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* 저장 불가 환경에서는 이번 세션에만 적용 */
    }
    set({ settings })
  },
  openPanel(panel) {
    set({ panel })
  },
  startBand() {
    set({ band: { ...initBand(), active: true, level: get().band?.level ?? 'ankle', rounds: get().band?.rounds ?? 0 } })
  },
  setBand(s) {
    const b = get().band
    if (!b) return
    if (b.stepIndex !== s.stepIndex || b.message !== s.message || b.side !== s.side || b.releasePending !== s.releasePending || !!b.crossing !== !!s.crossing)
      set({ band: { ...b, ...s, rounds: s.stepIndex >= BAND_STEPS.length && b.stepIndex < BAND_STEPS.length ? b.rounds + 1 : b.rounds } })
    else Object.assign(b, s) // 판정용 내부 값만 바뀐 경우 리렌더 생략
  },
  setLevel(level) {
    const b = get().band
    if (b) set({ band: { ...b, ...initBand(), level } })
  },
  endBand() {
    set({ band: null })
  },
  openDialogue() {
    set({ dialogue: startDialogue() })
  },
  async answerDialogue(input) {
    const d = get().dialogue
    if (!d) return
    const next = answer(d, input)
    set({ dialogue: next })
    if (next.saveRequested && !d.saveRequested && next.words) {
      const memories = await addMemoryNote(RUBBER_BAND_BOX, { text: next.words, source: 'dialogue', alsoForMe: next.alsoForMe })
      const notes = memories[RUBBER_BAND_BOX].notes
      set({ memories, lastSavedNoteId: notes[notes.length - 1].id })
    }
  },
  closeDialogue() {
    set({ dialogue: null })
  },
  async addNote(objectId, text) {
    set({ memories: await addMemoryNote(objectId, { text, source: 'manual', alsoForMe: null }) })
  },
  async removeNote(objectId, noteId) {
    set({ memories: await deleteMemoryNote(objectId, noteId) })
  },
  beginPlace(propId, moveId) {
    set({ placing: { propId, moveId }, selected: null })
  },
  place(x, z) {
    const pl = get().placing
    if (!pl) return
    const room = pl.moveId
      ? get().room.map((p) => (p.id === pl.moveId ? { ...p, x, z } : p))
      : [...get().room, { id: crypto.randomUUID(), propId: pl.propId, x, z, rotY: 0 }]
    set({ room, placing: null, selected: pl.moveId ?? room[room.length - 1].id })
    void saveRoom(room)
  },
  select(selected) {
    set({ selected, placing: null })
  },
  rotateSelected(delta) {
    const id = get().selected
    const room = get().room.map((p) => (p.id === id ? { ...p, rotY: p.rotY + delta } : p))
    set({ room })
    void saveRoom(room)
  },
  removeSelected() {
    const id = get().selected
    const room = get().room.filter((p) => p.id !== id)
    set({ room, selected: null })
    void saveRoom(room)
  },
  setRoomKind(roomKind) {
    const profile = { ...get().profile, roomKind }
    set({ profile, panel: null })
    void saveProfile(profile)
  },
}))
