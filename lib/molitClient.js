// data.go.kr 국토교통부 아파트 매매/전월세 실거래자료 API를 직접 호출하는 클라이언트.
// k-skill-proxy는 내부적으로 응답을 총건수(totalCount)보다 훨씬 적게 잘라서 내려주는
// 문제가 있어(구/월당 최대 100건 근처), pageNo/numOfRows로 직접 페이지네이션하며
// totalCount에 도달할 때까지 모든 건을 받아온다.

const TRADE_ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const RENT_ENDPOINT = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
const PAGE_SIZE = 1000;
const MAX_PAGES = 20; // 한 구·월에 20,000건 이상 나올 일은 없다는 안전장치(무한루프 방지)

function serviceKey() {
  const key = process.env.MOLIT_SERVICE_KEY;
  if (!key) {
    throw new Error(
      "MOLIT_SERVICE_KEY 환경변수가 설정되어 있지 않습니다. .env에 data.go.kr 서비스키(Decoding 키)를 넣어주세요."
    );
  }
  return key;
}

function toNumber(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isNaN(n) ? null : n;
}

function toDealDate(item) {
  const y = String(item.dealYear).trim();
  const m = String(item.dealMonth).trim().padStart(2, "0");
  const d = String(item.dealDay).trim().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeTrade(item) {
  return {
    name: String(item.aptNm || "").trim(),
    district: String(item.umdNm || "").trim(),
    area_m2: toNumber(item.excluUseAr),
    floor: toNumber(item.floor),
    price_10k: toNumber(item.dealAmount),
    deal_date: toDealDate(item),
    build_year: toNumber(item.buildYear),
    deal_type: String(item.dealingGbn || "").trim(),
  };
}

function normalizeRent(item) {
  return {
    name: String(item.aptNm || "").trim(),
    district: String(item.umdNm || "").trim(),
    area_m2: toNumber(item.excluUseAr),
    floor: toNumber(item.floor),
    deposit_10k: toNumber(item.deposit),
    monthly_rent_10k: toNumber(item.monthlyRent) || 0,
    contract_type: String(item.contractType || "").trim(),
    deal_date: toDealDate(item),
    build_year: toNumber(item.buildYear),
  };
}

async function fetchPage(endpoint, lawdCd, dealYmd, pageNo) {
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey());
  url.searchParams.set("LAWD_CD", lawdCd);
  url.searchParams.set("DEAL_YMD", dealYmd);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(PAGE_SIZE));
  url.searchParams.set("_type", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MOLIT API 조회 실패 (${response.status}): ${lawdCd} ${dealYmd} page=${pageNo}`);
  }
  const json = await response.json();
  const header = json.response && json.response.header;
  // data.go.kr 응답의 성공 코드가 "00"과 "000" 두 가지로 섞여 내려온다.
  if (header && !["00", "000"].includes(header.resultCode)) {
    throw new Error(`MOLIT API 오류 (${header.resultCode}): ${header.resultMsg}`);
  }
  const body = json.response && json.response.body;
  const totalCount = Number((body && body.totalCount) || 0);
  const rawItems = body && body.items && body.items.item;
  const items = !rawItems ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  return { items, totalCount };
}

// 한 구·월의 모든 페이지를 totalCount에 도달할 때까지 이어받는다.
async function fetchAllPages(endpoint, lawdCd, dealYmd) {
  const all = [];
  let page = 1;
  while (page <= MAX_PAGES) {
    const { items, totalCount } = await fetchPage(endpoint, lawdCd, dealYmd, page);
    all.push(...items);
    if (items.length === 0 || all.length >= totalCount) break;
    page += 1;
  }
  return all;
}

async function fetchTrade(lawdCd, dealYmd) {
  const raw = await fetchAllPages(TRADE_ENDPOINT, lawdCd, dealYmd);
  return raw.map(normalizeTrade);
}

async function fetchRent(lawdCd, dealYmd) {
  const raw = await fetchAllPages(RENT_ENDPOINT, lawdCd, dealYmd);
  return raw.map(normalizeRent);
}

module.exports = { fetchTrade, fetchRent };
