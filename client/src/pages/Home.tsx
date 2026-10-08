import { useState, useMemo, useEffect } from 'react'
import SeoulMap, { type HeatmapMode, type DistrictMapData } from '@/components/SeoulMap'
import { API_BASE } from '@/lib/api'

// Ranking.tsx와 동일한 MONTHS 계산
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

interface SeoulSummary {
  dealYmd: string
  count: number
  avgPricePerPyeong10k: number
  countPrevMonth: number
  countPrevYear: number
  avgPricePrevMonth: number
  avgPricePrevYear: number
}

interface RankingItem {
  district: string
  count: number
  countPrevMonth: number | null
  avgPricePerPyeong10k: number
  avgPricePrevMonth: number | null
}

function formatYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}년 ${parseInt(ymd.slice(4, 6))}월`
}

function formatCount(n: number): string {
  return `${n.toLocaleString()}건`
}

function formatPrice(p: number): string {
  return `${(p / 10000).toFixed(2)}억/평`
}

function PctBadge({ current, prev }: { current: number; prev: number }) {
  if (!prev) return <span className="text-[var(--text-muted)] text-xs">-</span>
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return <span className="text-[var(--text-muted)] text-xs">-</span>
  const up = pct > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-rose-500' : 'text-blue-500'}`}>
      {up ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

const MODE_LABELS: Record<HeatmapMode, string> = {
  tier: '급지',
  countChange: '거래량 변화',
  priceChange: '평단가 변화',
}

export default function Home() {
  const dealYmd = useMemo(() => MONTHS[MONTHS.length - 1], [])
  const [mode, setMode] = useState<HeatmapMode>('tier')
  const [summary, setSummary] = useState<SeoulSummary | null>(null)
  const [districtList, setDistrictList] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}/api/analytics/seoul-summary?dealYmd=${dealYmd}&kind=trade`).then((r) => r.json()),
      fetch(`${API_BASE}/api/analytics/ranking?dealYmd=${dealYmd}&kind=trade`).then((r) => r.json()),
    ])
      .then(([s, r]) => {
        setSummary(s)
        setDistrictList(r)
      })
      .finally(() => setLoading(false))
  }, [dealYmd])

  const districtMap = useMemo<Map<string, DistrictMapData>>(() => {
    const m = new Map<string, DistrictMapData>()
    for (const item of districtList) {
      m.set(item.district, {
        district: item.district,
        count: item.count,
        countPrevMonth: item.countPrevMonth,
        avgPricePerPyeong10k: item.avgPricePerPyeong10k,
        avgPricePrevMonth: item.avgPricePrevMonth,
      })
    }
    return m
  }, [districtList])

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">서울 부동산 현황</h1>
        {dealYmd && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{formatYmd(dealYmd)} 매매 기준</p>
        )}
      </div>

      {/* 서울 전체 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-2 lg:max-w-lg">
        <SummaryCard
          title="서울 전체 거래량"
          value={summary ? formatCount(summary.count) : '-'}
          pct={
            summary
              ? { current: summary.count, prev: summary.countPrevMonth }
              : null
          }
          sub={
            summary && summary.countPrevYear
              ? `전년동기 ${formatCount(summary.countPrevYear)}`
              : undefined
          }
          loading={loading}
        />
        <SummaryCard
          title="서울 평균 평단가"
          value={summary ? formatPrice(summary.avgPricePerPyeong10k) : '-'}
          pct={
            summary
              ? { current: summary.avgPricePerPyeong10k, prev: summary.avgPricePrevMonth }
              : null
          }
          sub={
            summary && summary.avgPricePrevYear
              ? `전년동기 ${formatPrice(summary.avgPricePrevYear)}`
              : undefined
          }
          loading={loading}
        />
      </div>

      {/* 2열 레이아웃: 지도(좌) + Session 3 예정(우) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 좌: 히트맵 지도 — 카드 테두리만, 내부 패딩 없이 지도 꽉 채움 */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          {/* 모드 탭 */}
          <div className="flex gap-1 px-4 pt-3 pb-2">
            {(Object.keys(MODE_LABELS) as HeatmapMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-[var(--text-primary)] text-[var(--bg-surface)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center" style={{ aspectRatio: '1.35' }}>
              <span className="text-sm text-[var(--text-muted)]">불러오는 중...</span>
            </div>
          ) : (
            <SeoulMap mode={mode} districtMap={districtMap} />
          )}
        </div>

        {/* 우: Session 3 예정 영역 */}
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-[var(--text-muted)]">준비 중</p>
        </div>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: string
  pct: { current: number; prev: number } | null
  sub?: string
  loading: boolean
}

function SummaryCard({ title, value, pct, sub, loading }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">{title}</p>
      {loading ? (
        <div className="h-7 w-24 rounded bg-[var(--bg-muted)] animate-pulse" />
      ) : (
        <>
          <p className="text-xl font-bold text-[var(--text-primary)] leading-tight">{value}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {pct && <PctBadge current={pct.current} prev={pct.prev} />}
            {sub && <span className="text-xs text-[var(--text-muted)]">{sub}</span>}
          </div>
        </>
      )}
    </div>
  )
}
