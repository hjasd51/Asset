import { useState, useMemo, useEffect } from 'react'
import SeoulMap, { type HeatmapMode, type CompareMode, type DistrictMapData } from '@/components/SeoulMap'
import { API_BASE } from '@/lib/api'

const now = new Date()
// 신고기한(30일) 특성상 당월·직전월은 데이터 미완이므로 2개월 전 기준 사용
const refDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
const prevMonth = refDate.getMonth() + 1
const prevMonthYear = refDate.getFullYear()
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
  countPrevYear: number | null
  avgPricePerPyeong10k: number
  avgPricePrevMonth: number | null
  avgPricePrevYear: number | null
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

function PctBadge({ current, prev, label }: { current: number; prev: number; label: string }) {
  if (!prev) return null
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return null
  const up = pct > 0
  return (
    <span className="flex items-center gap-0.5 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-medium ${up ? 'text-rose-500' : 'text-blue-500'}`}>
        {up ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
      </span>
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
  const [compareMode, setCompareMode] = useState<CompareMode>('prevMonth')
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
        countPrevYear: item.countPrevYear,
        avgPricePerPyeong10k: item.avgPricePerPyeong10k,
        avgPricePrevMonth: item.avgPricePrevMonth,
        avgPricePrevYear: item.avgPricePrevYear,
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
          prevMonth={summary ? { current: summary.count, prev: summary.countPrevMonth } : null}
          prevYear={summary ? { current: summary.count, prev: summary.countPrevYear } : null}
          loading={loading}
        />
        <SummaryCard
          title="서울 평균 평단가"
          value={summary ? formatPrice(summary.avgPricePerPyeong10k) : '-'}
          prevMonth={summary ? { current: summary.avgPricePerPyeong10k, prev: summary.avgPricePrevMonth } : null}
          prevYear={summary ? { current: summary.avgPricePerPyeong10k, prev: summary.avgPricePrevYear } : null}
          loading={loading}
        />
      </div>

      {/* 2열 레이아웃: 지도(좌) + Session 3 예정(우) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 좌: 히트맵 지도 */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          {/* 모드 탭 + 전월/전년 토글 */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex gap-1">
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

            {/* 전월/전년 토글 — 급지 모드에서는 비활성 */}
            <div className={`flex gap-1 ${mode === 'tier' ? 'opacity-30 pointer-events-none' : ''}`}>
              {(['prevMonth', 'prevYear'] as CompareMode[]).map((cm) => (
                <button
                  key={cm}
                  onClick={() => setCompareMode(cm)}
                  disabled={mode === 'tier'}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    compareMode === cm && mode !== 'tier'
                      ? 'bg-[var(--text-primary)] text-[var(--bg-surface)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {cm === 'prevMonth' ? '전월' : '전년'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center" style={{ aspectRatio: '1.35' }}>
              <span className="text-sm text-[var(--text-muted)]">불러오는 중...</span>
            </div>
          ) : (
            <SeoulMap mode={mode} compareMode={compareMode} districtMap={districtMap} />
          )}
        </div>

        {/* 우: Session 3 예정 영역 */}
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center justify-center min-h-[300px]">
          <p className="text-sm text-[var(--text-muted)]">준비 중</p>
        </div>
      </div>

      {/* 데이터 기준 안내 */}
      <p className="text-xs text-[var(--text-muted)] mt-2 px-1">
        출처: 국토교통부 실거래가 공개시스템 &nbsp;·&nbsp; {formatYmd(dealYmd)} 실거래 신고 기준
        &nbsp;·&nbsp; 전월비: 직전월 대비 / 전년비: 전년 동월 대비
        &nbsp;·&nbsp; 신고기한(30일) 특성상 당월·직전월 데이터 미완 — 2개월 전 기준 자동 적용
      </p>
    </div>
  )
}

interface SummaryCardProps {
  title: string
  value: string
  prevMonth: { current: number; prev: number } | null
  prevYear: { current: number; prev: number } | null
  loading: boolean
}

function SummaryCard({ title, value, prevMonth, prevYear, loading }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">{title}</p>
      {loading ? (
        <div className="h-7 w-24 rounded bg-[var(--bg-muted)] animate-pulse" />
      ) : (
        <>
          <p className="text-xl font-bold text-[var(--text-primary)] leading-tight">{value}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            {prevMonth && <PctBadge current={prevMonth.current} prev={prevMonth.prev} label="전월비" />}
            {prevYear && <PctBadge current={prevYear.current} prev={prevYear.prev} label="전년비" />}
          </div>
        </>
      )}
    </div>
  )
}
