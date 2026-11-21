/**
 * 골목 놀이 목록. 새 놀이는 같은 형태(공간 위치 + 순수 진행 판정 + 3D 장면 컴포넌트)로 추가한다.
 * status는 실제 구현 상태를 그대로 표시한다.
 */
export interface PlayGame {
  id: string
  name: string
  status: 'playable' | 'planned'
}

export const GAMES: PlayGame[] = [
  { id: 'rubber-band', name: '고무줄놀이', status: 'playable' },
  { id: 'ttangttameokgi', name: '땅따먹기', status: 'planned' },
  { id: 'paengi', name: '팽이치기', status: 'planned' },
  { id: 'guseul', name: '구슬치기', status: 'planned' },
  { id: 'gonggi', name: '공기놀이', status: 'planned' },
  { id: 'ttakji', name: '딱지치기', status: 'planned' },
]
