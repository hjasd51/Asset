import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '@/lib/api'
import { TIERS, getTierFill, getTierShort } from '@/lib/tier'

interface YearlyItem {
  district: string
  year: string
  count: number
  avgPricePerPyeong10k: number
}

function formatEok(p10k: number): string {
  return (p10k / 10000).toFixed(2)
}

export default function DistrictTierHeatmapTable() {
  const [items, setItems] = useState<YearlyItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/analytics/district-yearly?kind=trade`)
      .then((r) => r.json())
      .then((data: YearlyItem[]) => setItems(data))
      .finally(() => setLoading(false))
  }, [])

  // 백엔드가 이미 구(가나다순)·연도 오름차순으로 정렬해 내려주므로 Set 삽입 순서를 그대로 쓴다.
  const years = useMemo(() => [...new Set(items.map((i) => i.year))], [items])
  const districts = useMemo(() => [...new Set(items.map((i) => i.district))], [items])
  const byKey = useMemo(() => new Map(items.map((i) => [`${i.district}|${i.year}`, i])), [items])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm text-[var(--text-muted)]">불러오는 중...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[var(--bg-surface)] text-left font-medium text-[var(--text-secondary)] px-1.5 py-1">
                구
              </th>
              {years.map((y) => (
                <th key={y} className="font-medium text-[var(--text-secondary)] px-1 py-1 text-center">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <tr key={d}>
                <td className="sticky left-0 bg-[var(--bg-surface)] whitespace-nowrap text-[var(--text-primary)] px-1.5 py-0.5">
                  {d}
                </td>
                {years.map((y) => {
                  const item = byKey.get(`${d}|${y}`)
                  if (!item) {
                    return (
                      <td key={y} className="text-center text-[var(--text-muted)] px-1 py-0.5">
                        -
                      </td>
                    )
                  }
                  return (
                    <td
                      key={y}
                      className="text-center px-1 py-0.5"
                      title={`${d} ${y}년: ${formatEok(item.avgPricePerPyeong10k)}억/평 (${item.count.toLocaleString()}건)`}
                    >
                      <span
                        className="inline-block w-full rounded text-white font-medium py-0.5"
                        style={{ backgroundColor: getTierFill(item.avgPricePerPyeong10k) }}
                      >
                        {getTierShort(item.avgPricePerPyeong10k)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-3">
        {TIERS.map((t) => (
          <div key={t.label} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.fill }} />
            {t.label}
          </div>
        ))}
      </div>
    </div>
  )
}
