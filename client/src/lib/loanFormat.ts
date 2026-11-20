// 만원 단위 금액을 "10억 6,000만원" 형태로 표시
export function formatManwon(value: number): string {
  const v = Math.round(value)
  if (v === 0) return '0원'
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const eok = Math.floor(abs / 10000)
  const man = abs % 10000
  if (eok > 0) return `${sign}${eok}억${man ? ` ${man.toLocaleString()}만` : ''}원`
  return `${sign}${abs.toLocaleString()}만원`
}

// 입력 중인 문자열을 숫자(만원)로 변환. 비어 있거나 숫자가 아니면 null
export function parseManwon(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
