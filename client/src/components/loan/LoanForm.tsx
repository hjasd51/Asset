import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseManwon } from '@/lib/loanFormat'
import type { ComplexAreaPrice, DebtInput, DebtType, PreviewRequest, LoanConditions } from '@/types/loan'
import HouseSearch, { type SelectedHouse } from './HouseSearch'
import type { HouseInfo } from './LoanResult'
import ManwonInput from './ManwonInput'

// 조건(금리·기간·스트레스)을 뺀 입력값 — 조건은 결과 화면에서 따로 바꾼다
export type PreviewBase = Omit<PreviewRequest, keyof LoanConditions>

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  mortgage: '주택담보대출',
  credit: '신용대출',
  other: '기타 대출',
}

// 한도 계산에는 아직 반영하지 않는 참고 조건
const REFERENCE_CONDITIONS = [
  { key: 'married', label: '혼인신고한 기혼이에요' },
  { key: 'newlywed', label: '신혼부부 혹은 결혼예정이에요' },
  { key: 'multiChild', label: '자녀가 2명 이상이에요' },
  { key: 'birth', label: '최근 2년 이내에 출산했어요' },
] as const

// "최근 2개월 실거래 평균 (3건, 2026.08~2026.09)" 형태의 가격 기준 설명
function describePriceBasis(area: ComplexAreaPrice): string {
  const fmt = (ymd: string) => `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}`
  const period = `${fmt(area.basePriceFromYmd)}~${fmt(area.basePriceToYmd)}`
  const base = area.basePriceBasis === 'recent2m' ? '최근 2개월 실거래 평균' : '최근 거래월 기준 2개월 평균'
  const prefix = area.directOnly ? `직거래만 있어 참고용 · ${base}` : base
  return `${prefix} (${area.basePriceCount}건, ${period})`
}

interface LoanFormProps {
  districts: string[]
  loading: boolean
  onSubmit: (base: PreviewBase, houseInfo: HouseInfo | null) => void
}

function ToggleRow({ checked, label, note, onToggle }: { checked: boolean; label: string; note?: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-3 border-b border-[var(--border-color)] py-3 text-left last:border-b-0"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          checked ? 'bg-emerald-500 text-white' : 'border border-[var(--input-border)] text-transparent'
        }`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm">{label}</span>
      {note && <span className="ml-auto text-xs text-[var(--text-muted)]">{note}</span>}
    </button>
  )
}

export default function LoanForm({ districts, loading, onSubmit }: LoanFormProps) {
  const [house, setHouse] = useState<SelectedHouse | null>(null)
  const [district, setDistrict] = useState('')
  const [housePrice, setHousePrice] = useState('')
  const [annualIncome, setAnnualIncome] = useState('')
  const [cash, setCash] = useState('')
  const [debts, setDebts] = useState<DebtInput[]>([])
  const [firstPurchase, setFirstPurchase] = useState(false)
  const [reference, setReference] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const handleHouseChange = (selected: SelectedHouse | null) => {
    setHouse(selected)
    if (selected) {
      setDistrict(selected.complex.gu)
      // 가격 데이터가 없는 단지는 사용자가 이미 입력한 가격을 그대로 둔다
      if (selected.area) setHousePrice(String(selected.area.basePrice10k))
    } else {
      setDistrict('')
      setHousePrice('')
    }
  }

  const updateDebt = (index: number, patch: Partial<DebtInput>) => {
    setDebts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseManwon(housePrice)
    const income = parseManwon(annualIncome)
    const cashValue = parseManwon(cash)

    if (!district) return setError('검색 결과 목록에서 단지를 눌러 선택하거나, 지역을 선택해 주세요.')
    if (price == null || price <= 0) return setError('주택가격을 입력해 주세요.')
    if (income == null || income <= 0) return setError('연소득을 입력해 주세요.')
    if (cashValue == null || cashValue < 0) return setError('보유현금을 입력해 주세요. (없으면 0)')

    const existingDebts = []
    for (const d of debts) {
      const balance = parseManwon(d.balance)
      const rate = Number(d.annualRatePct)
      const years = Number(d.years)
      if (balance == null || balance <= 0 || !Number.isFinite(rate) || d.annualRatePct === '' || !(years > 0)) {
        return setError('부채 항목의 잔액·금리·잔여기간을 모두 입력해 주세요.')
      }
      existingDebts.push({ type: d.type, balance, annualRatePct: rate, years })
    }

    setError('')
    const houseInfo: HouseInfo | null = house
      ? {
          name: house.complex.name,
          dong: house.complex.dong,
          supplyAreaM2: house.area?.supplyAreaM2Estimate ?? null,
          exclusiveAreaM2: house.area?.exclusiveAreaM2 ?? null,
          priceBasisLabel: house.area ? describePriceBasis(house.area) : null,
          pyeong: house.area?.pyeongSupplyEstimate ?? null,
        }
      : null
    onSubmit(
      {
        housePrice: price,
        annualIncome: income,
        cash: cashValue,
        district,
        exclusiveAreaM2: house?.area?.exclusiveAreaM2 ?? null,
        firstPurchase,
        existingDebts,
      },
      houseInfo
    )
  }

  const priceHint = house?.area ? describePriceBasis(house.area) : undefined

  const sectionClass = 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className={sectionClass}>
        <h2 className="text-base font-semibold">구매할 집</h2>
        <HouseSearch onChange={handleHouseChange} />
        {!house && (
          <div className="space-y-1.5">
            <Label>지역 (단지를 검색하지 않을 때)</Label>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger><SelectValue placeholder="구 선택" /></SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>서울시 {d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <ManwonInput id="housePrice" label="주택가격" required value={housePrice} onChange={setHousePrice} hint={priceHint} />
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold">내 자산</h2>
        <ManwonInput id="annualIncome" label="연소득 (세전, 부부 합산)" required value={annualIncome} onChange={setAnnualIncome} />
        <ManwonInput id="cash" label="보유현금 (부채 미포함)" required value={cash} onChange={setCash} />
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold">부채</h2>
        {debts.map((d, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--border-color)] p-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>종류</Label>
              <Select value={d.type} onValueChange={(v) => updateDebt(i, { type: v as DebtType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map((t) => (
                    <SelectItem key={t} value={t}>{DEBT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`debt-balance-${i}`}>잔액 (만원)</Label>
              <Input id={`debt-balance-${i}`} type="number" min="0" value={d.balance} onChange={(e) => updateDebt(i, { balance: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`debt-rate-${i}`}>금리 (%)</Label>
              <Input id={`debt-rate-${i}`} type="number" step="0.01" min="0" value={d.annualRatePct} onChange={(e) => updateDebt(i, { annualRatePct: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`debt-years-${i}`}>잔여기간 (년)</Label>
              <div className="flex gap-2">
                <Input id={`debt-years-${i}`} type="number" min="1" max="50" value={d.years} onChange={(e) => updateDebt(i, { years: e.target.value })} />
                <Button type="button" variant="outline" size="icon" aria-label="부채 삭제" onClick={() => setDebts((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setDebts((prev) => [...prev, { type: 'credit', balance: '', annualRatePct: '', years: '5' }])}
        >
          <Plus className="mr-1 h-4 w-4" /> 추가하기
        </Button>
        <p className="text-xs text-[var(--text-muted)]">기존 대출은 원리금균등 상환 기준으로 DSR·DTI에 반영돼요.</p>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold">대출특례 조건</h2>
        <div>
          <ToggleRow checked={firstPurchase} label="집을 처음 구매해요" onToggle={() => setFirstPurchase((v) => !v)} />
          {REFERENCE_CONDITIONS.map(({ key, label }) => (
            <ToggleRow
              key={key}
              checked={Boolean(reference[key])}
              label={label}
              note="참고용"
              onToggle={() => setReference((prev) => ({ ...prev, [key]: !prev[key] }))}
            />
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          생애최초 여부만 LTV·DTI·취득세 감면에 반영되고, 나머지 조건은 아직 한도 계산에 반영하지 않아요.
        </p>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading} className="h-12 w-full bg-emerald-500 text-base font-semibold text-black hover:bg-emerald-400">
        {loading ? '계산 중…' : '대출한도 확인하기'}
      </Button>
    </form>
  )
}
