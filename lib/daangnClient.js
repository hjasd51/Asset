// 당근부동산 공개 데이터에서 지역 검색 + 매물 목록을 가져오는 클라이언트.
// 로그인/쿠키/헤더 위장 없이 공개된 지역검색 API와 realty.daangn.com 페이지에
// 내려오는 window.RELAY_STORE(Relay 정규화 캐시)만 파싱한다.

const { toPyeong, estimateSupplyAreaM2 } = require("./areaUtils");

const REGION_KEYWORD_URL = "https://www.daangn.com/kr/api/v1/regions/keyword";
const RELAY_STORE_MARKER = "window.RELAY_STORE = ";
const RELAY_STORE_END_MARKER = ";</script>";

async function searchRegion(keyword) {
  const url = new URL(REGION_KEYWORD_URL);
  url.searchParams.set("keyword", keyword);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`당근 지역검색 실패 (${response.status})`);
  }
  const data = await response.json();
  return data.locations || [];
}

function extractRelayStore(html) {
  const start = html.indexOf(RELAY_STORE_MARKER);
  if (start === -1) return null;
  const jsonStart = start + RELAY_STORE_MARKER.length;
  const end = html.indexOf(RELAY_STORE_END_MARKER, jsonStart);
  if (end === -1) return null;

  const jsStringLiteral = html.slice(jsonStart, end);
  // RELAY_STORE는 JS 문자열 리터럴(JSON.stringify된 큰 객체)로 내려오므로 두 번 파싱한다.
  const jsonText = JSON.parse(jsStringLiteral);
  return JSON.parse(jsonText);
}

function resolveRef(store, ref) {
  if (!ref) return null;
  if (ref.__ref) return store[ref.__ref] || null;
  if (ref.__refs) return ref.__refs.map((key) => store[key]).filter(Boolean);
  return null;
}

function normalizeTrade(tradeNode) {
  if (!tradeNode) return null;
  if (tradeNode.__typename === "BuyTrade") {
    return { tradeType: "매매", price10k: tradeNode.price };
  }
  if (tradeNode.__typename === "BorrowTrade") {
    const isJeonse = !tradeNode.monthlyRentFee;
    return {
      tradeType: isJeonse ? "전세" : "월세",
      deposit10k: tradeNode.deposit,
      monthlyRent10k: tradeNode.monthlyRentFee || 0,
    };
  }
  return null;
}

// articleNode.area는 당근이 전용/공급 여부를 구분해 내려주지 않아, 실거래가와 동일하게
// 전용면적으로 가정하고 areaUtils의 전용률 추정치로 공급면적을 역산한다.
function normalizeArticle(store, articleNode) {
  const trades = resolveRef(store, articleNode.trades) || [];
  const normalizedTrades = trades.map(normalizeTrade).filter(Boolean);
  const area_m2 = articleNode.area ? Number(articleNode.area) : null;
  const supplyAreaM2Estimate = area_m2 ? Math.round(estimateSupplyAreaM2(area_m2) * 10) / 10 : null;

  return {
    id: articleNode.originalId || articleNode.id,
    buildingName: articleNode.buildingName || null,
    addressInfo: articleNode.addressInfo || null,
    area_m2,
    supplyAreaM2Estimate,
    pyeong: area_m2 ? toPyeong(area_m2) : null,
    pyeongSupplyEstimate: supplyAreaM2Estimate ? toPyeong(supplyAreaM2Estimate) : null,
    floor: articleNode.floor || null,
    topFloor: articleNode.topFloor || null,
    status: articleNode.status,
    trades: normalizedTrades,
  };
}

// name1(시/도), name2(구), name3(동)으로 realty.daangn.com 지도 페이지를 조회해
// 매물 목록을 정규화해서 반환한다.
async function getListings({ name1, name2, name3 }) {
  const path = [name1, name2, name3].map(encodeURIComponent).join("/");
  const response = await fetch(`https://realty.daangn.com/map/${path}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`당근 매물 페이지 조회 실패 (${response.status}): ${name1} ${name2} ${name3}`);
  }
  const html = await response.text();
  const store = extractRelayStore(html);
  if (!store) {
    throw new Error(`RELAY_STORE를 찾을 수 없음 (페이지 구조가 바뀌었을 수 있음): ${name1} ${name2} ${name3}`);
  }

  return Object.keys(store)
    .filter((key) => store[key].__typename === "Article")
    .map((key) => normalizeArticle(store, store[key]))
    .filter((article) => article.trades.length > 0);
}

module.exports = { searchRegion, getListings };
