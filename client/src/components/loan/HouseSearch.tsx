import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { API_BASE } from '@/lib/api'
import { formatManwon } from '@/lib/loanFormat'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ComplexAreaPrice, ComplexSuggestion } from '@/types/loan'

export interface SelectedHouse {
  complex: ComplexSuggestion
  // 가격 데이터가 없거나 불러오지 못하면 null (단지·구는 확정, 가격은 직접 입력)
  area: ComplexAreaPrice | null
}

interface HouseSearchProps {
  // 단지·타입이 확정되면 호출 (null이면 선택 해제)
  onChange: (house: SelectedHouse | null) => void
}

// 구매할 집 검색: 단지명 자동완성 → 전용면적(타입) 선택
export default function HouseSearch({ onChange }: HouseSearchProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ComplexSuggestion[]>([])
  const [complex, setComplex] = useState<ComplexSuggestion | null>(null)
  const [areas, setAreas] = useState<ComplexAreaPrice[]>([])
  const [areaKey, setAreaKey] = useState('')
  const [error, setError] = useState('')

  // 자동완성 (입력 후 300ms)
  useEffect(() => {
    if (complex || !query.trim()) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/apartments/search?q=${encodeURIComponent(query)}&limit=8`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: ComplexSuggestion[]) => { if (!cancelled) setSuggestions(data) })
        .catch(() => { if (!cancelled) setSuggestions([]) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, complex])

  const handlePick = async (s: ComplexSuggestion) => {
    setComplex(s)
    setQuery(s.name)
    setSuggestions([])
    setError('')
    setAreas([])
    setAreaKey('')
    // 가격 조회 성공 여부와 상관없이 단지(구)는 먼저 확정한다
    onChange({ complex: s, area: null })
    try {
      const res = await fetch(
        `${API_BASE}/api/apartments/prices?gu=${encodeURIComponent(s.gu)}&dong=${encodeURIComponent(s.dong)}&name=${encodeURIComponent(s.name)}`
      )
      const list = res.ok ? ((await res.json()) as ComplexAreaPrice[]) : []
      setAreas(list)
      if (list.length === 0) {
        setError('실거래 내역이 없어 주택가격을 직접 입력해야 해요.')
        return
      }
      // 기본 평형은 거래가 가장 많은 평형 (단지 시세의 기본 선택과 동일)
      const defaultArea = list.reduce((best, a) => (a.totalCount > best.totalCount ? a : best), list[0])
      setAreaKey(String(defaultArea.pyeongSupplyEstimate))
      onChange({ complex: s, area: defaultArea })
    } catch {
      setError('단지 가격을 불러오지 못했어요. 주택가격을 직접 입력해 주세요.')
    }
  }

  const handleAreaChange = (key: string) => {
    setAreaKey(key)
    const area = areas.find((a) => String(a.pyeongSupplyEstimate) === key)
    if (complex && area) onChange({ complex, area })
  }

  const selectedArea = areas.find((a) => String(a.pyeongSupplyEstimate) === areaKey) ?? null

  const handleClear = () => {
    setComplex(null)
    setQuery('')
    setAreas([])
    setAreaKey('')
    setError('')
    onChange(null)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="houseSearch">구매할 집</Label>
        <div className="relative">
          <Input
            id="houseSearch"
            value={query}
            placeholder="단지명을 검색해 보세요 (예: 한마을)"
            readOnly={complex != null}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-9"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg">
              {suggestions.map((s) => (
                <li key={`${s.gu}-${s.dong}-${s.name}`}>
                  <button
                    type="button"
                    onClick={() => handlePick(s)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--bg-muted)]"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{s.gu} {s.dong}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {complex && (
          <p className="text-xs text-[var(--text-muted)]">서울시 {complex.gu} {complex.dong}</p>
        )}
        {error && <p className="text-xs text-amber-600">{error}</p>}
      </div>

      {areas.length > 0 && (
        <div className="space-y-1.5">
          <Label>평형</Label>
          <Select value={areaKey} onValueChange={handleAreaChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a.pyeongSupplyEstimate} value={String(a.pyeongSupplyEstimate)}>
                  {a.pyeongSupplyEstimate}평형 · 공급 약 {a.supplyAreaM2Estimate}㎡ (전용 {a.exclusiveAreaM2}㎡) · 거래 {a.totalCount}건
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedArea && (
            <div className="rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              <p className="mb-1 font-medium text-[var(--text-primary)]">최근 실거래 (직거래 제외)</p>
              <ul className="space-y-0.5">
                {selectedArea.recentTrades.map((t) => (
                  <li key={`${t.dealDate}-${t.floor}-${t.price10k}`} className="flex justify-between">
                    <span>{t.dealDate}{t.floor != null ? ` · ${t.floor}층` : ''}</span>
                    <span className="font-medium text-[var(--text-primary)]">{formatManwon(t.price10k)}</span>
                  </li>
                ))}
              </ul>
              {complex && (
                <Link
                  to={`/complex?name=${encodeURIComponent(complex.name)}`}
                  className="mt-1.5 inline-block text-emerald-600 underline underline-offset-2 hover:text-emerald-500"
                >
                  단지 시세에서 자세히 보기
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
