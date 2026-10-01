const express = require("express");
const { getListings } = require("../lib/daangnClient");

const router = express.Router();

// 특정 구/동의 당근부동산 현재 매물 목록 조회 (name으로 건물명 부분일치 필터 가능)
router.get("/listings", async (req, res) => {
  const { gu, dong, name } = req.query;
  if (!gu || !dong) {
    return res.status(400).json({ error: "gu, dong을 모두 입력해주세요." });
  }
  try {
    const articles = await getListings({ name1: "서울", name2: gu, name3: dong });
    const filtered = name
      ? articles.filter((a) => a.buildingName && a.buildingName.includes(name))
      : articles;
    res.json(filtered);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
