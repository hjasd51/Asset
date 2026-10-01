const express = require("express");

const router = express.Router();

const PROXY_BASE_URL =
  process.env.KSKILL_PROXY_BASE_URL || "https://k-skill-proxy.nomadamas.org";

async function fetchProxy(path, params) {
  const url = new URL(`${PROXY_BASE_URL}/v1/real-estate/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`k-skill-proxy 요청 실패 (${response.status}): ${text}`);
  }
  return response.json();
}

// 지역명 -> 법정동 코드(lawd_cd) 검색
router.get("/region-code", async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: "지역명(q)을 입력해주세요." });
  }
  try {
    const data = await fetchProxy("region-code", { q });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// 아파트 매매 실거래가 조회
router.get("/apartment/trade", async (req, res) => {
  const { lawd_cd, deal_ymd } = req.query;
  if (!lawd_cd || !deal_ymd) {
    return res
      .status(400)
      .json({ error: "lawd_cd, deal_ymd(YYYYMM)를 모두 입력해주세요." });
  }
  try {
    const data = await fetchProxy("apartment/trade", { lawd_cd, deal_ymd });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// 아파트 전월세 실거래가 조회
router.get("/apartment/rent", async (req, res) => {
  const { lawd_cd, deal_ymd } = req.query;
  if (!lawd_cd || !deal_ymd) {
    return res
      .status(400)
      .json({ error: "lawd_cd, deal_ymd(YYYYMM)를 모두 입력해주세요." });
  }
  try {
    const data = await fetchProxy("apartment/rent", { lawd_cd, deal_ymd });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
