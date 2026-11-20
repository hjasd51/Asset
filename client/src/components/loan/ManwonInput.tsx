import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatManwon, parseManwon } from '@/lib/loanFormat'

interface ManwonInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint?: string
}

// 만원 단위 금액 입력 + 아래에 "N억 N만원" 환산 표시
export default function ManwonInput({ id, label, value, onChange, required, hint }: ManwonInputProps) {
  const parsed = parseManwon(value)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-12 text-right"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">
          만원
        </span>
      </div>
      <div className="flex justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span>{parsed != null && parsed > 0 ? formatManwon(parsed) : ' '}</span>
        {hint && <span className="text-right">{hint}</span>}
      </div>
    </div>
  )
}
