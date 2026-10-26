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

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, PointElement, LineElement, Tooltip, Legend)

interface SeoulTrendItem {
  dealYmd: string
  count: number
  avgPricePerPyeong10k: number
}

interface SeoulTrendChartProps {
  kind?: 'trade' | 'jeonse'
}

function formatEok(p10k: number): string {
  return (p10k / 10000).toFixed(1)
}

// ─── x축 연도 라벨 플러그인 (연도를 해당 연도 틱 범위 중앙에 표시) ───────────

const xYearLabelPlugin = {
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
      ctx.fillText(`'${yy}`, cx, xScale.bottom - 14)
    })

    ctx.restore()
  },
}

export default function SeoulTrendChart({ kind = 'trade' }: SeoulTrendChartProps) {
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
    fetch(`${API_BASE}/api/analytics/seoul-time-series?kind=${kind}`)
      .then((r) => r.json())
      .then((data: SeoulTrendItem[]) => setItems(data))
      .finally(() => setLoading(false))
  }, [kind])

  const chartColors = useMemo(() => {
    const cs = getComputedStyle(document.documentElement)
    return {
      grid: cs.getPropertyValue('--chart-grid').trim() || '#e2e8f0',
      tickLabel: cs.getPropertyValue('--text-muted').trim() || '#9ca3af',
      axisTitle: cs.getPropertyValue('--text-secondary').trim() || '#64748b',
    }
  }, [isDark])

  const months = useMemo(() => items.map((i) => i.dealYmd), [items])
  const avgData = useMemo(() => items.map((i) => i.avgPricePerPyeong10k), [items])
  const volumeData = useMemo(() => items.map((i) => i.count), [items])
  const maxVol = Math.max(0, ...volumeData)

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
        afterFit(scale: { height: number }) { scale.height += 18 },
      },
      price: {
        type: 'linear', position: 'left',
        title: { display: true, text: '평단가(억)', color: chartColors.axisTitle },
        grid: { color: chartColors.grid },
        ticks: {
          color: chartColors.tickLabel,
          callback: (v) => `${formatEok(v as number)}억`,
        },
      },
      volume: {
        type: 'linear', position: 'right',
        min: 0, max: maxVol > 0 ? maxVol / 0.25 : 4,
        ticks: { precision: 0, color: chartColors.tickLabel },
        grid: { drawOnChartArea: false },
        title: { display: true, text: '거래량(건)', color: chartColors.axisTitle },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (ctx) => {
            const ym = months[ctx[0]?.dataIndex ?? 0]
            return ym ? `${ym.slice(0, 4)}.${ym.slice(4, 6)}` : ''
          },
          label: (ctx) => ctx.dataset.type === 'bar'
            ? `거래량: ${ctx.parsed.y}건`
            : `평단가: ${formatEok(ctx.parsed.y ?? 0)}억`,
        },
      },
    },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm text-[var(--text-muted)]">불러오는 중...</span>
      </div>
    )
  }

  return (
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
          ],
        }}
        options={chartOptions}
        plugins={[xYearLabelPlugin]}
      />
    </div>
  )
}
