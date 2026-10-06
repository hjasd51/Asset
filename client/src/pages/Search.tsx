import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { API_BASE } from '@/lib/api'

const DISTRICTS = [
  '종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구',
  '도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구',
  '영등포구','동작구','관악구','서초구','강남구','송파구','강동구',
]

const now = new Date()
const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
const MONTHS: string[] = []
for (let y = 2021; y <= prevMonthYear; y++) {
  const lastMonth = y === prevMonthYear ? prevMonth : 12
  for (let m = 1; m <= lastMonth; m++) {
    MONTHS.push(`${y}${String(m).padStart(2, '0')}`)
  }
}

interface SearchItem {
  name: string
  district: string
  supplyAreaM2Estimate: number | null
  pyeongSupplyEstimate: number | null
  floor: string
  price_10k: number | null
  deal_date: string
  build_year: string | null
}

function formatPrice(p10k: number | null) {
  if (p10k == null) return '-'
  if (p10k >= 10000) return `${(p10k / 10000).toFixed(2)}억`
  return `${p10k.toLocaleString()}만`
}

export default function Search() {
  const [district, setDistrict] = useState('')
  const [dealYmd, setDealYmd] = useState(MONTHS[MONTHS.length - 1])
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!district) { setError('구를 선택하세요.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/local/trade?district=${encodeURIComponent(district)}&dealYmd=${dealYmd}`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json() as { items: SearchItem[] }
      setItems(data.items)
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">실거래가 검색</h1>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>구 선택</Label>
            <Select onValueChange={setDistrict} value={district}>
              <SelectTrigger>
                <SelectValue placeholder="구를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>조회 월</Label>
            <Select onValueChange={setDealYmd} value={dealYmd}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...MONTHS].reverse().map((m) => (
                  <SelectItem key={m} value={m}>{m.slice(0,4)}년 {parseInt(m.slice(4))}월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
              {loading ? '조회 중…' : '검색'}
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">검색 결과 {items.length}건</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>아파트명</TableHead>
                <TableHead>구</TableHead>
                <TableHead>면적(㎡)</TableHead>
                <TableHead>평형</TableHead>
                <TableHead>층</TableHead>
                <TableHead>거래가</TableHead>
                <TableHead>거래일</TableHead>
                <TableHead>건축연도</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.district}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.supplyAreaM2Estimate ?? '-'}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.pyeongSupplyEstimate != null ? `${item.pyeongSupplyEstimate}평` : '-'}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.floor}층</TableCell>
                  <TableCell className="font-semibold">{formatPrice(item.price_10k)}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.deal_date}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.build_year ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && items.length === 0 && district && (
        <p className="text-center text-sm text-[var(--text-muted)] py-12">검색 결과가 없습니다.</p>
      )}
    </div>
  )
}
