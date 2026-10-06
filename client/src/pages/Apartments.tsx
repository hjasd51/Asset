import { useState, useEffect } from 'react'
import { API_BASE } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'

const DISTRICTS = [
  '종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구',
  '도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구',
  '영등포구','동작구','관악구','서초구','강남구','송파구','강동구',
]

interface ApartmentItem {
  name: string
  gu: string
  dong: string
  pyeongList: number[]
  buildYear: string | null
  dealCount: number
  dealCountExcludingDirect: number
  avgPricePerPyeong10kRecent12m: number | null
  avgPricePerPyeong10kAllTime: number | null
}

export default function Apartments() {
  const [gu, setGu] = useState('')
  const [dong, setDong] = useState('')
  const [dongs, setDongs] = useState<string[]>([])
  const [items, setItems] = useState<ApartmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gu) { setDongs([]); setDong(''); return }
    fetch(`${API_BASE}/api/apartments/dongs?gu=${encodeURIComponent(gu)}`)
      .then((r) => r.json())
      .then((data: string[]) => setDongs(data))
      .catch(() => setDongs([]))
  }, [gu])

  const handleSearch = async () => {
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (gu) params.set('gu', gu)
      if (dong) params.set('dong', dong)
      const res = await fetch(`${API_BASE}/api/apartments?${params}`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json() as ApartmentItem[]
      setItems(data)
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">아파트 목록</h1>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>구 선택</Label>
            <Select onValueChange={(v) => { setGu(v); setDong('') }} value={gu}>
              <SelectTrigger><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>동 선택</Label>
            <Select onValueChange={setDong} value={dong} disabled={dongs.length === 0}>
              <SelectTrigger><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {dongs.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? '조회 중…' : '조회'}
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">{items.length}개 단지</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>단지명</TableHead>
                <TableHead>구</TableHead>
                <TableHead>동</TableHead>
                <TableHead>평형</TableHead>
                <TableHead>건축연도</TableHead>
                <TableHead>거래 건수</TableHead>
                <TableHead>최근12개월 평당가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.gu}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.dong}</TableCell>
                  <TableCell className="text-[var(--text-secondary)] text-xs">
                    {item.pyeongList?.slice(0, 5).map((p) => `${p}평`).join(', ')}
                    {item.pyeongList?.length > 5 && ' …'}
                  </TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.buildYear ?? '-'}</TableCell>
                  <TableCell className="text-[var(--text-secondary)]">{item.dealCountExcludingDirect?.toLocaleString() ?? item.dealCount?.toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">
                    {item.avgPricePerPyeong10kRecent12m != null
                      ? `${item.avgPricePerPyeong10kRecent12m.toLocaleString()}만`
                      : item.avgPricePerPyeong10kAllTime != null
                        ? `${item.avgPricePerPyeong10kAllTime.toLocaleString()}만`
                        : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
