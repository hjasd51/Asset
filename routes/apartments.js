const express = require("express");
const apartmentIndex = require("../lib/apartmentIndex");

const router = express.Router();

// 자동완성용 — q(검색어) 부분일치, 상위 N개(구/동 포함, 동명 단지 구분용).
router.get("/search", (req, res) => {
  const { q, gu, dong, limit } = req.query;
  if (!q) {
    return res.status(400).json({ error: "q(단지명 검색어)를 입력해주세요." });
  }
  res.json(apartmentIndex.search(q, { gu, dong, limit }));
});

// 구 선택 시 동 select를 채우는 보조 엔드포인트.
router.get("/dongs", (req, res) => {
  const { gu } = req.query;
  if (!gu) {
    return res.status(400).json({ error: "gu(구)를 입력해주세요." });
  }
  res.json(apartmentIndex.listDongs(gu));
});

// "아파트정보" 탭 테이블용 — 구/동으로 목록을 좁히거나, 없으면 거래건수 상위 N개.
router.get("/", (req, res) => {
  const { gu, dong, limit } = req.query;
  res.json(apartmentIndex.listByDistrict({ gu, dong, limit }));
});

module.exports = router;
