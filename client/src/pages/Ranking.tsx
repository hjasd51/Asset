import { useState, useMemo } from 'react'
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
  countPrevMonth: number | null
  avgPricePerPyeong10k: number | null
  avgPricePrevMonth: number | null
  avgPricePrevYear: number | null
  maxPrice10k: number | null
}

interface DongItem {
  dong: string
  count: number
  avgPricePerPyeong10k: number
}

interface SummaryEntry {
  district: string
  pct: number
}

interface Tier {
  label: string
  min: number
  badgeBg: string
  badgeText: string
}

const TIERS: Tier[] = [
  { label: '최상', min: 12000, badgeBg: 'bg-red-600',    badgeText: 'text-white' },
  { label: '상',   min: 7000,  badgeBg: 'bg-orange-400', badgeText: 'text-white' },
  { label: '중상', min: 5000,  badgeBg: 'bg-amber-300',  badgeText: 'text-gray-900' },
  { label: '중',   min: 3500,  badgeBg: 'bg-lime-300',   badgeText: 'text-gray-900' },
  { label: '중하', min: 2500,  badgeBg: 'bg-sky-300',    badgeText: 'text-gray-900' },
  { label: '하',   min: 0,     badgeBg: 'bg-indigo-300', badgeText: 'text-gray-900' },
]

function getTier(price: number): Tier {
  return TIERS.find(t => price >= t.min) ?? TIERS[TIERS.length - 1]
}

function formatMaxPrice(p10k: number | null) {
  if (p10k == null) return '-'
  return `${(p10k / 10000).toFixed(1)}억`
}

function formatAvgPrice(p10k: number | null) {
  if (p10k == null) return '-'
  return `${(p10k / 10000).toFixed(2)}억/평`
}

function diffPct(current: number | null, prev: number | null): number | null {
  if (current == null || prev == null || prev === 0) return null
  return ((current - prev) / prev) * 100
}

function DiffBadge({ pct }: { pct: number | null }) {
  if (pct == null || Math.abs(pct) < 0.05) {
    return <span className="text-xs text-[var(--text-muted)]">-</span>
  }
  const up = pct > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-rose-500' : 'text-blue-500'}`}>
      {up ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function SummaryCard({ title, entries, isPositive }: { title: string; entries: SummaryEntry[]; isPositive: boolean }) {
  const color = isPositive ? 'text-rose-500' : 'text-blue-500'
  const arrow = isPositive ? '▲' : '▼'
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{title}</div>
      <div className="space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">데이터 없음</p>
        ) : (
          entries.map((entry, i) => (
            <div key={entry.district} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-primary)]">
                <span className="text-[var(--text-muted)] text-xs mr-1">{i + 1}</span>
                {entry.district}
              </span>
              <span className={`font-semibold ${color}`}>{arrow}{Math.abs(entry.pct).toFixed(1)}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Ranking() {
  const [dealYmd, setDealYmd] = useState(MONTHS[MONTHS.length - 1])
  const [kind, setKind] = useState('trade')
  const [items, setItems] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [dongItems, setDongItems] = useState<DongItem[]>([])
  const [dongLoading, setDongLoading] = useState(false)

  const handleSearch = async () => {
    setError('')
    setLoading(true)
    setSelectedDistrict(null)
    setDongItems([])
    try {
      const res = await fetch(`${API_BASE}/api/analytics/ranking?dealYmd=${dealYmd}&kind=${kind}`)
      if (!res.ok) throw new Error('조회 실패')
      setItems(await res.json() as RankingItem[])
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDistrictClick = async (district: string) => {
    if (selectedDistrict === district) {
      setSelectedDistrict(null)
      setDongItems([])
      return
    }
    setSelectedDistrict(district)
    setDongLoading(true)
    setDongItems([])
    try {
      const res = await fetch(
        `${API_BASE}/api/analytics/dong-ranking?district=${encodeURIComponent(district)}&dealYmd=${dealYmd}&kind=${kind}`
      )
      if (!res.ok) throw new Error()
      setDongItems(await res.json() as DongItem[])
    } catch {
      // 데이터 없을 시 빈 배열 유지
    } finally {
      setDongLoading(false)
    }
  }

  const { countTop3, countWorst3, priceTop3, priceWorst3 } = useMemo(() => {
    const withCount = items
      .map(d => ({ district: d.district, pct: diffPct(d.count, d.countPrevMonth) }))
      .filter((d): d is SummaryEntry => d.pct != null)
      .sort((a, b) => b.pct - a.pct)

    const withPrice = items
      .map(d => ({ district: d.district, pct: diffPct(d.avgPricePerPyeong10k, d.avgPricePrevMonth) }))
      .filter((d): d is SummaryEntry => d.pct != null)
      .sort((a, b) => b.pct - a.pct)

    return {
      countTop3: withCount.slice(0, 3),
      countWorst3: [...withCount].reverse().slice(0, 3),
      priceTop3: withPrice.slice(0, 3),
      priceWorst3: [...withPrice].reverse().slice(0, 3),
    }
  }, [items])

  const maxCount = items.length > 0 ? Math.max(...items.map(r => r.count)) : 1
  const selectedMonthLabel = `${dealYmd.slice(0, 4)}년 ${parseInt(dealYmd.slice(4))}월`

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">지역 랭킹</h1>

      {/* 필터 바 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>조회 월</Label>
            <Select onValueChange={setDealYmd} value={dealYmd}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...MONTHS].reverse().map(m => (
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
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard title="거래량 증가 Top 3" entries={countTop3} isPositive={true} />
            <SummaryCard title="거래량 감소 Worst 3" entries={countWorst3} isPositive={false} />
            <SummaryCard title="평단가 상승 Top 3" entries={priceTop3} isPositive={true} />
            <SummaryCard title="평단가 하락 Worst 3" entries={priceWorst3} isPositive={false} />
          </div>

          {/* 랭킹 테이블 */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">순위</TableHead>
                  <TableHead>구</TableHead>
                  <TableHead>거래건수</TableHead>
                  <TableHead>평균 평단가</TableHead>
                  <TableHead>최고가</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, i) => (
                  <TableRow
                    key={r.district}
                    className={`cursor-pointer transition-colors hover:bg-[var(--bg-muted)] ${selectedDistrict === r.district ? 'bg-[var(--bg-muted)]' : ''}`}
                    onClick={() => handleDistrictClick(r.district)}
                  >
                    <TableCell className="font-medium text-[var(--text-secondary)]">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1">
                        {r.district}
                        {selectedDistrict === r.district && (
                          <span className="text-[var(--text-muted)] text-xs">▾</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full bg-[var(--bg-muted)] shrink-0"
                          style={{ width: `${Math.round((r.count / maxCount) * 80)}px` }}
                        />
                        <span>{r.count.toLocaleString()}</span>
                        <DiffBadge pct={diffPct(r.count, r.countPrevMonth)} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span>{formatAvgPrice(r.avgPricePerPyeong10k)}</span>
                        <span className="text-xs text-[var(--text-muted)]">전월</span>
                        <DiffBadge pct={diffPct(r.avgPricePerPyeong10k, r.avgPricePrevMonth)} />
                        <span className="text-xs text-[var(--text-muted)]">전년</span>
                        <DiffBadge pct={diffPct(r.avgPricePerPyeong10k, r.avgPricePrevYear)} />
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatMaxPrice(r.maxPrice10k)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 동별 히트맵 패널 */}
          {selectedDistrict && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">
                    {selectedDistrict} 동별 평단가 — {selectedMonthLabel}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {TIERS.map(t => (
                      <span key={t.label} className={`px-2 py-0.5 rounded text-xs font-medium ${t.badgeBg} ${t.badgeText}`}>
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedDistrict(null); setDongItems([]) }}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-base leading-none mt-0.5"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                {dongLoading ? (
                  <p className="text-sm text-center text-[var(--text-muted)] py-8">조회 중...</p>
                ) : dongItems.length === 0 ? (
                  <p className="text-sm text-center text-[var(--text-muted)] py-8">거래 데이터가 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {dongItems.map(item => {
                      const tier = getTier(item.avgPricePerPyeong10k)
                      return (
                        <div
                          key={item.dong}
                          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 space-y-1"
                        >
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${tier.badgeBg} ${tier.badgeText}`}>
                            {tier.label}
                          </span>
                          <div className="font-semibold text-sm text-[var(--text-primary)]">{item.dong}</div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {(item.avgPricePerPyeong10k / 10000).toFixed(2)}억/평
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
