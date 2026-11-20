import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatManwon } from '@/lib/loanFormat'
import type { BindingConstraint, PreviewResult, StepRow } from '@/types/loan'

const cardClass = 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5'

const CONSTRAINT_LABELS: Record<BindingConstraint, string> = {
  CAP: '금액상한',
  LTV: 'LTV',
  DSR: 'DSR',
  DTI: 'DTI',
}

function formatStep(row: StepRow): string {
  if (row.kind === 'amount') return formatManwon(row.value)
  if (row.kind === 'pct') return `${row.value}%`
  return `${row.value}년`
}

// 규제한도(가장 낮은 값)와 DSR/LTV/DTI 한도별 금액을 막대로 비교
function LimitBars({ result }: { result: PreviewResult }) {
  const rows: { key: BindingConstraint; label: string; pct?: number; amount: number }[] = [
    { key: 'DSR', label: 'DSR', pct: result.limits.dsr.pct, amount: result.limits.dsr.amount },
    { key: 'LTV', label: 'LTV', pct: result.limits.ltv.pct, amount: result.limits.ltv.amount },
    ...(result.limits.dti ? [{ key: 'DTI' as const, label: 'DTI', pct: result.limits.dti.pct, amount: result.limits.dti.amount }] : []),
    ...(result.limits.cap ? [{ key: 'CAP' as const, label: '금액상한', amount: result.limits.cap.amount }] : []),
  ]
  const max = Math.max(...rows.map((r) => r.amount), result.finalLimit, 1)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm font-medium">규제한도</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(result.finalLimit / max) * 100}%` }} />
        </div>
        <span className="w-28 shrink-0 text-right text-sm font-semibold text-emerald-600">{formatManwon(result.finalLimit)}</span>
      </div>
      <div className="space-y-2 border-t border-[var(--border-color)] pt-3">
        {rows.map((r) => {
          const isBinding = r.key === result.bindingConstraint
          return (
            <div key={r.key} className="flex items-center gap-3">
              <span className={`w-20 shrink-0 text-sm ${isBinding ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {r.label} {r.pct != null && <small className="text-xs text-[var(--text-muted)]">{r.pct}%</small>}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className={`h-full rounded-full ${isBinding ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  style={{ width: `${(r.amount / max) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-[var(--text-secondary)]">{formatManwon(r.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 탭별(DSR/LTV/DTI) 최종 한도 기준 비율 게이지 + 산출과정
function RatioGauge({ ratio, limitPct, steps, unitLabel }: { ratio: number; limitPct: number; steps: StepRow[]; unitLabel: string }) {
  const width = Math.min(100, (ratio / limitPct) * 100)
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-right text-sm font-bold">{ratio}%</div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="font-medium">{unitLabel}</span>
          <span className="text-[var(--text-muted)]">{limitPct}%</span>
        </div>
      </div>
      <details className="group rounded-lg border border-[var(--border-color)]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">{unitLabel} 산출과정</summary>
        <dl className="space-y-1.5 border-t border-[var(--border-color)] px-4 py-3 text-sm">
          {steps.map((s) => (
            <div key={s.label} className="flex justify-between gap-4">
              <dt className="text-[var(--text-secondary)]">{s.label}</dt>
              <dd className="shrink-0 font-medium">{formatStep(s)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  )
}

export default function RegulationSection({ result }: { result: PreviewResult }) {
  const binding = result.bindingConstraint
  const message = result.isRegulationBinding
    ? '소득 기준으로는 더 빌릴 수 있어요.\n상환 능력이 부족한 게 아니라 대출규제가 한도를 결정하고 있어요.'
    : '대출규제보다 소득 대비 상환 능력이 한도를 결정하고 있어요.\n소득을 늘리거나 기존 부채를 줄이면 한도가 늘어나요.'
  const defaultTab = binding === 'DSR' || binding === 'LTV' || binding === 'DTI' ? binding : 'DSR'

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <h2 className="text-lg font-bold">
          {result.isRegulationBinding ? '내 한도는 규제한도로 적용됐어요' : '내 한도는 상환능력으로 적용됐어요'}
        </h2>
        <p className="mb-4 mt-1 text-sm text-[var(--text-secondary)]">
          각 규제별 한도 중 <b className="text-[var(--text-primary)]">가장 낮은 금액</b>으로 결정돼요 ({CONSTRAINT_LABELS[binding]} 기준)
        </p>
        <LimitBars result={result} />
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-bold">
          {result.isRegulationBinding ? '대출규제가 있어서 한도가 깎였어요' : '규제별 한도를 확인해 보세요'}
        </h2>
        <p className="mb-4 mt-1 text-sm text-[var(--text-secondary)]">최대한도 {formatManwon(result.finalLimit)} 기준으로 계산했어요</p>

        <Tabs defaultValue={defaultTab} key={defaultTab}>
          <div className="mb-4 flex justify-center">
            <TabsList>
              <TabsTrigger value="DSR">DSR</TabsTrigger>
              <TabsTrigger value="LTV">LTV</TabsTrigger>
              {result.limits.dti && <TabsTrigger value="DTI">DTI</TabsTrigger>}
            </TabsList>
          </div>
          <TabsContent value="DSR">
            <RatioGauge ratio={result.ratios.dsrPct} limitPct={result.rules.dsrPct} steps={result.steps.dsr} unitLabel="DSR" />
          </TabsContent>
          <TabsContent value="LTV">
            <RatioGauge ratio={result.ratios.ltvPct} limitPct={result.rules.ltvPct} steps={result.steps.ltv} unitLabel="LTV" />
          </TabsContent>
          {result.limits.dti && result.ratios.dtiPct != null && result.rules.dtiPct != null && (
            <TabsContent value="DTI">
              <RatioGauge ratio={result.ratios.dtiPct} limitPct={result.rules.dtiPct} steps={result.steps.dti} unitLabel="DTI" />
            </TabsContent>
          )}
        </Tabs>

        <div className="mt-4 whitespace-pre-line rounded-lg bg-[var(--bg-muted)] p-4 text-center text-sm">{message}</div>
      </section>
    </div>
  )
}
