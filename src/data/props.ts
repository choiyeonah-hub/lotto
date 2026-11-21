/**
 * PropCatalog — 방 꾸미기 소품. 현재 모델은 모두 코드로 만든 오리지널(절차적) 모델이라
 * 외부 에셋 라이선스가 없다. 실제 브랜드 제품은 권리 확인 후 rights/asset 필드로 추가한다.
 */
export interface PropDef {
  id: string
  name: string
  category: '인형' | '생활' | '학용품' | '장식'
  /** 시대 정보는 확실할 때만 */
  era: string | null
  description: string
  asset: string
  rights: 'original-procedural' | 'licensed' | 'pending'
  /** 바닥 충돌 반경(m) */
  radius: number
}

const p = (id: string, name: string, category: PropDef['category'], description: string, radius = 0.25): PropDef => ({
  id,
  name,
  category,
  era: null,
  description,
  asset: `procedural:${id}`,
  rights: 'original-procedural',
  radius,
})

export const PROP_CATALOG: PropDef[] = [
  p('teddy', '곰인형', '인형', '머리맡에 두던 갈색 곰인형'),
  p('plant', '화분', '장식', '창가에 두던 작은 화분'),
  p('piggy', '돼지 저금통', '생활', '동전을 모으던 분홍 저금통', 0.2),
  p('clock', '자명종 시계', '생활', '종 두 개 달린 탁상 자명종', 0.15),
  p('globe', '지구본', '학용품', '책상 위 지구본', 0.2),
  p('lamp', '스탠드', '생활', '숙제할 때 켜던 스탠드', 0.2),
  p('pencilcase', '필통', '학용품', '자석으로 닫히던 철제 필통', 0.2),
  p('cushion', '방석', '생활', '바닥에 깔던 꽃무늬 방석', 0.35),
  p('frame', '사진 액자', '장식', '가족 사진을 넣는 나무 액자', 0.15),
  p('calendar', '탁상 달력', '장식', '1998이라 적힌 탁상 달력', 0.15),
]

export const propById = (id: string) => PROP_CATALOG.find((x) => x.id === id)
