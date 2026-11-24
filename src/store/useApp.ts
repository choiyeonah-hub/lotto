import { create } from 'zustand';
import type { EpisodeProgress, StudentProfile } from '../../shared/progress';
import { fetchHealth, type Health } from '../lib/api';
import { detectQuality, type Quality } from '../lib/device';
import { createLocalRepository, randomId, type ProgressRepository } from './progressRepo';

export type Screen = 'home' | 'game' | 'records' | 'review';

interface AppState {
  repo: ProgressRepository;
  screen: Screen;
  profiles: StudentProfile[];
  profile: StudentProfile | null;
  progress: EpisodeProgress | null;
  quality: Quality;
  voiceGuide: boolean;
  health: Health | null;
  init(): void;
  createProfile(nickname: string): void;
  selectProfile(id: string): void;
  logout(): void;
  updateProgress(fn: (p: EpisodeProgress) => EpisodeProgress): void;
  setScreen(s: Screen): void;
  setQuality(q: Quality): void;
  setVoiceGuide(on: boolean): void;
}

const SETTINGS_KEY = 'bq:v1:settings';
function loadSettings(): { quality?: Quality; voiceGuide?: boolean } {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); } catch { return {}; }
}
function saveSettings(s: { quality: Quality; voiceGuide: boolean }) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경 */ }
}

export const useApp = create<AppState>((set, get) => ({
  repo: createLocalRepository(),
  screen: 'home',
  profiles: [],
  profile: null,
  progress: null,
  quality: 'medium',
  voiceGuide: true,
  health: null,

  init() {
    const { repo } = get();
    const settings = loadSettings();
    const profiles = repo.listProfiles();
    const activeId = repo.getActiveProfileId();
    const profile = profiles.find((p) => p.id === activeId) ?? null;
    set({
      profiles, profile,
      progress: profile ? repo.loadProgress(profile.id) : null,
      quality: settings.quality ?? detectQuality(),
      voiceGuide: settings.voiceGuide ?? true,
    });
    fetchHealth().then((health) => set({ health }));
  },

  createProfile(nickname) {
    const { repo } = get();
    const profile: StudentProfile = { id: randomId(), nickname: nickname.trim().slice(0, 12) || '탐사대원', createdAt: new Date().toISOString() };
    repo.saveProfile(profile);
    repo.setActiveProfileId(profile.id);
    set({ profiles: repo.listProfiles(), profile, progress: repo.loadProgress(profile.id) });
  },

  selectProfile(id) {
    const { repo, profiles } = get();
    const profile = profiles.find((p) => p.id === id) ?? null;
    repo.setActiveProfileId(profile?.id ?? null);
    set({ profile, progress: profile ? repo.loadProgress(profile.id) : null, screen: 'home' });
  },

  logout() {
    get().repo.setActiveProfileId(null);
    set({ profile: null, progress: null, screen: 'home' });
  },

  updateProgress(fn) {
    const { progress, repo } = get();
    if (!progress) return;
    const next = fn(progress);
    repo.saveProgress(next);
    set({ progress: next });
  },

  setScreen: (screen) => set({ screen }),
  setQuality(quality) {
    set({ quality });
    saveSettings({ quality, voiceGuide: get().voiceGuide });
  },
  setVoiceGuide(voiceGuide) {
    set({ voiceGuide });
    saveSettings({ quality: get().quality, voiceGuide });
  },
}));
