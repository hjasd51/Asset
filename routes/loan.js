const express = require("express");
const { simulateLoan } = require("../lib/loanCalculator");

const router = express.Router();

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
