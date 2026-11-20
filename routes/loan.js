const express = require("express");
const { simulateLoan } = require("../lib/loanCalculator");
const { previewMortgage } = require("../lib/mortgagePreview");
const regulationConfig = require("../config/loanRegulation");

const router = express.Router();

const DEBT_TYPES = ["mortgage", "credit", "other"];

// 요청 본문을 숫자로 정규화하고 필수값을 검증한다. 문제가 있으면 에러 메시지를 반환.
function parsePreviewBody(body) {
  const housePrice = Number(body.housePrice);
  const annualIncome = Number(body.annualIncome);
  const cash = Number(body.cash ?? 0);

  if (!Number.isFinite(housePrice) || housePrice <= 0) return { error: "housePrice(만원)는 0보다 커야 합니다." };
  if (!Number.isFinite(annualIncome) || annualIncome <= 0) return { error: "annualIncome(만원)는 0보다 커야 합니다." };
  if (!Number.isFinite(cash) || cash < 0) return { error: "cash(만원)는 0 이상이어야 합니다." };
  if (!body.district || typeof body.district !== "string") return { error: "district(구)를 입력해주세요." };

  const existingDebts = [];
  for (const d of body.existingDebts ?? []) {
    const debt = {
      type: DEBT_TYPES.includes(d.type) ? d.type : "other",
      balance: Number(d.balance),
      annualRatePct: Number(d.annualRatePct),
      years: Number(d.years),
    };
    if (![debt.balance, debt.annualRatePct, debt.years].every(Number.isFinite) || debt.balance < 0 || debt.years <= 0) {
      return { error: "existingDebts 항목(balance, annualRatePct, years)이 올바르지 않습니다." };
    }
    existingDebts.push(debt);
  }

  const optionalNumber = (v) => (v == null || v === "" ? undefined : Number(v));
  const annualRatePct = optionalNumber(body.annualRatePct);
  const years = optionalNumber(body.years);
  const stressRatePct = optionalNumber(body.stressRatePct);
  if ([annualRatePct, years, stressRatePct].some((v) => v !== undefined && !Number.isFinite(v))) {
    return { error: "annualRatePct, years, stressRatePct는 숫자여야 합니다." };
  }
  if (years !== undefined && (years < 1 || years > 50)) return { error: "years는 1~50 사이여야 합니다." };

  return {
    value: {
      housePrice,
      annualIncome,
      cash,
      district: body.district,
      exclusiveAreaM2: optionalNumber(body.exclusiveAreaM2) ?? null,
      firstPurchase: Boolean(body.firstPurchase),
      existingDebts,
      annualRatePct,
      years,
      stressRatePct,
    },
  };
}

// 화면 초기값(기본 금리/기간/스트레스 금리, 규제지역, 기준일)을 내려준다.
router.get("/config", (req, res) => {
  res.json({
    defaults: regulationConfig.defaults,
    regulatedDistricts: regulationConfig.regulatedDistricts,
    meta: regulationConfig.meta,
  });
});

router.post("/preview", (req, res) => {
  const { value, error } = parsePreviewBody(req.body ?? {});
  if (error) return res.status(400).json({ error });
  try {
    res.json(previewMortgage(value));
  } catch (e) {
    console.error("주담대 미리보기 계산 실패:", e);
    res.status(500).json({ error: "대출 한도 계산 중 오류가 발생했습니다." });
  }
});

router.post("/simulate", (req, res) => {
  const {
    annualIncome,
    existingAnnualDebtPayment = 0,
    propertyPrice,
    annualRatePct,
    years,
    ltvLimitPct = 70,
    dsrLimitPct = 40,
    stressRatePct = 1.5,
  } = req.body;

  if (!annualIncome || !propertyPrice || !annualRatePct || !years) {
    return res.status(400).json({
      error: "annualIncome, propertyPrice, annualRatePct, years는 필수입니다.",
    });
  }

  const result = simulateLoan({
    annualIncome: Number(annualIncome),
    existingAnnualDebtPayment: Number(existingAnnualDebtPayment),
    propertyPrice: Number(propertyPrice),
    annualRatePct: Number(annualRatePct),
    years: Number(years),
    ltvLimitPct: Number(ltvLimitPct),
    dsrLimitPct: Number(dsrLimitPct),
    stressRatePct: Number(stressRatePct),
  });

  res.json(result);
});

module.exports = router;
