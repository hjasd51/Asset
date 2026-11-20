// 주담대 미리보기 API 요청/응답 타입. 금액 단위는 모두 "만원".

export type DebtType = 'mortgage' | 'credit' | 'other'

export interface DebtInput {
  type: DebtType
  balance: string
  annualRatePct: string
  years: string
}

export interface LoanConditions {
  annualRatePct: number
  years: number
  stressRatePct: number
}

export interface PreviewRequest extends LoanConditions {
  housePrice: number
  annualIncome: number
  cash: number
  district: string
  exclusiveAreaM2: number | null
  firstPurchase: boolean
  existingDebts: { type: DebtType; balance: number; annualRatePct: number; years: number }[]
}

export type BindingConstraint = 'CAP' | 'LTV' | 'DSR' | 'DTI'

export interface LimitAmount {
  pct: number
  amount: number
}

export interface StepRow {
  label: string
  value: number
  kind: 'amount' | 'pct' | 'years'
}

export interface AcquisitionTax {
  ratePct: number
  acquisitionTax: number
  localEduTax: number
  ruralSpecialTax: number
  reduction: number
  total: number
}

export interface PreviewResult {
  region: { district: string; regulated: boolean }
  conditions: LoanConditions & { repayment: string }
  rules: { ltvPct: number; dsrPct: number; dtiPct: number | null; cap: number | null }
  limits: {
    ltv: LimitAmount
    dsr: LimitAmount
    dti: LimitAmount | null
    cap: { amount: number } | null
  }
  finalLimit: number
  bindingConstraint: BindingConstraint
  isRegulationBinding: boolean
  ratios: { ltvPct: number; dsrPct: number; dtiPct: number | null }
  monthlyPayment: number
  costs: {
    acquisition: AcquisitionTax
    brokerage: { ratePct: number; total: number }
    total: number
  }
  totalPurchasePrice: number
  funding: { loan: number; cash: number; shortfall: number }
  steps: { dsr: StepRow[]; ltv: StepRow[]; dti: StepRow[] }
  appliedRules: string[]
  basis: { basisLabel: string; basisDate: string }
}

export interface LoanConfig {
  defaults: LoanConditions
  regulatedDistricts: string[]
  meta: { basisLabel: string; basisDate: string }
}

// 단지 자동완성 결과
export interface ComplexSuggestion {
  name: string
  gu: string
  dong: string
}

export interface RecentTrade {
  dealDate: string
  floor: number | null
  price10k: number
}

// 단지의 평형(공급평형)별 최근 실거래가 기준가 — 단지 시세 화면과 같은 기준
export interface ComplexAreaPrice {
  pyeongSupplyEstimate: number
  supplyAreaM2Estimate: number
  exclusiveAreaM2: number
  basePrice10k: number
  // recent2m: 단지 전체 최신월 기준 최근 2개월 평균 / tierLatest2m: 해당 평형의 마지막 거래월 기준 최근 2개월 평균
  basePriceBasis: 'recent2m' | 'tierLatest2m'
  // 직거래 외 거래가 없어 직거래 가격을 참고용으로 쓴 경우
  directOnly: boolean
  basePriceCount: number
  basePriceFromYmd: string
  basePriceToYmd: string
  totalCount: number
  recentTrades: RecentTrade[]
}
