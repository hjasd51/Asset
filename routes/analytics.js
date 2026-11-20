const express = require("express");
const {
  getDistrictRankingWithComparison,
  getDongRankingForDistrict,
  getDongTimeSeries,
  getDongApartmentRanking,
  getSeoulMonthlySummary,
  getSeoulTimeSeriesAll,
  getDistrictTimeSeriesAll,
  getDongTimeSeriesAll,
  getApartmentTimeSeriesAll,
  getDongApartmentList,
  getCacheInfo,
  getCacheRows,
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

router.get("/seoul-time-series", (req, res) => {
  const { kind = "trade" } = req.query;
  res.json(getSeoulTimeSeriesAll(kind));
});

router.get("/district-time-series", (req, res) => {
  const { district, kind = "trade" } = req.query;
  if (!district) {
    return res.status(400).json({ error: "district를 입력해주세요." });
  }
  res.json(getDistrictTimeSeriesAll(district, kind));
});

router.get("/dong-time-series-all", (req, res) => {
  const { district, dong, kind = "trade" } = req.query;
  if (!district || !dong) {
    return res.status(400).json({ error: "district, dong을 입력해주세요." });
  }
  res.json(getDongTimeSeriesAll(district, dong, kind));
});

router.get("/dong-apartments", (req, res) => {
  const { district, dong, kind = "trade" } = req.query;
  if (!district || !dong) {
    return res.status(400).json({ error: "district, dong을 입력해주세요." });
  }
  res.json(getDongApartmentList(district, dong, kind));
});

router.get("/apartment-time-series", (req, res) => {
  const { district, dong, name, kind = "trade" } = req.query;
  if (!district || !dong || !name) {
    return res.status(400).json({ error: "district, dong, name을 입력해주세요." });
  }
  res.json(getApartmentTimeSeriesAll(district, dong, name, kind));
});

router.get("/cache-info", (req, res) => {
  res.json(getCacheInfo());
});

router.get("/cache-rows", (req, res) => {
  const { kind = "trade", level = "seoul", district, dong, name, limit } = req.query;
  if (!["seoul", "district", "dong", "apartment"].includes(level)) {
    return res.status(400).json({ error: "level은 seoul|district|dong|apartment 중 하나여야 합니다." });
  }
  res.json(getCacheRows(kind, level, { district, dong, name, limit }));
});

router.get("/complex", (req, res) => {
  const { name, kind = "trade" } = req.query;
  if (!name) {
    return res.status(400).json({ error: "name(단지명)을 입력해주세요." });
  }
  res.json(searchComplexTimeSeries(name, kind));
});

module.exports = router;
