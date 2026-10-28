// 평단가(평당 만원) 기준 급지 구간 정의. SeoulMap 히트맵과 구별 연간 급지 테이블이 공유한다.
export const TIERS = [
  { min: 12000, fill: '#dc2626', label: '최상 (12억+)' },
  { min: 7000, fill: '#f97316', label: '상 (7~12억)' },
  { min: 5000, fill: '#eab308', label: '중상 (5~7억)' },
  { min: 3500, fill: '#84cc16', label: '중 (3.5~5억)' },
  { min: 2500, fill: '#38bdf8', label: '중하 (2.5~3.5억)' },
  { min: 0, fill: '#818cf8', label: '하 (~2.5억)' },
]

export function getTierFill(price: number): string {
  for (const t of TIERS) if (price >= t.min) return t.fill
  return TIERS[TIERS.length - 1].fill
}

export function getTierShort(price: number): string {
  for (const t of TIERS) if (price >= t.min) return t.label.split(' ')[0]
  return '하'
}
