import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/lib/api'
import LoanForm, { type PreviewBase } from '@/components/loan/LoanForm'
import LoanNotice from '@/components/loan/LoanNotice'
import LoanResult, { type HouseInfo } from '@/components/loan/LoanResult'
import RegulationSection from '@/components/loan/RegulationSection'
import type { LoanConditions, LoanConfig, PreviewRequest, PreviewResult } from '@/types/loan'

// 설정 API를 못 불러올 때 쓰는 최소 기본값
const FALLBACK_CONDITIONS: LoanConditions = { annualRatePct: 5, years: 30, stressRatePct: 2.4 }

export default function Loan() {
  const [config, setConfig] = useState<LoanConfig | null>(null)
  const [conditions, setConditions] = useState<LoanConditions>(FALLBACK_CONDITIONS)
  const [base, setBase] = useState<PreviewBase | null>(null)
  const [houseInfo, setHouseInfo] = useState<HouseInfo | null>(null)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const resultRef = useRef<HTMLDivElement>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    fetch(`${API_BASE}/api/loan/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: LoanConfig) => {
        setConfig(data)
        setConditions(data.defaults)
      })
      .catch(() => setError('규제 설정을 불러오지 못해 기본값으로 계산해요.'))
  }, [])

  const runPreview = useCallback(async (payload: PreviewRequest, scrollToResult: boolean) => {
    const seq = ++requestSeq.current
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/loan/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as PreviewResult | { error: string }
      if (seq !== requestSeq.current) return // 더 최근 요청이 있으면 무시
      if (!res.ok) {
        setError((data as { error: string }).error ?? '계산 중 오류가 발생했습니다.')
        return
      }
      setResult(data as PreviewResult)
      if (scrollToResult) {
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch {
      if (seq === requestSeq.current) setError('서버 연결 오류가 발생했습니다.')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  const handleSubmit = (nextBase: PreviewBase, nextHouseInfo: HouseInfo | null) => {
    setBase(nextBase)
    setHouseInfo(nextHouseInfo)
    runPreview({ ...nextBase, ...conditions }, true)
  }

  // 결과 화면에서 금리/기간/스트레스 금리를 바꾸면 같은 입력값으로 다시 계산
  const handleChangeConditions = (next: LoanConditions) => {
    setConditions(next)
    if (base) runPreview({ ...base, ...next }, false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">주담대 미리보기</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">최신 규제가 적용된 예상 대출한도를 확인할 수 있어요.</p>
      </div>

      <LoanForm districts={config?.regulatedDistricts ?? []} loading={loading} onSubmit={handleSubmit} />

      {error && !result && <p className="text-sm text-red-500">{error}</p>}

      {result && base && (
        <div ref={resultRef} className="scroll-mt-28 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <LoanResult
            result={result}
            housePrice={base.housePrice}
            houseInfo={houseInfo}
            conditions={conditions}
            onChangeConditions={handleChangeConditions}
          />
          <RegulationSection result={result} />
          <LoanNotice result={result} />
        </div>
      )}
    </div>
  )
}
