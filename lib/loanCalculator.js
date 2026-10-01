// 대출 가능성 시뮬레이터 계산 로직 (원리금균등상환 기준)
// 참고 공식: DSR = 연간 원리금상환액 / 연소득 * 100, LTV = 대출금액 / 주택가격 * 100

function calcMonthlyPayment(principal, annualRatePct, years) {
  const monthlyRate = annualRatePct / 100 / 12;
  const totalMonths = years * 12;
  if (totalMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / totalMonths;
  const factor = Math.pow(1 + monthlyRate, totalMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function calcAnnualPayment(principal, annualRatePct, years) {
  return calcMonthlyPayment(principal, annualRatePct, years) * 12;
}

// 목표 연간 상환액에 도달하는 원금(P)을 역산
function calcPrincipalFromAnnualPayment(annualPayment, annualRatePct, years) {
  const monthlyPayment = annualPayment / 12;
  const monthlyRate = annualRatePct / 100 / 12;
  const totalMonths = years * 12;
  if (totalMonths <= 0) return 0;
  if (monthlyRate === 0) return monthlyPayment * totalMonths;
  const factor = Math.pow(1 + monthlyRate, totalMonths);
  return (monthlyPayment * (factor - 1)) / (monthlyRate * factor);
}

function calcDSR({ annualIncome, annualDebtPayments }) {
  if (!annualIncome) return 0;
  return (annualDebtPayments / annualIncome) * 100;
}

function calcLTV({ loanAmount, propertyPrice }) {
  if (!propertyPrice) return 0;
  return (loanAmount / propertyPrice) * 100;
}

function calcMaxLoanByDSR({
  annualIncome,
  dsrLimitPct,
  annualRatePct,
  years,
  existingAnnualDebtPayment = 0,
}) {
  const allowedAnnualPayment = (dsrLimitPct / 100) * annualIncome - existingAnnualDebtPayment;
  if (allowedAnnualPayment <= 0) return 0;
  return calcPrincipalFromAnnualPayment(allowedAnnualPayment, annualRatePct, years);
}

function calcMaxLoanByLTV({ propertyPrice, ltvLimitPct }) {
  return (propertyPrice * ltvLimitPct) / 100;
}

// 스트레스 DSR: 실제 금리에 스트레스 가산금리를 더해 한도를 보수적으로 산정
function simulateLoan({
  annualIncome,
  existingAnnualDebtPayment = 0,
  propertyPrice,
  annualRatePct,
  years,
  ltvLimitPct,
  dsrLimitPct,
  stressRatePct = 0,
}) {
  const maxByDSR = calcMaxLoanByDSR({
    annualIncome,
    dsrLimitPct,
    annualRatePct,
    years,
    existingAnnualDebtPayment,
  });

  const maxByStressDSR = calcMaxLoanByDSR({
    annualIncome,
    dsrLimitPct,
    annualRatePct: annualRatePct + stressRatePct,
    years,
    existingAnnualDebtPayment,
  });

  const maxByLTV = calcMaxLoanByLTV({ propertyPrice, ltvLimitPct });

  const maxLoanAmount = Math.max(
    0,
    Math.min(maxByDSR, maxByStressDSR, maxByLTV)
  );

  const bindingConstraint = maxLoanAmount === maxByLTV ? "LTV" : "DSR";

  return {
    maxLoanAmount: Math.round(maxLoanAmount),
    maxByDSR: Math.round(maxByDSR),
    maxByStressDSR: Math.round(maxByStressDSR),
    maxByLTV: Math.round(maxByLTV),
    bindingConstraint,
    resultingLTV: Number(
      calcLTV({ loanAmount: maxLoanAmount, propertyPrice }).toFixed(1)
    ),
    resultingDSR: Number(
      calcDSR({
        annualIncome,
        annualDebtPayments:
          existingAnnualDebtPayment +
          calcAnnualPayment(maxLoanAmount, annualRatePct, years),
      }).toFixed(1)
    ),
  };
}

module.exports = {
  calcMonthlyPayment,
  calcAnnualPayment,
  calcPrincipalFromAnnualPayment,
  calcDSR,
  calcLTV,
  calcMaxLoanByDSR,
  calcMaxLoanByLTV,
  simulateLoan,
};
