import { useEffect, useMemo, useState } from 'react'
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
import { API_BASE } from '@/lib/api'
import { getTierFill, getTierShort } from '@/lib/tier'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, PointElement, LineElement, Tooltip, Legend)

const DISTRICTS = [
  '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
  '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
  '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구',
]

type Period = '1y' | '3y' | 'all'

interface SeoulTrendItem {
  dealYmd: string
  count: number
  avgPricePerPyeong10k: number
}

function formatEok(p10k: number): string {
  return (p10k / 10000).toFixed(1)
}

function yoyYmd(ymd: string): string {
  const year = Number(ymd.slice(0, 4)) - 1
  return `${year}${ymd.slice(4, 6)}`
}

// ─── x축 연도 라벨 플러그인 (연도 + 해당 연도 평균가 기준 급지 뱃지를 연도 틱 범위 중앙에 표시) ───────────

function makeYearTierPlugin(yearAvgPrice: Map<string, number>) {
  return {
    id: 'xYearLabelTrend',
    afterDraw(chartInstance: ChartType) {
      const xScale = chartInstance.scales['x']
      if (!xScale?.ticks?.length) return
      const labels = chartInstance.data.labels as string[]
      const { ctx, chartArea } = chartInstance

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

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.font = '10px sans-serif'
      ctx.fillStyle = mutedColor
      yearMap.forEach((xs, yy) => {
        if (!xs.length) return
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2
        ctx.fillText(`'${yy}`, cx, xScale.bottom - 46)
      })
      ctx.restore()

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 13px sans-serif'
      const badgeW = 36
      const badgeH = 22
      const badgeCy = xScale.bottom - 18
      yearMap.forEach((xs, yy) => {
        if (!xs.length) return
        const avgPrice = yearAvgPrice.get(yy)
        if (avgPrice == null) return
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2
        ctx.fillStyle = getTierFill(avgPrice)
        ctx.beginPath()
        ctx.roundRect(cx - badgeW / 2, badgeCy - badgeH / 2, badgeW, badgeH, 4)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.fillText(getTierShort(avgPrice), cx, badgeCy + 0.5)
      })
      ctx.restore()
    },
  }
}

export default function SeoulTrendChart() {
  const [kind, setKind] = useState<'trade' | 'jeonse'>('trade')
  const [scope, setScope] = useState<string>('')
  const [period, setPeriod] = useState<Period>('all')
  const [showYoY, setShowYoY] = useState(false)
  const [items, setItems] = useState<SeoulTrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setLoading(true)
    const url = scope
      ? `${API_BASE}/api/analytics/district-time-series?district=${encodeURIComponent(scope)}&kind=${kind}`
      : `${API_BASE}/api/analytics/seoul-time-series?kind=${kind}`
    fetch(url)
      .then((r) => r.json())
      .then((data: SeoulTrendItem[]) => setItems(data))
      .finally(() => setLoading(false))
  }, [kind, scope])

  const chartColors = useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    return {
      grid: cs.getPropertyValue('--chart-grid').trim() || '#e2e8f0',
      tickLabel: cs.getPropertyValue('--text-muted').trim() || '#9ca3af',
      axisTitle: cs.getPropertyValue('--text-secondary').trim() || '#64748b',
    }
  }, [isDark])

  const byYmd = useMemo(() => new Map(items.map((i) => [i.dealYmd, i.avgPricePerPyeong10k])), [items])

  const displayed = useMemo(() => {
    if (period === 'all') return items
    const n = period === '1y' ? 12 : 36
    return items.slice(-n)
  }, [items, period])

  const months = useMemo(() => displayed.map((i) => i.dealYmd), [displayed])
  const avgData = useMemo(() => displayed.map((i) => i.avgPricePerPyeong10k), [displayed])
  const volumeData = useMemo(() => displayed.map((i) => i.count), [displayed])
  const yoyData = useMemo(
    () => displayed.map((i) => byYmd.get(yoyYmd(i.dealYmd)) ?? null),
    [displayed, byYmd]
  )
  const maxVol = Math.max(0, ...volumeData)

  // 연도(2자리)별 거래량 가중평균가 — x축 연도 라벨 밑 급지 뱃지 색상 계산용
  const yearAvgPrice = useMemo(() => {
    const sums = new Map<string, { weighted: number; count: number }>()
    displayed.forEach((i) => {
      const yy = i.dealYmd.slice(2, 4)
      if (!sums.has(yy)) sums.set(yy, { weighted: 0, count: 0 })
      const s = sums.get(yy)!
      s.weighted += i.avgPricePerPyeong10k * i.count
      s.count += i.count
    })
    const result = new Map<string, number>()
    sums.forEach((s, yy) => { if (s.count > 0) result.set(yy, s.weighted / s.count) })
    return result
  }, [displayed])
  const yearTierPlugin = useMemo(() => makeYearTierPlugin(yearAvgPrice), [yearAvgPrice])

  // 평단가 축: 전체 범위(0~최대)가 아니라 실제 데이터 범위에 여백만 살짝 두고 타이트하게 잡아서
  // 미세한 변동도 눈에 띄도록 함 (기본 auto-scale은 여백이 커서 선이 평평해 보임)
  const priceValues = [...avgData, ...(showYoY ? yoyData : [])].filter(
    (v): v is number => typeof v === 'number'
  )
  const priceMin = priceValues.length ? Math.min(...priceValues) : 0
  const priceMax = priceValues.length ? Math.max(...priceValues) : 1
  const pricePad = Math.max((priceMax - priceMin) * 0.15, priceMax * 0.03, 1)

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 10, bottom: 14 } },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          color: chartColors.tickLabel,
          callback: (_: unknown, index: number) => {
            const ym = months[index]
            return ym ? ym.slice(4, 6) : ''
          },
        },
        afterFit(scale: { height: number }) { scale.height += 50 },
      },
      price: {
        type: 'linear', position: 'left',
        min: Math.max(0, priceMin - pricePad),
        max: priceMax + pricePad,
        title: { display: true, text: '평단가(억)', color: chartColors.axisTitle },
        grid: { color: chartColors.grid },
        ticks: {
          color: chartColors.tickLabel,
          callback: (v) => `${formatEok(v as number)}억`,
        },
      },
      volume: {
        type: 'linear', position: 'right',
        min: 0, max: maxVol > 0 ? maxVol / 0.6 : 4,
        ticks: { precision: 0, color: chartColors.tickLabel },
        grid: { drawOnChartArea: false },
        title: { display: true, text: '거래량(건)', color: chartColors.axisTitle },
      },
    },
    plugins: {
      legend: {
        display: showYoY,
        labels: { color: chartColors.axisTitle, boxWidth: 12, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          title: (ctx) => {
            const ym = months[ctx[0]?.dataIndex ?? 0]
            return ym ? `${ym.slice(0, 4)}.${ym.slice(4, 6)}` : ''
          },
          label: (ctx) => ctx.dataset.type === 'bar'
            ? `거래량: ${ctx.parsed.y}건`
            : `${ctx.dataset.label}: ${formatEok(ctx.parsed.y ?? 0)}억`,
        },
      },
    },
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">종류</label>
          <Select value={kind} onValueChange={(v) => setKind(v as 'trade' | 'jeonse')}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trade">매매</SelectItem>
              <SelectItem value="jeonse">전세</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">지역</label>
          <Select value={scope || '__seoul__'} onValueChange={(v) => setScope(v === '__seoul__' ? '' : v)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__seoul__">서울 전체</SelectItem>
              {DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">기간</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1y">최근 1년</SelectItem>
              <SelectItem value="3y">최근 3년</SelectItem>
              <SelectItem value="all">전체</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant={showYoY ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowYoY((v) => !v)}
        >
          전년 동월 비교
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm text-[var(--text-muted)]">불러오는 중...</span>
        </div>
      ) : (
        <div className="h-64">
          <Chart
            type="bar"
            data={{
              labels: months,
              datasets: [
                {
                  type: 'bar',
                  label: '거래량(건)',
                  data: volumeData,
                  yAxisID: 'volume',
                  backgroundColor: '#64748b26',
                  borderColor: '#64748b80',
                  borderWidth: 1,
                  order: 1,
                },
                {
                  type: 'line',
                  label: '평단가',
                  data: avgData,
                  yAxisID: 'price',
                  borderColor: '#92400e',
                  backgroundColor: '#92400e22',
                  pointRadius: 0,
                  spanGaps: true,
                  tension: 0.2,
                  order: 0,
                },
                ...(showYoY
                  ? [
                      {
                        type: 'line' as const,
                        label: '평단가(전년 동월)',
                        data: yoyData,
                        yAxisID: 'price',
                        borderColor: '#92400e80',
                        borderDash: [4, 4],
                        pointRadius: 0,
                        spanGaps: true,
                        tension: 0.2,
                        order: 0,
                      },
                    ]
                  : []),
              ],
            }}
            options={chartOptions}
            plugins={[yearTierPlugin]}
          />
        </div>
      )}
    </div>
  )
}
