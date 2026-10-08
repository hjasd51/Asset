import { Fragment, useState } from 'react'
import { ComposableMap, Geographies, Geography, Annotation } from 'react-simple-maps'

export type HeatmapMode = 'tier' | 'countChange' | 'priceChange'

export interface DistrictMapData {
  district: string
  count: number
  countPrevMonth: number | null
  avgPricePerPyeong10k: number
  avgPricePrevMonth: number | null
}

const GEO_URL = '/seoul-districts.geojson'

const TIERS = [
  { min: 12000, fill: '#dc2626', label: '최상 (12억+)' },
  { min: 7000,  fill: '#f97316', label: '상 (7~12억)' },
  { min: 5000,  fill: '#eab308', label: '중상 (5~7억)' },
  { min: 3500,  fill: '#84cc16', label: '중 (3.5~5억)' },
  { min: 2500,  fill: '#38bdf8', label: '중하 (2.5~3.5억)' },
  { min: 0,     fill: '#818cf8', label: '하 (~2.5억)' },
]

const CHANGE_STEPS = [
  { threshold: 5,         fill: '#ef4444' },
  { threshold: 2,         fill: '#f97316' },
  { threshold: -2,        fill: '#9ca3af' },
  { threshold: -5,        fill: '#60a5fa' },
  { threshold: -Infinity, fill: '#3b82f6' },
]

const CHANGE_LEGEND = [
  { fill: '#ef4444', label: '+5% 이상' },
  { fill: '#f97316', label: '+2~5%' },
  { fill: '#9ca3af', label: '-2~+2%' },
  { fill: '#60a5fa', label: '-2~-5%' },
  { fill: '#3b82f6', label: '-5% 이하' },
]

function getTierFill(price: number): string {
  for (const t of TIERS) if (price >= t.min) return t.fill
  return TIERS[TIERS.length - 1].fill
}

function getTierShort(price: number): string {
  for (const t of TIERS) if (price >= t.min) return t.label.split(' ')[0]
  return '하'
}

function getChangeFill(pct: number): string {
  for (const s of CHANGE_STEPS) if (pct >= s.threshold) return s.fill
  return CHANGE_STEPS[CHANGE_STEPS.length - 1].fill
}

function getFill(mode: HeatmapMode, data: DistrictMapData | undefined): string {
  if (!data) return '#e5e7eb'
  if (mode === 'tier') return getTierFill(data.avgPricePerPyeong10k)
  if (mode === 'countChange') {
    if (!data.countPrevMonth) return '#e5e7eb'
    return getChangeFill(((data.count - data.countPrevMonth) / data.countPrevMonth) * 100)
  }
  if (mode === 'priceChange') {
    if (!data.avgPricePrevMonth) return '#e5e7eb'
    return getChangeFill(((data.avgPricePerPyeong10k - data.avgPricePrevMonth) / data.avgPricePrevMonth) * 100)
  }
  return '#e5e7eb'
}

// 모드별 레이블 값 (구 이름 아래 두 번째 줄)
function getValueLabel(mode: HeatmapMode, data: DistrictMapData | undefined): string {
  if (!data) return ''
  if (mode === 'tier') {
    return getTierShort(data.avgPricePerPyeong10k)
  }
  if (mode === 'countChange') {
    if (!data.countPrevMonth) return '-'
    const pct = ((data.count - data.countPrevMonth) / data.countPrevMonth) * 100
    return `${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%`
  }
  if (mode === 'priceChange') {
    if (!data.avgPricePrevMonth) return '-'
    const pct = ((data.avgPricePerPyeong10k - data.avgPricePrevMonth) / data.avgPricePrevMonth) * 100
    return `${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%`
  }
  return ''
}

// 폴리곤/멀티폴리곤 바운딩박스 중심 계산
function getCentroid(geometry: { type: string; coordinates: unknown }): [number, number] {
  let ring: number[][]
  if (geometry.type === 'Polygon') {
    ring = (geometry.coordinates as number[][][])[0]
  } else {
    const polys = geometry.coordinates as number[][][][]
    ring = polys.map((p) => p[0]).reduce((a, b) => (a.length > b.length ? a : b))
  }
  const lngs = ring.map((c) => c[0])
  const lats = ring.map((c) => c[1])
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ]
}

interface HoverInfo {
  name: string
  data: DistrictMapData | undefined
}

interface Props {
  mode: HeatmapMode
  districtMap: Map<string, DistrictMapData>
}

export default function SeoulMap({ mode, districtMap }: Props) {
  const [hovered, setHovered] = useState<HoverInfo | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {/* 지도 — 카드 전체 너비 */}
      <div className="relative" style={{ aspectRatio: '1.35' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [126.986, 37.555], scale: 90000 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {/* 1패스: 폴리곤 전체 먼저 */}
                {geographies.map((geo) => {
                  const name: string = geo.properties.name
                  const data = districtMap.get(name)
                  const fill = getFill(mode, data)
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#ffffff"
                      strokeWidth={0.6}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', opacity: 0.75, cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() => setHovered({ name, data })}
                      onMouseLeave={() => setHovered(null)}
                    />
                  )
                })}
                {/* 2패스: 레이블 전체를 폴리곤 위에 */}
                {geographies.map((geo) => {
                  const name: string = geo.properties.name
                  const data = districtMap.get(name)
                  const centroid = getCentroid(geo.geometry as { type: string; coordinates: unknown })
                  const valueLabel = getValueLabel(mode, data)
                  return (
                    <Annotation key={`lbl-${geo.rsmKey}`} subject={centroid} dx={0} dy={0} connectorProps={{ stroke: 'none' }}>
                      <text textAnchor="middle" style={{ pointerEvents: 'none' }}>
                        <tspan
                          x="0"
                          y="-8"
                          fontSize={15}
                          fontWeight={700}
                          fill="white"
                          stroke="rgba(0,0,0,0.55)"
                          strokeWidth={4}
                          paintOrder="stroke"
                        >
                          {name.slice(0, -1)}
                        </tspan>
                        {valueLabel && (
                          <tspan
                            x="0"
                            y="11"
                            fontSize={13}
                            fontWeight={600}
                            fill="rgba(255,255,255,0.95)"
                            stroke="rgba(0,0,0,0.5)"
                            strokeWidth={3.5}
                            paintOrder="stroke"
                          >
                            {valueLabel}
                          </tspan>
                        )}
                      </text>
                    </Annotation>
                  )
                })}
              </>
            )}
          </Geographies>
        </ComposableMap>

        {/* 호버 정보 오버레이 */}
        {hovered && hovered.data && (
          <HoverPanel name={hovered.name} data={hovered.data} mode={mode} />
        )}
      </div>

      {/* 범례 */}
      <div className="px-4 pb-4">
        <Legend mode={mode} />
      </div>
    </div>
  )
}

function HoverPanel({ name, data, mode }: { name: string; data: DistrictMapData; mode: HeatmapMode }) {
  const price = data.avgPricePerPyeong10k
  const priceStr = `${(price / 10000).toFixed(2)}억/평`
  const tierLabel = getTierShort(price)

  let changeStr = '-'
  if (mode === 'countChange' && data.countPrevMonth) {
    const pct = ((data.count - data.countPrevMonth) / data.countPrevMonth) * 100
    changeStr = `${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%`
  } else if (mode === 'priceChange' && data.avgPricePrevMonth) {
    const pct = ((price - data.avgPricePrevMonth) / data.avgPricePrevMonth) * 100
    changeStr = `${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%`
  }

  return (
    <div className="absolute top-2 right-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur p-3 min-w-[130px] shadow-md pointer-events-none">
      <p className="text-sm font-bold text-[var(--text-primary)] mb-1.5">{name}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-[var(--text-muted)]">급지</span>
          <span className="font-medium text-[var(--text-primary)]">{tierLabel}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[var(--text-muted)]">평단가</span>
          <span className="font-medium text-[var(--text-primary)]">{priceStr}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[var(--text-muted)]">거래량</span>
          <span className="font-medium text-[var(--text-primary)]">{data.count.toLocaleString()}건</span>
        </div>
        {mode !== 'tier' && (
          <div className="flex justify-between gap-3 pt-0.5 border-t border-[var(--border-color)]">
            <span className="text-[var(--text-muted)]">전월비</span>
            <span className={`font-semibold ${changeStr.startsWith('▲') ? 'text-rose-500' : changeStr.startsWith('▼') ? 'text-blue-500' : 'text-[var(--text-muted)]'}`}>
              {changeStr}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function Legend({ mode }: { mode: HeatmapMode }) {
  const items = mode === 'tier' ? TIERS.map((t) => ({ fill: t.fill, label: t.label })) : CHANGE_LEGEND
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.fill }} />
          {item.label}
        </div>
      ))}
    </div>
  )
}
