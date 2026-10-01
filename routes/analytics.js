const express = require("express");
const { getDistrictRankingForMonth, searchComplexTimeSeries } = require("../lib/analytics");

const router = express.Router();

router.get("/ranking", (req, res) => {
  const { dealYmd, kind = "trade" } = req.query;
  if (!dealYmd) {
    return res.status(400).json({ error: "dealYmd(YYYYMM)를 입력해주세요." });
  }
  res.json(getDistrictRankingForMonth(dealYmd, kind));
});

router.get("/complex", (req, res) => {
  const { name, kind = "trade" } = req.query;
  if (!name) {
    return res.status(400).json({ error: "name(단지명)을 입력해주세요." });
  }
  res.json(searchComplexTimeSeries(name, kind));
});

module.exports = router;
