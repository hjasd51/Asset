// 주담대 미리보기: 주택가격·소득·보유현금·기존 부채를 받아 DSR/LTV/DTI 한도별 금액,
// 규제한도(가장 낮은 값), 부대비용 포함 필요 자금을 계산한다.
// 모든 금액 단위는 "만원", 비율은 % 단위. 규제 수치는 config/loanRegulation.js에서 가져온다.

const config = require("../config/loanRegulation");
const { calcAnnualPayment, calcPrincipalFromAnnualPayment } = require("./loanCalculator");

const round = (n) => Math.round(n);

function isRegulatedDistrict(district) {
  return config.regulatedDistricts.includes(district);
}

function pickRule(table, regulated, firstPurchase) {
  const group = regulated ? table.regulated : table.nonRegulated;
  return firstPurchase ? group.firstPurchase : group.default;
}

function pickLoanCap(housePrice, regulated) {
  const tiers = regulated ? config.loanCap.regulated : config.loanCap.nonRegulated;
  if (!tiers) return null;
  return tiers.find((t) => housePrice <= t.maxPrice)?.cap ?? null;
}

// 기존 부채의 연간 상환액: DSR은 원리금, DTI는 주담대만 원리금 / 그 외는 이자만 반영
function summarizeExistingDebts(existingDebts) {
  let dsrAnnual = 0;
  let dtiAnnual = 0;
  for (const d of existingDebts) {
    const principalAndInterest = calcAnnualPayment(d.balance, d.annualRatePct, d.years);
    dsrAnnual += principalAndInterest;
    dtiAnnual += d.type === "mortgage" ? principalAndInterest : (d.balance * d.annualRatePct) / 100;
  }
  return { dsrAnnual, dtiAnnual };
}

// 취득세 + 지방교육세 + 농어촌특별세 (생애최초 감면 반영) 추정
function estimateAcquisitionTax({ housePrice, exclusiveAreaM2, firstPurchase }) {
  const t = config.acquisitionTax;
  let ratePct;
  if (housePrice <= t.lowMaxPrice) ratePct = t.lowRatePct;
  else if (housePrice >= t.highMinPrice) ratePct = t.highRatePct;
  else ratePct = ((housePrice / 10000) * 2) / 3 - 3; // 6~9억: (가격(억) × 2/3 − 3)%

  const acquisitionTax = (housePrice * ratePct) / 100;
  const localEduTax = acquisitionTax * t.localEduTaxRatioOfAcqTax;
  const ruralSpecialTax =
    exclusiveAreaM2 && exclusiveAreaM2 > t.ruralSpecialTaxAreaM2
      ? (housePrice * t.ruralSpecialTaxPct) / 100
      : 0;

  const red = t.firstPurchaseReduction;
  const reduction =
    firstPurchase && housePrice <= red.maxPrice ? Math.min(acquisitionTax, red.maxAmount) : 0;

  return {
    ratePct: Number(ratePct.toFixed(2)),
    acquisitionTax: round(acquisitionTax),
    localEduTax: round(localEduTax),
    ruralSpecialTax: round(ruralSpecialTax),
    reduction: round(reduction),
    total: round(acquisitionTax + localEduTax + ruralSpecialTax - reduction),
  };
}

// 중개보수 상한 추정 (부가세 별도)
function estimateBrokerageFee(housePrice) {
  const tier = config.brokerageFee.find((t) => housePrice < t.maxPrice) ?? config.brokerageFee.at(-1);
  const fee = (housePrice * tier.ratePct) / 100;
  return {
    ratePct: tier.ratePct,
    total: round(tier.maxFee != null ? Math.min(fee, tier.maxFee) : fee),
  };
}

function previewMortgage(input) {
  const {
    housePrice,
    annualIncome,
    cash,
    district,
    exclusiveAreaM2 = null,
    firstPurchase = false,
    existingDebts = [],
  } = input;
  const annualRatePct = input.annualRatePct ?? config.defaults.annualRatePct;
  const years = input.years ?? config.defaults.years;
  const stressRatePct = input.stressRatePct ?? config.defaults.stressRatePct;

  const regulated = isRegulatedDistrict(district);
  const ltvPct = pickRule(config.ltv, regulated, firstPurchase);
  const dtiPct = pickRule(config.dti, regulated, firstPurchase);
  const dsrPct = config.dsrLimitPct;
  const cap = pickLoanCap(housePrice, regulated);
  const existing = summarizeExistingDebts(existingDebts);

  // ── 한도별 최대 대출 금액 ──
  const maxByLTV = (housePrice * ltvPct) / 100;

  const dsrAllowedAnnual = Math.max(0, (annualIncome * dsrPct) / 100 - existing.dsrAnnual);
  const dsrStressRatePct = annualRatePct + stressRatePct;
  const maxByDSR = calcPrincipalFromAnnualPayment(dsrAllowedAnnual, dsrStressRatePct, years);

  const dtiAllowedAnnual =
    dtiPct != null ? Math.max(0, (annualIncome * dtiPct) / 100 - existing.dtiAnnual) : null;
  const maxByDTI =
    dtiAllowedAnnual != null
      ? calcPrincipalFromAnnualPayment(dtiAllowedAnnual, annualRatePct, years)
      : null;

  // ── 규제한도: 적용 가능한 한도 중 최솟값 ──
  const candidates = [
    { key: "CAP", amount: cap },
    { key: "LTV", amount: maxByLTV },
    { key: "DSR", amount: maxByDSR },
    { key: "DTI", amount: maxByDTI },
  ].filter((c) => c.amount != null);
  const binding = candidates.reduce((min, c) => (c.amount < min.amount ? c : min));
  const finalLimit = round(Math.max(0, binding.amount));

  // 최종 한도 기준 비율
  const finalAnnualBase = calcAnnualPayment(finalLimit, annualRatePct, years);
  const finalAnnualStress = calcAnnualPayment(finalLimit, dsrStressRatePct, years);
  const ratios = {
    ltvPct: Number(((finalLimit / housePrice) * 100).toFixed(1)),
    dsrPct: Number((((existing.dsrAnnual + finalAnnualStress) / annualIncome) * 100).toFixed(1)),
    dtiPct:
      dtiPct != null
        ? Number((((existing.dtiAnnual + finalAnnualBase) / annualIncome) * 100).toFixed(1))
        : null,
  };

  // ── 부대비용 및 필요 자금 ──
  const acq = estimateAcquisitionTax({ housePrice, exclusiveAreaM2, firstPurchase });
  const brokerage = estimateBrokerageFee(housePrice);
  const extraCosts = acq.total + brokerage.total;
  const totalPurchasePrice = housePrice + extraCosts;
  const shortfall = Math.max(0, totalPurchasePrice - finalLimit - cash);

  // 한도를 결정한 게 규제(금액상한/LTV)인지, 소득 기반 상환능력(DSR/DTI)인지
  const isRegulationBinding = binding.key === "CAP" || binding.key === "LTV";

  return {
    region: { district, regulated },
    conditions: { annualRatePct, years, stressRatePct, repayment: "원리금균등" },
    rules: { ltvPct, dsrPct, dtiPct, cap },
    limits: {
      ltv: { pct: ltvPct, amount: round(maxByLTV) },
      dsr: { pct: dsrPct, amount: round(maxByDSR) },
      dti: dtiPct != null ? { pct: dtiPct, amount: round(maxByDTI) } : null,
      cap: cap != null ? { amount: cap } : null,
    },
    finalLimit,
    bindingConstraint: binding.key,
    isRegulationBinding,
    ratios,
    monthlyPayment: round(finalAnnualBase / 12),
    costs: { acquisition: acq, brokerage, total: extraCosts },
    totalPurchasePrice,
    funding: { loan: finalLimit, cash, shortfall: round(shortfall) },
    // 화면의 "산출과정" 펼침용 행
    steps: {
      dsr: [
        { label: "연소득", value: annualIncome, kind: "amount" },
        { label: "DSR 한도", value: dsrPct, kind: "pct" },
        { label: "기존 대출 연 원리금", value: round(existing.dsrAnnual), kind: "amount" },
        { label: "신규 대출 연 상환 가능액", value: round(dsrAllowedAnnual), kind: "amount" },
        { label: "적용 금리 (금리 + 스트레스)", value: Number(dsrStressRatePct.toFixed(2)), kind: "pct" },
        { label: "대출 기간", value: years, kind: "years" },
        { label: "DSR 기준 최대 대출", value: round(maxByDSR), kind: "amount" },
      ],
      ltv: [
        { label: "주택가격", value: housePrice, kind: "amount" },
        { label: "LTV 한도", value: ltvPct, kind: "pct" },
        { label: "LTV 기준 최대 대출", value: round(maxByLTV), kind: "amount" },
      ],
      dti:
        dtiPct != null
          ? [
              { label: "연소득", value: annualIncome, kind: "amount" },
              { label: "DTI 한도", value: dtiPct, kind: "pct" },
              { label: "기존 대출 연 상환액 (주담대 원리금 + 기타 이자)", value: round(existing.dtiAnnual), kind: "amount" },
              { label: "신규 대출 연 상환 가능액", value: round(dtiAllowedAnnual), kind: "amount" },
              { label: "적용 금리 (스트레스 미반영)", value: annualRatePct, kind: "pct" },
              { label: "대출 기간", value: years, kind: "years" },
              { label: "DTI 기준 최대 대출", value: round(maxByDTI), kind: "amount" },
            ]
          : [],
    },
    // 화면의 "적용된 규제 근거" 문구
    appliedRules: buildAppliedRules({ regulated, firstPurchase, ltvPct, dtiPct, dsrPct, cap, stressRatePct }),
    basis: config.meta,
  };
}

function buildAppliedRules({ regulated, firstPurchase, ltvPct, dtiPct, dsrPct, cap, stressRatePct }) {
  const rules = [];
  rules.push(`${regulated ? "규제지역" : "비규제지역"}${firstPurchase ? " · 생애최초 주택구입" : ""} 기준으로 LTV ${ltvPct}% 적용`);
  if (dtiPct != null) rules.push(`${firstPurchase ? "생애최초 주택구입 " : ""}DTI ${dtiPct}% 적용`);
  rules.push(`DSR ${dsrPct}% (은행권) · 스트레스 DSR 가산금리 ${stressRatePct}%p (5년 고정 후 변동, 혼합형 가정)`);
  if (cap != null) rules.push(`규제지역 주담대 금액상한 ${cap / 10000}억원 적용`);
  return rules;
}

module.exports = { previewMortgage, estimateAcquisitionTax, estimateBrokerageFee };
