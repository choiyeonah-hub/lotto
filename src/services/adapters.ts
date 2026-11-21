/**
 * 외부 연결이 필요한 기능의 어댑터. 연결되지 않은 기능은 '연결 예정'으로 정직하게 표시한다.
 * 비밀키는 절대 브라우저 코드에 두지 않는다 — 원격 AI는 서버 프록시(미구현)를 통해서만 호출해야 한다.
 */
export type ConnectionStatus = { connected: boolean; label: string }

export const AiCompanionAdapter = {
  mode: 'local-scripted' as const,
  status: { connected: false, label: '로컬 대화 모드 · AI API 연결 예정' } satisfies ConnectionStatus,
}

export const AvatarGenerationAdapter = {
  status: { connected: false, label: '사진 → 3D 아바타 생성: 연결 예정 (사진을 받지 않습니다)' } satisfies ConnectionStatus,
}

export const MultiplayerAdapter = {
  status: { connected: false, label: '함께 놀기(친구 초대·공개 골목): 연결 예정 — 지금은 NPC 친구와 놀아요' } satisfies ConnectionStatus,
}

/** 음원은 앱에 내장하지 않는다. 공식 서비스 검색 페이지로 연결만 한다. */
export const MusicProviderAdapter = {
  status: { connected: false, label: '앱 내 재생 없음 · 공식 음악 서비스로 이동' } satisfies ConnectionStatus,
  links(artist: string, title: string) {
    const q = encodeURIComponent(`${artist} ${title}`)
    return [
      { label: 'Melon에서 찾기', url: `https://www.melon.com/search/total/index.htm?q=${q}` },
      { label: 'YouTube Music에서 찾기', url: `https://music.youtube.com/search?q=${q}` },
    ]
  },
}
