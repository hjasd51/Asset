import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatManwon } from '@/lib/loanFormat'
import type { LoanConditions, PreviewResult } from '@/types/loan'

export interface HouseInfo {
  name: string
  dong: string
  // 실거래 가격 데이터가 없는 단지는 면적·평형·가격 기준이 null
  supplyAreaM2: number | null
  exclusiveAreaM2: number | null
  pyeong: number | null
  priceBasisLabel: string | null
}

interface LoanResultProps {
  result: PreviewResult
  housePrice: number
  houseInfo: HouseInfo | null
  conditions: LoanConditions
  onChangeConditions: (next: LoanConditions) => void
}

const cardClass = 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5'

// 부대비용 포함 총 구매가를 [대출한도 | 보유현금 | 필요자금]으로 쪼갠 막대
function FundingBar({ result }: { result: PreviewResult }) {
  const { loan, cash, shortfall } = result.funding
  const total = loan + cash + shortfall || 1
  // 보유현금이 총 구매가에서 대출을 뺀 금액보다 크면 초과분은 막대에서 잘라낸다
  const cashShown = Math.min(cash, Math.max(0, result.totalPurchasePrice - loan))
  const pct = (v: number) => `${(v / total) * 100}%`
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-emerald-500" />대출한도</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-blue-500" />보유현금</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />필요자금</span>
      </div>
      <div className="flex h-6 overflow-hidden rounded-md bg-[var(--bg-muted)]">
        <div className="bg-emerald-500" style={{ width: pct(loan) }} />
        <div className="bg-blue-500" style={{ width: pct(cashShown) }} />
        <div className="bg-slate-300 dark:bg-slate-600" style={{ width: pct(shortfall) }} />
      </div>
      <p className="text-right text-xs text-[var(--text-muted)]">
        총 구매가 (부대비용 포함) <span className="font-medium text-[var(--text-primary)]">{formatManwon(result.totalPurchasePrice)}</span>
      </p>
    </div>
  )
}

function CostBreakdown({ result }: { result: PreviewResult }) {
  const { acquisition, brokerage, total } = result.costs
  const rows: [string, number, string?][] = [
    [`취득세 (${acquisition.ratePct}%)`, acquisition.acquisitionTax],
    ['지방교육세', acquisition.localEduTax],
    ...(acquisition.ruralSpecialTax ? ([['농어촌특별세', acquisition.ruralSpecialTax]] as [string, number][]) : []),
    ...(acquisition.reduction ? ([['생애최초 취득세 감면', -acquisition.reduction]] as [string, number][]) : []),
    [`중개보수 (상한 ${brokerage.ratePct}%, 부가세 별도)`, brokerage.total],
  ]
  return (
    <div className="mt-3 space-y-1.5 border-t border-[var(--border-color)] pt-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-[var(--text-secondary)]">
          <span>{label}</span>
          <span>{formatManwon(value)}</span>
        </div>
      ))}
      <div className="flex justify-between font-medium">
        <span>부대비용 합계 (추정)</span>
        <span>{formatManwon(total)}</span>
      </div>
    </div>
  )
}

function ConditionEditor({ conditions, onChange }: { conditions: LoanConditions; onChange: (next: LoanConditions) => void }) {
  const fields: { key: keyof LoanConditions; label: string; step: string; min: string; max?: string }[] = [
    { key: 'annualRatePct', label: '대출 금리 (연 %)', step: '0.01', min: '0' },
    { key: 'years', label: '대출 기간 (년)', step: '1', min: '1', max: '50' },
    { key: 'stressRatePct', label: '스트레스 금리 (%p)', step: '0.1', min: '0' },
  ]
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-[var(--bg-muted)] p-3 sm:grid-cols-3">
      {fields.map(({ key, label, step, min, max }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`cond-${key}`}>{label}</Label>
          <Input
            id={`cond-${key}`}
            type="number"
            step={step}
            min={min}
            max={max}
            value={conditions[key]}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (e.target.value !== '' && Number.isFinite(n)) onChange({ ...conditions, [key]: n })
            }}
          />
        </div>
      ))}
    </div>
  )
}

export default function LoanResult({ result, housePrice, houseInfo, conditions, onChangeConditions }: LoanResultProps) {
  const [editing, setEditing] = useState(false)
  const [showCosts, setShowCosts] = useState(false)
  const { funding, finalLimit } = result
  const enough = funding.shortfall === 0

  return (
    <div className="space-y-4">
      {/* 주택 요약 */}
      <section className={cardClass}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
              result.region.regulated
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
            }`}
          >
            {result.region.regulated ? '규제지역' : '비규제지역'}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            서울시 {result.region.district}{houseInfo ? ` ${houseInfo.dong}` : ''}
          </span>
        </div>
        {houseInfo && (
          <p className="mt-2 text-lg font-bold">
            {houseInfo.name}
            {houseInfo.pyeong != null && (
              <span className="text-base font-semibold"> · {houseInfo.pyeong}평형 · 공급 약 {houseInfo.supplyAreaM2}㎡ (전용 {houseInfo.exclusiveAreaM2})</span>
            )}
          </p>
        )}
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          주택가격 {formatManwon(housePrice)}
          {houseInfo?.priceBasisLabel && <span className="text-[var(--text-muted)]"> ({houseInfo.priceBasisLabel})</span>}
        </p>
      </section>

      {/* 예상 최대한도 + 필요자금 */}
      <section className={cardClass}>
        <p className="text-sm text-[var(--text-secondary)]">예상 최대한도</p>
        <p className="mt-1 text-3xl font-bold">{formatManwon(finalLimit)}</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          월 원리금 <b className="text-[var(--text-primary)]">{result.monthlyPayment.toLocaleString()}만원</b>
          <span className="mx-1.5 text-[var(--border-color)]">|</span>
          {conditions.annualRatePct.toFixed(2)}% · {conditions.years}년 · {result.conditions.repayment} · 스트레스 금리 {conditions.stressRatePct}%
          <button type="button" onClick={() => setEditing((v) => !v)} className="ml-2 font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-500">
            {editing ? '닫기' : '변경'}
          </button>
        </p>
        {editing && <ConditionEditor conditions={conditions} onChange={onChangeConditions} />}

        <div className="mt-4 rounded-lg bg-[var(--bg-muted)] p-4">
          <button type="button" onClick={() => setShowCosts((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={showCosts}>
            <div>
              <p className="text-sm">{enough ? '목표 집값을 마련할 수 있어요' : '목표 집값까지'}</p>
              <p className={`text-lg font-bold ${enough ? 'text-emerald-600' : 'text-red-500'}`}>
                {enough ? '필요 자금을 모두 충당해요' : `${formatManwon(funding.shortfall)} 더 필요해요`}
              </p>
            </div>
            <ChevronDown className={`h-5 w-5 text-[var(--text-muted)] transition-transform ${showCosts ? 'rotate-180' : ''}`} />
          </button>
          <div className="mt-3 border-t border-[var(--border-color)] pt-3">
            <FundingBar result={result} />
          </div>
          {showCosts && <CostBreakdown result={result} />}
        </div>
      </section>
    </div>
  )
}
