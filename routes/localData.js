const express = require("express");
const store = require("../lib/realEstateStore");
const { enrichWithPyeong, sortByDealDateDesc } = require("../lib/analytics");

const router = express.Router();

router.get("/districts", (req, res) => {
  res.json(store.listRegions());
});

router.get("/:kind(trade|jeonse)", async (req, res) => {
  const { district, dealYmd } = req.query;
  if (!district || !dealYmd) {
    return res.status(400).json({ error: "district, dealYmd(YYYYMM)를 모두 입력해주세요." });
  }

  const region = store.findRegionByName(district);
  if (!region) {
    return res.status(404).json({ error: `알 수 없는 구입니다: ${district}` });
  }

  try {
    const items = await store.fetchAndCacheMonth(region.lawd_cd, req.params.kind, dealYmd);
    res.json({ district, dealYmd, items: sortByDealDateDesc(enrichWithPyeong(items)) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
