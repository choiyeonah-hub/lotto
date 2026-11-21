/**
 * 음악 선반: 제목/가수 기록 + 공식 서비스 링크만 제공 (음원 미포함).
 * year는 확실한 것만 채우고, 확인 전이면 null로 두어 화면에 '연도 확인 필요'로 표시한다.
 */
export interface MusicSelection {
  id: string
  artist: string
  title: string
  year: number | null
  userAdded?: boolean
}

export const MUSIC_SHELF: MusicSelection[] = [
  { id: 'seotaiji-nanara', artist: '서태지와 아이들', title: '난 알아요', year: 1992 },
  { id: 'hot-candy', artist: 'H.O.T.', title: '캔디', year: 1996 },
  { id: 'toy-gyeote', artist: '토이', title: '내가 너의 곁에 잠시 살았다는 걸', year: null },
]
