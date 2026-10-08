const express = require("express");
const {
  getDistrictRankingWithComparison,
  getDongRankingForDistrict,
  getDongTimeSeries,
  getDongApartmentRanking,
  getSeoulMonthlySummary,
  searchComplexTimeSeries,
} = require("../lib/analytics");

const router = express.Router();

router.get("/ranking", (req, res) => {
  const { dealYmd, kind = "trade" } = req.query;
  if (!dealYmd) {
    return res.status(400).json({ error: "dealYmd(YYYYMM)를 입력해주세요." });
  }
  res.json(getDistrictRankingWithComparison(dealYmd, kind));
});

router.get("/dong-ranking", (req, res) => {
  const { district, dealYmd, kind = "trade" } = req.query;
  if (!district || !dealYmd) {
    return res.status(400).json({ error: "district, dealYmd를 입력해주세요." });
  }
  res.json(getDongRankingForDistrict(district, dealYmd, kind));
});

router.get("/dong-time-series", (req, res) => {
  const { district, dong, dealYmd, kind = "trade" } = req.query;
  if (!district || !dong || !dealYmd) {
    return res.status(400).json({ error: "district, dong, dealYmd를 입력해주세요." });
  }
  res.json(getDongTimeSeries(district, dong, dealYmd, kind));
});

router.get("/dong-apartment-ranking", (req, res) => {
  const { district, dong, dealYmd, kind = "trade" } = req.query;
  if (!district || !dong || !dealYmd) {
    return res.status(400).json({ error: "district, dong, dealYmd를 입력해주세요." });
  }
  res.json(getDongApartmentRanking(district, dong, dealYmd, kind));
});

router.get("/seoul-summary", (req, res) => {
  const { dealYmd, kind = "trade" } = req.query;
  if (!dealYmd) {
    return res.status(400).json({ error: "dealYmd(YYYYMM)를 입력해주세요." });
  }
  res.json(getSeoulMonthlySummary(dealYmd, kind));
});

router.get("/complex", (req, res) => {
  const { name, kind = "trade" } = req.query;
  if (!name) {
    return res.status(400).json({ error: "name(단지명)을 입력해주세요." });
  }
  res.json(searchComplexTimeSeries(name, kind));
});

module.exports = router;
