import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { ChevronLeft } from 'lucide-react'
import { API_BASE } from '@/lib/api'

ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Filler)

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

interface TimeSeriesItem {
  dealYmd: string
  avgPricePerPyeong10k: number | null
}

interface ApartmentItem {
  name: string
  count: number
  avgPricePerPyeong10k: number
  avgPricePrevMonth: number | null
  avgPricePrevYear: number | null
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

function SummaryCard({ title, entries }: { title: string; entries: SummaryEntry[] }) {
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
              <span className={`font-semibold ${entry.pct >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                {entry.pct >= 0 ? '▲' : '▼'}{Math.abs(entry.pct).toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 동별 급지 상세 뷰
function DongDetail({
  district,
  dealYmd,
  kind,
  onBack,
}: {
  district: string
  dealYmd: string
  kind: string
  onBack: () => void
}) {
  const [items, setItems] = useState<DongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDong, setSelectedDong] = useState<string | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesItem[]>([])
  const [aptItems, setAptItems] = useState<ApartmentItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/analytics/dong-ranking?district=${encodeURIComponent(district)}&dealYmd=${dealYmd}&kind=${kind}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setItems(data as DongItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [district, dealYmd, kind])

  const handleDongClick = async (dong: string) => {
    if (selectedDong === dong) {
      setSelectedDong(null)
      setTimeSeries([])
      setAptItems([])
      return
    }
    setSelectedDong(dong)
    setDetailLoading(true)
    setTimeSeries([])
    setAptItems([])
    try {
      const base = `${API_BASE}/api/analytics`
      const params = `district=${encodeURIComponent(district)}&dong=${encodeURIComponent(dong)}&dealYmd=${dealYmd}&kind=${kind}`
      const [tsRes, aptRes] = await Promise.all([
        fetch(`${base}/dong-time-series?${params}`),
        fetch(`${base}/dong-apartment-ranking?${params}`),
      ])
      const [tsData, aptData] = await Promise.all([
        tsRes.ok ? tsRes.json() : Promise.resolve([]),
        aptRes.ok ? aptRes.json() : Promise.resolve([]),
      ])
      setTimeSeries(tsData as TimeSeriesItem[])
      setAptItems(aptData as ApartmentItem[])
    } catch {
      // 오류 시 빈 상태 유지
    } finally {
      setDetailLoading(false)
    }
  }

  const monthLabel = `${dealYmd.slice(0, 4)}년 ${parseInt(dealYmd.slice(4))}월`

  const chartData = {
    labels: timeSeries.map(d => {
      const y = d.dealYmd.slice(2, 4)
      const m = parseInt(d.dealYmd.slice(4))
      return `${y}.${String(m).padStart(2, '0')}`
    }),
    datasets: [
      {
        label: '평균 평단가',
        data: timeSeries.map(d =>
          d.avgPricePerPyeong10k != null
            ? parseFloat((d.avgPricePerPyeong10k / 10000).toFixed(3))
            : null
        ),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      },
    ],
  }

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${Number(ctx.parsed.y).toFixed(2)}억/평`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val) => `${Number(val).toFixed(1)}억`,
        },
        grid: { color: 'rgba(128,128,128,0.1)' },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      {/* 브레드크럼 + 제목 */}
      <div className="space-y-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          지역 랭킹으로 돌아가기
        </button>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{district} 동별 급지</h1>
          <span className="text-sm text-[var(--text-secondary)]">{monthLabel} · {kind === 'trade' ? '매매' : '전세'}</span>
        </div>
      </div>

      {/* 급지 범례 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">급지 기준 (서울 전체 절대값, 만원/평)</p>
        <div className="flex flex-wrap gap-3">
          {TIERS.map((t, i) => {
            const next = TIERS[i + 1]
            const range = next
              ? `${next.min.toLocaleString()}~${t.min.toLocaleString()}`
              : `${t.min.toLocaleString()}+`
            return (
              <div key={t.label} className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.badgeBg} ${t.badgeText}`}>
                  {t.label}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{range}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 동 카드 그리드 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        {loading ? (
          <p className="text-center text-sm text-[var(--text-muted)] py-16">조회 중...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-[var(--text-muted)] py-16">거래 데이터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map(item => {
              const tier = getTier(item.avgPricePerPyeong10k)
              const isSelected = selectedDong === item.dong
              return (
                <div
                  key={item.dong}
                  onClick={() => handleDongClick(item.dong)}
                  className={`rounded-lg border p-3 space-y-1.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${tier.badgeBg} ${tier.badgeText}`}>
                    {tier.label}
                  </span>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">{item.dong}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {(item.avgPricePerPyeong10k / 10000).toFixed(2)}억/평
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{item.count}건</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 선택된 동 상세 패널 */}
      {selectedDong && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          {/* 패널 헤더 */}
          <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">{selectedDong} 상세 분석</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{monthLabel} 기준 · {kind === 'trade' ? '매매' : '전세'}</p>
            </div>
            <button
              onClick={() => { setSelectedDong(null); setTimeSeries([]); setAptItems([]) }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-base leading-none"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {detailLoading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-16">조회 중...</p>
          ) : (
            <>
              {/* 12개월 꺾은선 그래프 */}
              <div className="px-5 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">최근 12개월 평균 평단가 추이</h3>
                <div className="h-52">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>

              {/* 아파트별 급지 테이블 */}
              <div>
                <div className="px-5 py-3 border-b border-[var(--border-color)]">
                  <h3 className="text-sm font-medium text-[var(--text-secondary)]">아파트별 평단가 랭킹</h3>
                </div>
                {aptItems.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-muted)] py-8">데이터가 없습니다.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">급지</TableHead>
                        <TableHead>아파트명</TableHead>
                        <TableHead>평균 평단가</TableHead>
                        <TableHead>전월비</TableHead>
                        <TableHead>전년비</TableHead>
                        <TableHead className="w-16">거래건수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aptItems.map((apt, i) => {
                        const tier = getTier(apt.avgPricePerPyeong10k)
                        return (
                          <TableRow key={`${apt.name}-${i}`}>
                            <TableCell>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${tier.badgeBg} ${tier.badgeText}`}>
                                {tier.label}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">{apt.name}</TableCell>
                            <TableCell className="font-semibold">{formatAvgPrice(apt.avgPricePerPyeong10k)}</TableCell>
                            <TableCell><DiffBadge pct={diffPct(apt.avgPricePerPyeong10k, apt.avgPricePrevMonth)} /></TableCell>
                            <TableCell><DiffBadge pct={diffPct(apt.avgPricePerPyeong10k, apt.avgPricePrevYear)} /></TableCell>
                            <TableCell className="text-[var(--text-secondary)]">{apt.count}건</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Ranking() {
  const [searchParams, setSearchParams] = useSearchParams()
  const districtParam = searchParams.get('district')

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
      setItems(await res.json() as RankingItem[])
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDistrictClick = (district: string) => {
    setSearchParams({ district, dealYmd, kind })
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

  if (districtParam) {
    return (
      <DongDetail
        district={districtParam}
        dealYmd={searchParams.get('dealYmd') ?? dealYmd}
        kind={searchParams.get('kind') ?? kind}
        onBack={() => setSearchParams({})}
      />
    )
  }

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
            <SummaryCard title="거래량 증가 Top 3" entries={countTop3} />
            <SummaryCard title="거래량 감소 Worst 3" entries={countWorst3} />
            <SummaryCard title="평단가 상승 Top 3" entries={priceTop3} />
            <SummaryCard title="평단가 하락 Worst 3" entries={priceWorst3} />
          </div>

          {/* 랭킹 테이블 */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border-color)]">
              <span className="text-sm text-[var(--text-secondary)]">{selectedMonthLabel} 기준 · 구 클릭 시 동별 상세</span>
            </div>
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
                    className="cursor-pointer transition-colors hover:bg-[var(--bg-muted)]"
                    onClick={() => handleDistrictClick(r.district)}
                  >
                    <TableCell className="font-medium text-[var(--text-secondary)]">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1">
                        {r.district}
                        <ChevronLeft className="h-3 w-3 rotate-180 text-[var(--text-muted)]" />
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
        </>
      )}
    </div>
  )
}
