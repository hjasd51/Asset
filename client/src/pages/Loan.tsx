import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LoanForm {
  annualIncome: string
  existingAnnualDebtPayment: string
  propertyPrice: string
  annualRatePct: string
  years: string
  ltvLimitPct: string
  dsrLimitPct: string
  stressRatePct: string
}

interface LoanResult {
  maxLoanAmount: number
  bindingConstraint: string
  maxByLTV: number
  maxByDSR: number
  maxByStressDSR: number
  resultingLTV: number
  resultingDSR: number
}

function formatWon(amount: number) {
  if (amount >= 100000000) {
    const eok = (amount / 100000000).toFixed(2)
    return `${eok}억 원`
  }
  return `${(amount / 10000).toLocaleString()}만 원`
}

export default function Loan() {
  const [form, setForm] = useState<LoanForm>({
    annualIncome: '',
    existingAnnualDebtPayment: '0',
    propertyPrice: '',
    annualRatePct: '',
    years: '30',
    ltvLimitPct: '70',
    dsrLimitPct: '40',
    stressRatePct: '1.5',
  })
  const [result, setResult] = useState<LoanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, Number(v)])
      )
      const res = await fetch('/api/loan/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('계산 실패')
      const data = await res.json() as LoanResult
      setResult(data)
    } catch {
      setError('계산 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fields: { name: keyof LoanForm; label: string; placeholder?: string; step?: string; min?: string; max?: string }[] = [
    { name: 'annualIncome', label: '연 소득 (원)', placeholder: '예: 60000000' },
    { name: 'existingAnnualDebtPayment', label: '기존 대출 연간 원리금상환액 (원)', placeholder: '0' },
    { name: 'propertyPrice', label: '희망 주택가격 (원)', placeholder: '예: 700000000' },
    { name: 'annualRatePct', label: '예상 대출 금리 (연, %)', placeholder: '예: 4.2', step: '0.01' },
    { name: 'years', label: '대출 기간 (년)', min: '1', max: '50' },
    { name: 'ltvLimitPct', label: 'LTV 한도 (%)', min: '0', max: '100' },
    { name: 'dsrLimitPct', label: 'DSR 한도 (%, 1금융권 40 / 2금융권 50)', min: '0', max: '100' },
    { name: 'stressRatePct', label: '스트레스 가산금리 (%p)', step: '0.1', min: '0' },
  ]

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대출 시뮬레이터</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          소득·기존 대출·희망 주택가격을 입력하면 DSR/LTV/스트레스 DSR 기준 대출 한도를 계산합니다. 실제 은행 심사와는 다를 수 있는 참고용 계산입니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map(({ name, label, placeholder, step, min, max }) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                type="number"
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                step={step}
                min={min}
                max={max}
                required={name === 'annualIncome' || name === 'propertyPrice' || name === 'annualRatePct'}
              />
            </div>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        <div className="mt-5">
          <Button type="submit" disabled={loading}>
            {loading ? '계산 중…' : '계산하기'}
          </Button>
        </div>
      </form>

      {result && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="sm:col-span-2 lg:col-span-3 border-[var(--ring)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-[var(--text-secondary)]">최대 대출 가능 금액</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatWon(result.maxLoanAmount)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                제한 요인: <span className="font-medium text-[var(--text-primary)]">{result.bindingConstraint}</span>
              </p>
            </CardContent>
          </Card>

          {[
            { label: 'LTV 기준 한도', value: result.maxByLTV },
            { label: 'DSR 기준 한도', value: result.maxByDSR },
            { label: '스트레스 DSR 기준 한도', value: result.maxByStressDSR },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-secondary)]">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{formatWon(value)}</p>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--text-secondary)]">최종 LTV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{result.resultingLTV.toFixed(1)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[var(--text-secondary)]">최종 DSR</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{result.resultingDSR.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
