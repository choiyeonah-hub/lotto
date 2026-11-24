// 학습 기록 저장소. 지금은 브라우저(localStorage)에 저장하지만,
// 같은 인터페이스로 서버/계정 저장소(예: REST API)를 구현해 바꿔 끼울 수 있다.
import { newProgress, SCHEMA_VERSION, type EpisodeProgress, type StudentProfile } from '../../shared/progress';

export interface ProgressRepository {
  listProfiles(): StudentProfile[];
  saveProfile(p: StudentProfile): void;
  getActiveProfileId(): string | null;
  setActiveProfileId(id: string | null): void;
  loadProgress(studentId: string): EpisodeProgress;
  saveProgress(p: EpisodeProgress): void;
}

const K = { profiles: 'bq:v1:profiles', active: 'bq:v1:active', progress: (id: string) => `bq:v1:progress:${id}` };

function read<T>(key: string, fallback: T, storage: Storage): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown, storage: Storage): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // 시크릿 모드·저장 공간 부족: 게임은 계속하되 저장만 실패
  }
}

export function createLocalRepository(storage: Storage = globalThis.localStorage): ProgressRepository {
  return {
    listProfiles: () => read<StudentProfile[]>(K.profiles, [], storage),
    saveProfile(p) {
      const all = read<StudentProfile[]>(K.profiles, [], storage).filter((x) => x.id !== p.id);
      write(K.profiles, [...all, p], storage);
    },
    getActiveProfileId: () => read<string | null>(K.active, null, storage),
    setActiveProfileId: (id) => void write(K.active, id, storage),
    loadProgress(studentId) {
      const p = read<EpisodeProgress | null>(K.progress(studentId), null, storage);
      if (!p || p.schemaVersion !== SCHEMA_VERSION) return newProgress(studentId);
      return p;
    },
    saveProgress: (p) => void write(K.progress(p.studentId), p, storage),
  };
}

export function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
