import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE } from '@/lib/api'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type Chart as ChartType,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ComplexTimeSeriesItem, DaangnListing } from '@/types/realEstate'

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, PointElement, LineElement, Tooltip, Legend)

interface Suggestion { name: string; gu: string; dong: string }

// ─── 유틸 함수 ───────────────────────────────────────────────────────────────

function formatPrice(p10k: number | null): string {
  if (p10k == null) return '-'
  const eok = Math.floor(p10k / 10000)
  const man = p10k % 10000
  if (eok > 0) return `${eok}억${man ? ` ${man.toLocaleString()}만` : ''}`.trim()
  return `${man.toLocaleString()}만`
}

function formatEok(p10k: number): string {
  return (p10k / 10000).toFixed(1)
}

function formatYmd(ymd: string): string {
  return `${ymd.slice(2, 4)}.${ymd.slice(4, 6)}`
}

function shiftYmd(ymd: string, delta: number): string {
  const y = parseInt(ymd.slice(0, 4), 10)
  const rawM = parseInt(ymd.slice(4, 6), 10) + delta
  const yy = y + Math.floor((rawM - 1) / 12)
  const mm = (((rawM - 1) % 12) + 12) % 12 + 1
  return `${yy}${String(mm).padStart(2, '0')}`
}

function enumerateMonths(startYmd: string, endYmd: string): string[] {
  const months: string[] = []
  let y = parseInt(startYmd.slice(0, 4), 10)
  let m = parseInt(startYmd.slice(4, 6), 10)
  const endY = parseInt(endYmd.slice(0, 4), 10)
  const endM = parseInt(endYmd.slice(4, 6), 10)
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return months
}

function monthRangeFromMatches(items: ComplexTimeSeriesItem[]): string[] {
  const distinct = [...new Set(items.map((m) => m.dealYmd))].sort()
  return distinct.length ? enumerateMonths(distinct[0], distinct[distinct.length - 1]) : []
}

function excludeDirect(items: ComplexTimeSeriesItem[]): ComplexTimeSeriesItem[] {
  return items.filter((m) => m.deal_type !== '직거래')
}

function quarterOf(dealYmd: string) {
  const year = dealYmd.slice(0, 4)
  const q = Math.ceil(Number(dealYmd.slice(4, 6)) / 3)
  return { key: `${year}Q${q}`, label: `${year.slice(2)}년${q}분기` }
}

function shiftQuarter(year: number, q: number, delta: number) {
  const idx = year * 4 + (q - 1) + delta
  return { year: Math.floor(idx / 4), quarter: (idx % 4) + 1 }
}

function buildQuarterRange() {
  const now = new Date()
  const curY = now.getFullYear()
  const curQ = Math.ceil((now.getMonth() + 1) / 3)
  const toQ = ({ year, quarter }: { year: number; quarter: number }) => ({
    key: `${year}Q${quarter}`,
    label: `${String(year).slice(2)}년${quarter}분기`,
  })
  return [
    toQ(shiftQuarter(curY, curQ, -4)),
    toQ(shiftQuarter(curY, curQ, -2)),
    toQ(shiftQuarter(curY, curQ, -1)),
    toQ({ year: curY, quarter: curQ }),
  ]
}

function pickDefaultPyeong(items: ComplexTimeSeriesItem[]): number | null {
  const filtered = excludeDirect(items)
  const counts = new Map<number, number>()
  for (const m of filtered) counts.set(m.pyeongSupplyEstimate, (counts.get(m.pyeongSupplyEstimate) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted.length ? sorted[0][0] : null
}

function trendColor(pct: number) {
  if (pct === 0) return 'text-[var(--text-secondary)]'
  return pct > 0 ? 'text-rose-500' : 'text-blue-500'
}

// ─── 차트 최고/최저 라벨 플러그인 ───────────────────────────────────────────

const maxMinLabelPlugin = {
  id: 'maxMinLabels',
  afterDatasetsDraw(chartInstance: ChartType) {
    const lineIdx = chartInstance.data.datasets.findIndex(
      (d) => (d as { type?: string }).type === 'line'
    )
    if (lineIdx === -1) return
    const lineData = chartInstance.data.datasets[lineIdx].data as (number | null)[]
    const meta = chartInstance.getDatasetMeta(lineIdx)
    if (!meta?.data?.length) return

    const valid = lineData
      .map((v, i) => ({ v, i }))
      .filter((d): d is { v: number; i: number } => d.v != null)
    if (valid.length < 2) return

    const maxItem = valid.reduce((a, b) => (b.v > a.v ? b : a))
    const minItem = valid.reduce((a, b) => (b.v < a.v ? b : a))
    if (maxItem.i === minItem.i) return

    const latest = valid[valid.length - 1]
    const pct = (item: { v: number }) => ((latest.v - item.v) / item.v) * 100
    const { ctx } = chartInstance

    const drawLabel = (item: { v: number; i: number }, p: number, isMax: boolean) => {
      const point = meta.data[item.i]
      if (!point) return
      const arrow = isMax ? '▼' : '▲'
      const color = isMax ? '#ef4444' : '#3b82f6'
      const text = `${formatEok(item.v)}억 (${arrow}${Math.abs(p).toFixed(1)}%)`
      ctx.save()
      ctx.fillStyle = color
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = isMax ? 'bottom' : 'top'
      ctx.fillText(text, point.x, point.y + (isMax ? -6 : 6))
      ctx.restore()
    }

    drawLabel(maxItem, pct(maxItem), true)
    drawLabel(minItem, pct(minItem), false)
  },
}

// ─── x축 연도 라벨 플러그인 (연도를 해당 연도 틱 범위 중앙에 표시) ───────────

const xYearLabelPlugin = {
  id: 'xYearLabel',
  afterDraw(chartInstance: ChartType) {
    const xScale = chartInstance.scales['x']
    if (!xScale?.ticks?.length) return
    const labels = chartInstance.data.labels as string[]
    const { ctx, chartArea } = chartInstance

    // 보이는 틱의 x좌표를 연도별로 그룹핑 (삽입 순서 = 연도 오름차순)
    const yearMap = new Map<string, number[]>()
    xScale.ticks.forEach((tick, i) => {
      const raw = labels[typeof tick.value === 'number' ? tick.value : i]
      if (typeof raw !== 'string' || raw.length < 6) return
      const yy = raw.slice(2, 4)
      if (!yearMap.has(yy)) yearMap.set(yy, [])
      yearMap.get(yy)!.push(xScale.getPixelForTick(i))
    })

    const cs = getComputedStyle(document.documentElement)
    const yearLineColor = cs.getPropertyValue('--chart-year-line').trim() || '#94a3b8'
    const mutedColor = cs.getPropertyValue('--text-muted').trim() || '#9ca3af'

    // ── 연도 경계 세로선 (첫 번째 연도 제외) ──────────────────────────────
    let isFirst = true
    yearMap.forEach((xs) => {
      const firstX = Math.min(...xs)
      if (isFirst) { isFirst = false; return }
      ctx.save()
      ctx.strokeStyle = yearLineColor
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(firstX, chartArea.top)
      ctx.lineTo(firstX, chartArea.bottom)
      ctx.stroke()
      ctx.restore()
    })

    // ── 연도 라벨 (각 연도 틱 범위 중앙) ─────────────────────────────────
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '10px sans-serif'
    ctx.fillStyle = mutedColor

    yearMap.forEach((xs, yy) => {
      if (!xs.length) return
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      ctx.fillText(`'${yy}`, cx, xScale.bottom - 14)
    })

    ctx.restore()
  },
}

// ─── 분기별 최고가 표 ─────────────────────────────────────────────────────────

function QuarterlyTable({ items }: { items: ComplexTimeSeriesItem[] }) {
  const filtered = excludeDirect(items)
  const tiers = [...new Set(filtered.map((m) => m.pyeongSupplyEstimate))].sort((a, b) => a - b)
  const quarters = buildQuarterRange()

  if (tiers.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] p-4">직거래를 제외한 거래가 없습니다.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-muted)] text-xs text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 text-left font-medium">
              <div className="h-[52px] flex items-center">평형</div>
            </th>
            {quarters.map((q) => (
              <th key={q.key} className="px-3 font-medium text-right">
                <div className="h-[52px] flex items-center justify-end whitespace-nowrap">{q.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-color)]">
          {tiers.map((tier) => {
            const tierItems = filtered.filter((m) => m.pyeongSupplyEstimate === tier)
            const areaAvg = tierItems.reduce((s, m) => s + (m.supplyAreaM2Estimate ?? m.area_m2), 0) / tierItems.length
            const qVals = quarters.map((q) => {
              const inQ = tierItems.filter((m) => quarterOf(m.dealYmd).key === q.key)
              if (inQ.length === 0) return null
              return { max: Math.max(...inQ.map((m) => m.price10k ?? 0)), count: inQ.length }
            })
            const rowMax = qVals.reduce<number | null>(
              (best, v) => (v && (best === null || v.max > best) ? v.max : best), null
            )
            return (
              <tr key={tier}>
                <td className="px-3 py-1 font-medium whitespace-nowrap">
                  <div>{tier}평</div>
                  <div className="text-[10px] text-[var(--text-muted)]">전용 {areaAvg.toFixed(0)}㎡</div>
                </td>
                {qVals.map((v, i) => {
                  const isMax = v?.max === rowMax
                  return (
                    <td key={i} className="px-3 py-1 text-right">
                      <div className={`inline-block px-2 py-0.5 border-2 rounded ${isMax ? 'border-rose-500' : 'border-transparent'}`}>
                        {v ? (
                          <>
                            <div className={`font-semibold ${isMax ? 'text-rose-500' : ''}`}>{formatEok(v.max)}억</div>
                            <div className={`text-[10px] ${isMax ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>{v.count}건</div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-[var(--text-muted)]">-</div>
                            <div className="text-[10px]">&nbsp;</div>
                          </>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── 단기/장기 추세 표 ───────────────────────────────────────────────────────

type TrendStat = { pct: number; delta: number } | null

function PctCell({ stat }: { stat: TrendStat }) {
  if (!stat) return (
    <td className="px-3 py-1 text-center">
      <div className="inline-block px-2 py-0.5 border-2 border-transparent rounded">
        <div className="font-semibold text-[var(--text-muted)]">-</div>
        <div className="text-[10px]">&nbsp;</div>
      </div>
    </td>
  )
  const arrow = stat.pct === 0 ? '' : stat.pct > 0 ? '▲' : '▼'
  const color = trendColor(stat.pct)
  return (
    <td className="px-3 py-1 text-center">
      <div className="inline-block px-2 py-0.5 border-2 border-transparent rounded">
        <div className={`font-semibold ${color}`}>{arrow}{Math.abs(stat.pct)}%</div>
        <div className="text-[10px]">&nbsp;</div>
      </div>
    </td>
  )
}

function AmountCell({ stat }: { stat: TrendStat }) {
  if (!stat) return (
    <td className="px-3 py-1 text-center">
      <div className="inline-block px-2 py-0.5 border-2 border-transparent rounded">
        <div className="font-semibold text-[var(--text-muted)]">-</div>
        <div className="text-[10px]">&nbsp;</div>
      </div>
    </td>
  )
  const arrow = stat.pct === 0 ? '' : stat.pct > 0 ? '▲' : '▼'
  const color = trendColor(stat.pct)
  return (
    <td className="px-3 py-1 text-center">
      <div className="inline-block px-2 py-0.5 border-2 border-transparent rounded">
        <div className={`font-semibold ${color}`}>{arrow}{formatEok(Math.abs(stat.delta))}억</div>
        <div className="text-[10px]">&nbsp;</div>
      </div>
    </td>
  )
}

function TrendTable({ items }: { items: ComplexTimeSeriesItem[] }) {
  const filtered = excludeDirect(items)
  const tiers = [...new Set(filtered.map((m) => m.pyeongSupplyEstimate))].sort((a, b) => a - b)
  if (tiers.length === 0) return null

  const latestYmd = filtered.map((m) => m.dealYmd).sort().at(-1)!
  const recentWindow = [shiftYmd(latestYmd, -1), latestYmd]
  const shortPast = [shiftYmd(latestYmd, -3), shiftYmd(latestYmd, -2)]
  const longPast = [shiftYmd(latestYmd, -37), shiftYmd(latestYmd, -36)]

  const disclaimer =
    `최근 2개월(${formatYmd(recentWindow[0])}~${formatYmd(recentWindow[1])}) 평균 대비 · ` +
    `단기: 이전 2개월(${formatYmd(shortPast[0])}~${formatYmd(shortPast[1])}) · ` +
    `장기: 3년 전 2개월(${formatYmd(longPast[0])}~${formatYmd(longPast[1])})`

  const avg = (arr: ComplexTimeSeriesItem[]) =>
    Math.round(arr.reduce((s, m) => s + (m.price10k ?? 0), 0) / arr.length)

  const statFor = (tierItems: ComplexTimeSeriesItem[], past: string[]): TrendStat => {
    const recent = tierItems.filter((m) => recentWindow.includes(m.dealYmd))
    const pastItems = tierItems.filter((m) => past.includes(m.dealYmd))
    if (!recent.length || !pastItems.length) return null
    const rAvg = avg(recent), pAvg = avg(pastItems)
    return { pct: Math.round(((rAvg - pAvg) / pAvg) * 100), delta: rAvg - pAvg }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 text-left font-medium">
                <div className="h-[52px] flex items-center">평형</div>
              </th>
              <th className="px-3 font-medium text-center">
                <div className="h-[52px] flex flex-col items-center justify-center gap-0.5">
                  <span>단기</span>
                  <span className="font-normal text-[var(--text-muted)]">%</span>
                </div>
              </th>
              <th className="px-3 font-medium text-center">
                <div className="h-[52px] flex flex-col items-center justify-center gap-0.5">
                  <span>단기</span>
                  <span className="font-normal text-[var(--text-muted)]">금액</span>
                </div>
              </th>
              <th className="px-3 font-medium text-center">
                <div className="h-[52px] flex flex-col items-center justify-center gap-0.5">
                  <span>장기</span>
                  <span className="font-normal text-[var(--text-muted)]">%</span>
                </div>
              </th>
              <th className="px-3 font-medium text-center">
                <div className="h-[52px] flex flex-col items-center justify-center gap-0.5">
                  <span>장기</span>
                  <span className="font-normal text-[var(--text-muted)]">금액</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {tiers.map((tier) => {
              const tierItems = filtered.filter((m) => m.pyeongSupplyEstimate === tier)
              const short = statFor(tierItems, shortPast)
              const long = statFor(tierItems, longPast)
              return (
                <tr key={tier}>
                  <td className="px-3 py-1 font-medium whitespace-nowrap">
                    <div>{tier}평</div>
                    <div className="text-[10px]">&nbsp;</div>
                  </td>
                  <PctCell stat={short} />
                  <AmountCell stat={short} />
                  <PctCell stat={long} />
                  <AmountCell stat={long} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-1 px-3 pb-3">{disclaimer}</p>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function Complex() {
  const [searchParams] = useSearchParams()
  const autoSearchedRef = useRef(false)
  const [query, setQuery] = useState('')
  const [complexName, setComplexName] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [kind, setKind] = useState<'trade' | 'jeonse'>('trade')
  const [items, setItems] = useState<ComplexTimeSeriesItem[]>([])
  const [chartPyeong, setChartPyeong] = useState<number | null>(null)
  const [listPyeong, setListPyeong] = useState<string>('all')
  const [periodN, setPeriodN] = useState(1)
  const [periodTotal, setPeriodTotal] = useState(1)
  const [allMonths, setAllMonths] = useState<string[]>([])
  const [listings, setListings] = useState<DaangnListing[]>([])
  const [listingStatus, setListingStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 다크모드 전환 시 차트 색상 업데이트를 위해 감지
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q) { setSuggestions([]); return }
    const res = await fetch(`${API_BASE}/api/apartments/search?q=${encodeURIComponent(q)}&limit=8`)
    if (!res.ok) return
    setSuggestions(await res.json() as Suggestion[])
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300)
  }, [query, fetchSuggestions])

  const handleSearch = useCallback(async (name: string) => {
    if (!name.trim()) return
    setSuggestions([])
    setComplexName(name)
    setQuery(name)
    setError('')
    setListPyeong('all')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/analytics/complex?name=${encodeURIComponent(name)}&kind=${kind}`)
      const data = await res.json() as ComplexTimeSeriesItem[] | { error: string }
      if (!res.ok) { setError((data as { error: string }).error ?? '오류'); return }
      const all = data as ComplexTimeSeriesItem[]
      setItems(all)
      const defaultPyeong = pickDefaultPyeong(all)
      setChartPyeong(defaultPyeong)
      const months = monthRangeFromMatches(excludeDirect(all))
      setAllMonths(months)
      setPeriodTotal(months.length || 1)
      setPeriodN(months.length || 1)

      setListingStatus('당근부동산 매물 조회 중...')
      setListings([])
      const combos = [...new Map(all.map((m) => [`${m.gu}|${m.dong}`, { gu: m.gu, dong: m.dong }])).values()].slice(0, 5)
      const results = await Promise.all(combos.map(async ({ gu, dong }) => {
        try {
          const r = await fetch(`${API_BASE}/api/daangn/listings?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&name=${encodeURIComponent(name)}`)
          if (!r.ok) return []
          return await r.json() as DaangnListing[]
        } catch { return [] }
      }))
      const flat = results.flat()
      setListings(flat)
      setListingStatus(`현재 매물 ${flat.length}건`)
    } catch {
      setError('서버 연결 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [kind])

  // URL ?name= 파라미터로 진입 시 자동 검색
  useEffect(() => {
    if (autoSearchedRef.current) return
    const nameParam = searchParams.get('name')
    if (nameParam) {
      autoSearchedRef.current = true
      setQuery(nameParam)
      handleSearch(nameParam)
    }
  }, [handleSearch, searchParams])

  const latestYmd = allMonths.at(-1) ?? null
  const startYmd = latestYmd ? shiftYmd(latestYmd, -(periodN - 1)) : null

  const periodFiltered = useMemo(
    () => items.filter((m) => !startYmd || m.dealYmd >= startYmd),
    [items, startYmd]
  )

  const listFiltered = useMemo(
    () => periodFiltered.filter((m) => listPyeong === 'all' || String(m.pyeongSupplyEstimate) === listPyeong),
    [periodFiltered, listPyeong]
  )

  const chartFiltered = useMemo(() => {
    const base = excludeDirect(periodFiltered)
    return chartPyeong ? base.filter((m) => m.pyeongSupplyEstimate === chartPyeong) : base
  }, [periodFiltered, chartPyeong])

  const chartMonths = useMemo(() => monthRangeFromMatches(chartFiltered), [chartFiltered])

  const chartData = useMemo(() => {
    const byMonth = new Map<string, number[]>()
    chartFiltered.forEach((m) => {
      if (!m.price10k) return
      if (!byMonth.has(m.dealYmd)) byMonth.set(m.dealYmd, [])
      byMonth.get(m.dealYmd)!.push(m.price10k)
    })

    const avgData: (number | null)[] = chartMonths.map((ym) => {
      const p = byMonth.get(ym)
      return p ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : null
    })
    const volumeData: number[] = chartMonths.map((ym) => byMonth.get(ym)?.length ?? 0)

    const valid = avgData.map((v, i) => ({ v, i })).filter((d): d is { v: number; i: number } => d.v != null)
    const pointColors = avgData.map(() => '#92400e')
    const pointRadii = avgData.map(() => 3)
    if (valid.length > 1) {
      const maxIdx = valid.reduce((a, b) => (b.v > a.v ? b : a)).i
      const minIdx = valid.reduce((a, b) => (b.v < a.v ? b : a)).i
      pointColors[maxIdx] = '#ef4444'
      pointColors[minIdx] = '#3b82f6'
      pointRadii[maxIdx] = 6
      pointRadii[minIdx] = 6
    }

    const pVals = avgData.filter((v): v is number => v != null)
    const pMin = pVals.length ? Math.min(...pVals) : 0
    const pMax = pVals.length ? Math.max(...pVals) : 1
    const pad = (pMax - pMin) * 0.15 || pMax * 0.08 || 1
    const priceAxisMax = pMax + pad
    const priceAxisMin = (pMin - 0.25 * priceAxisMax) / 0.75
    const maxVol = Math.max(0, ...volumeData)
    const volAxisMax = maxVol > 0 ? maxVol / 0.25 : 4

    return { chartMonths, avgData, volumeData, pointColors, pointRadii, priceAxisMin, priceAxisMax, volAxisMax }
  }, [chartFiltered, chartMonths])

  const uniquePyeong = [...new Set(excludeDirect(items).map((m) => m.pyeongSupplyEstimate))].sort((a, b) => a - b)
  const defaultPyeong = pickDefaultPyeong(items)
  const periodLabel = periodN >= periodTotal ? `최근 ${periodN}개월 (전체)` : `최근 ${periodN}개월`

  const summaryInfo = useMemo(() => {
    if (items.length === 0) return null
    const locCounts = new Map<string, number>()
    items.forEach((m) => {
      const k = `${m.gu} ${m.dong}`
      locCounts.set(k, (locCounts.get(k) ?? 0) + 1)
    })
    const topLoc = [...locCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const byYear = items.map((m) => m.build_year).filter((y): y is number => y != null)
    const buildYear = byYear.length ? Math.round(byYear.reduce((a, b) => a + b, 0) / byYear.length) : null
    const age = buildYear ? new Date().getFullYear() - buildYear + 1 : null
    return { topLoc, age, count: items.length }
  }, [items])

  // isDark 변경 시 차트 색상 재계산 (CSS 변수 읽기)
  const chartColors = useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    return {
      grid: cs.getPropertyValue('--chart-grid').trim() || '#e2e8f0',
      tickLabel: cs.getPropertyValue('--text-muted').trim() || '#9ca3af',
      axisTitle: cs.getPropertyValue('--text-secondary').trim() || '#64748b',
    }
  }, [isDark])

  const chartOptions: ChartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 24, bottom: 14 } },
    scales: {
      x: {
        grid: { display: false }, // 세로 그리드는 xYearLabelPlugin으로 연도 경계만 표시
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          color: chartColors.tickLabel,
          callback: (_: unknown, index: number) => {
            const ym = chartData.chartMonths[index]
            return ym ? ym.slice(4, 6) : ''
          },
        },
        // 연도 라벨 행을 위한 추가 공간 확보
        afterFit(scale: { height: number }) { scale.height += 18 },
      },
      price: {
        type: 'linear', position: 'left',
        min: chartData.priceAxisMin, max: chartData.priceAxisMax,
        title: { display: true, text: '평균 거래가(억)', color: chartColors.axisTitle },
        grid: { color: chartColors.grid },
        ticks: {
          color: chartColors.tickLabel,
          callback: (v) => `${formatEok(v as number)}억`,
        },
      },
      volume: {
        type: 'linear', position: 'right',
        min: 0, max: chartData.volAxisMax,
        ticks: { precision: 0, color: chartColors.tickLabel },
        grid: { drawOnChartArea: false },
        title: { display: true, text: '거래량(건)', color: chartColors.axisTitle },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ctx.dataset.type === 'bar'
            ? `거래량: ${ctx.parsed.y}건`
            : `평균 거래가: ${formatEok(ctx.parsed.y ?? 0)}억`,
        },
      },
    },
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-5">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">단지 시세</h1>

      {/* 검색 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setItems([]) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              placeholder="단지명 검색 (예: 마포래미안푸르지오)"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-lg text-sm divide-y divide-[var(--border-color)]">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => handleSearch(s.name)}
                    className="px-3 py-2 hover:bg-[var(--bg-muted)] cursor-pointer"
                  >
                    <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                    <span className="ml-2 text-[var(--text-muted)] text-xs">{s.gu} {s.dong}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as 'trade' | 'jeonse')}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trade">매매</SelectItem>
              <SelectItem value="jeonse">전세</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleSearch(query)} disabled={loading || !query.trim()}>
            {loading ? '조회 중…' : '조회'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {items.length > 0 && (
        <>
          {/* 단지 요약 */}
          {summaryInfo && (
            <div className="rounded-lg bg-gray-900 dark:bg-gray-700 text-white px-4 py-3">
              <div className="font-bold text-lg">{complexName}</div>
              <div className="text-xs text-gray-300 mt-1">
                {summaryInfo.topLoc}{summaryInfo.age ? ` · ${summaryInfo.age}년차` : ''} · 실거래 {summaryInfo.count}건
              </div>
            </div>
          )}

          {/* 분기별 최고가 + 단기/장기 추세 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">분기별 최고가</h2>
              </div>
              <QuarterlyTable items={items} />
              <p className="text-[10px] text-[var(--text-muted)] px-3 pb-3 mt-1">
                전년동분기 · 2분기전 · 전분기 · 해당분기 순. 직거래 제외. 최고 분기는 빨간 박스.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">단기/장기 추세</h2>
              </div>
              <TrendTable items={items} />
            </div>
          </div>

          {/* 평형 탭 + 기간 슬라이더 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {uniquePyeong.map((p) => (
                <Button
                  key={p}
                  variant={chartPyeong === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartPyeong(p)}
                >
                  {p}평{p === defaultPyeong ? ' (최다)' : ''}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 min-w-[240px]">
              <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">기간</span>
              <input
                type="range"
                min={1}
                max={periodTotal}
                value={periodN}
                onChange={(e) => setPeriodN(Number(e.target.value))}
                className="flex-1 accent-gray-700 dark:accent-gray-400"
              />
              <span className="text-sm text-[var(--text-muted)] whitespace-nowrap w-28 text-right">{periodLabel}</span>
            </div>
          </div>

          {/* 차트 */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              월평균 매매가 추이{chartPyeong ? ` — ${chartPyeong}평` : ''}
            </h2>
            <Chart
              type="bar"
              data={{
                labels: chartData.chartMonths,
                datasets: [
                  {
                    type: 'bar',
                    label: '거래량(건)',
                    data: chartData.volumeData,
                    yAxisID: 'volume',
                    backgroundColor: '#64748b26',
                    borderColor: '#64748b80',
                    borderWidth: 1,
                    order: 1,
                  },
                  {
                    type: 'line',
                    label: '월평균 매매가',
                    data: chartData.avgData,
                    yAxisID: 'price',
                    borderColor: '#92400e',
                    backgroundColor: '#92400e22',
                    pointBackgroundColor: chartData.pointColors,
                    pointRadius: chartData.pointRadii,
                    spanGaps: true,
                    tension: 0.2,
                    order: 0,
                  },
                ],
              }}
              options={chartOptions}
              plugins={[maxMinLabelPlugin, xYearLabelPlugin]}
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-2">
              붉은 점·라벨: 최고가, 파란 점·라벨: 최저가. 괄호 안은 현재가 대비 변동폭. 직거래 제외.
            </p>
          </div>

          {/* 실거래 목록 */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-4">
              <span className="text-sm font-medium text-[var(--text-primary)]">거래 내역 {listFiltered.length}건</span>
              <select
                value={listPyeong}
                onChange={(e) => setListPyeong(e.target.value)}
                className="border border-[var(--input-border)] bg-[var(--bg-surface)] text-[var(--text-primary)] rounded px-2 py-1 text-sm"
              >
                <option value="all">전체 평형</option>
                {uniquePyeong.map((p) => (
                  <option key={p} value={String(p)}>{p}평형</option>
                ))}
              </select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구</TableHead>
                  <TableHead>동</TableHead>
                  <TableHead>면적(㎡)</TableHead>
                  <TableHead>평형</TableHead>
                  <TableHead>층</TableHead>
                  <TableHead>가격</TableHead>
                  <TableHead>거래일</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listFiltered.slice(0, 150).map((item, i) => {
                  const isDirect = item.deal_type === '직거래'
                  return (
                    <TableRow key={i} className={isDirect ? 'opacity-50' : ''}>
                      <TableCell className="text-[var(--text-primary)]">{item.gu}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{item.dong}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {(item.supplyAreaM2Estimate ?? item.area_m2)?.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {(item.pyeongSupplyEstimate ?? item.pyeong)}평
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{item.floor}층</TableCell>
                      <TableCell className="font-semibold">{formatPrice(item.price10k)}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{item.deal_date}</TableCell>
                      <TableCell className="text-xs text-[var(--text-muted)]">
                        {isDirect ? '직거래 제외' : ''}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* 당근부동산 매물 */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text-primary)]">당근부동산 현재 매물</h2>
              <span className="text-xs text-[var(--text-muted)]">{listingStatus}</span>
            </div>
            {listings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>건물명</TableHead>
                    <TableHead>동</TableHead>
                    <TableHead>면적(㎡)</TableHead>
                    <TableHead>평형</TableHead>
                    <TableHead>층</TableHead>
                    <TableHead>거래유형</TableHead>
                    <TableHead>호가</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{l.buildingName || '-'}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{l.addressInfo || '-'}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {l.supplyAreaM2Estimate?.toFixed(1) ?? '-'}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {l.pyeongSupplyEstimate != null ? `${l.pyeongSupplyEstimate}평` : '-'}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{l.floor ?? '-'}</TableCell>
                      <TableCell>{l.trade.tradeType}</TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(l.trade.tradeType === '매매' ? l.trade.price10k : l.trade.deposit10k)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-[var(--text-muted)] p-5">
                {listingStatus || '단지 검색 후 매물을 조회합니다.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
