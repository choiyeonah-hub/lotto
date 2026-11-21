/**
 * 저장 계층. 1단계는 브라우저 IndexedDB(기기 안에만 저장).
 * 추후 Supabase 등 원격 저장소는 같은 KvAdapter 인터페이스로 교체/추가한다 (현재 미연결).
 */
export interface KvAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
}

function idbAdapter(): KvAdapter {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('by1998', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('kv')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  let db: Promise<IDBDatabase> | null = null
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    db ??= open()
    const d = await db
    return new Promise<T>((resolve, reject) => {
      const r = fn(d.transaction('kv', mode).objectStore('kv'))
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  }
  return {
    get: (key) => tx('readonly', (s) => s.get(key)),
    set: async (key, value) => void (await tx('readwrite', (s) => s.put(value, key))),
    del: async (key) => void (await tx('readwrite', (s) => s.delete(key))),
  }
}

function memoryAdapter(): KvAdapter {
  const m = new Map<string, unknown>()
  return {
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
  }
}

export const kv: KvAdapter = typeof indexedDB !== 'undefined' ? idbAdapter() : memoryAdapter()

// ---- 도메인 레코드 ----

export interface MemoryNote {
  id: string
  text: string
  createdAt: string
  source: 'dialogue' | 'manual'
  /** 지금의 나에게도 듣고 싶은 말인지 (모르면 null) */
  alsoForMe: boolean | null
}

/** ObjectMemory: 방 안의 물건 하나에 연결된 글/말. objectId는 배치된 물건 id */
export interface ObjectMemory {
  objectId: string
  notes: MemoryNote[]
}

export interface PlacedProp {
  id: string
  propId: string
  x: number
  z: number
  rotY: number
}

export type RoomKind = 'had' | 'wanted' | 'imagined'

export interface Profile {
  roomKind: RoomKind | null
  /** 사용자가 직접 확인한 취향/기억만 담는다. 진단/유형 분류 없음 */
  favoriteMusic: string[]
}

export const RUBBER_BAND_BOX = 'rubber-band-box'

const K = {
  memories: 'objectMemories',
  room: 'roomLayout',
  profile: 'profile',
}

export async function loadMemories(): Promise<Record<string, ObjectMemory>> {
  return (await kv.get<Record<string, ObjectMemory>>(K.memories)) ?? {}
}

export async function addMemoryNote(objectId: string, note: Omit<MemoryNote, 'id' | 'createdAt'>): Promise<Record<string, ObjectMemory>> {
  const all = await loadMemories()
  const om = all[objectId] ?? { objectId, notes: [] }
  om.notes = [...om.notes, { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]
  all[objectId] = om
  await kv.set(K.memories, all)
  return all
}

export async function deleteMemoryNote(objectId: string, noteId: string): Promise<Record<string, ObjectMemory>> {
  const all = await loadMemories()
  if (all[objectId]) all[objectId].notes = all[objectId].notes.filter((n) => n.id !== noteId)
  await kv.set(K.memories, all)
  return all
}

export const loadRoom = async () => (await kv.get<PlacedProp[]>(K.room)) ?? []
export const saveRoom = (props: PlacedProp[]) => kv.set(K.room, props)

export const loadProfile = async (): Promise<Profile> => (await kv.get<Profile>(K.profile)) ?? { roomKind: null, favoriteMusic: [] }
export const saveProfile = (p: Profile) => kv.set(K.profile, p)

/** 설정 > '내 기록 모두 지우기' */
export async function wipeAll(): Promise<void> {
  await Promise.all(Object.values(K).map((k) => kv.del(k)))
}
