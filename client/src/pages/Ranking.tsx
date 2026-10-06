import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { API_BASE } from '@/lib/api'

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

interface RankingItem {
  district: string
  count: number
  avgPricePerPyeong10k: number | null
  maxPrice10k: number | null
}

function formatPrice(p10k: number | null) {
  if (p10k == null) return '-'
  if (p10k >= 10000) return `${(p10k / 10000).toFixed(2)}억`
  return `${p10k.toLocaleString()}만`
}

export default function Ranking() {
  const [dealYmd, setDealYmd] = useState(MONTHS[MONTHS.length - 1])
  const [kind, setKind] = useState('trade')
  const [items, setItems] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/analytics/ranking?dealYmd=${dealYmd}&kind=${kind}`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json() as RankingItem[]
      setItems(data)
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const maxCount = items.length > 0 ? Math.max(...items.map((r) => r.count)) : 1

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">구별 랭킹</h1>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>조회 월</Label>
            <Select onValueChange={setDealYmd} value={dealYmd}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...MONTHS].reverse().map((m) => (
                  <SelectItem key={m} value={m}>{m.slice(0,4)}년 {parseInt(m.slice(4))}월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>거래 유형</Label>
            <Select onValueChange={setKind} value={kind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trade">매매</SelectItem>
                <SelectItem value="jeonse">전세</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
              {loading ? '조회 중…' : '조회'}
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">순위</TableHead>
                <TableHead>구</TableHead>
                <TableHead>거래 건수</TableHead>
                <TableHead>평균 평당가</TableHead>
                <TableHead>최고가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r, i) => (
                <TableRow key={r.district}>
                  <TableCell className="font-medium text-[var(--text-secondary)]">{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.district}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-[var(--bg-muted)]"
                        style={{ width: `${Math.round((r.count / maxCount) * 80)}px` }}
                      />
                      <span>{r.count.toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>{r.avgPricePerPyeong10k != null ? `${r.avgPricePerPyeong10k.toLocaleString()}만/평` : '-'}</TableCell>
                  <TableCell className="font-semibold">{formatPrice(r.maxPrice10k)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
