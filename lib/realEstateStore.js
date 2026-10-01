// scripts/backfill-real-estate.js로 백필해둔 data/real-estate/ JSON 파일들을
// 구/기간 단위로 읽어오는 조회 헬퍼. 향후 랭킹/시계열 분석 기능이 이 위에서 동작한다.

const fs = require("fs");
const path = require("path");
const molitClient = require("./molitClient");

const dataDir = path.join(__dirname, "../data/real-estate");
const regionsPath = path.join(__dirname, "../data/regions/seoul.json");

function listRegions() {
  if (!fs.existsSync(regionsPath)) return [];
  return JSON.parse(fs.readFileSync(regionsPath, "utf8"));
}

function findRegionByName(name) {
  return listRegions().find((r) => r.name === name) || null;
}

// 특정 구/종류(trade|jeonse)에 대해 실제로 백필된 월(yyyymm) 목록을 오름차순으로 반환
function listAvailableMonths(lawdCd, kind) {
  const dir = path.join(dataDir, lawdCd, kind);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}

function getMonthlyData(lawdCd, kind, dealYmd) {
  const filePath = path.join(dataDir, lawdCd, kind, `${dealYmd}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// fromYmd ~ toYmd(포함) 범위의 데이터를 월별로 모아 하나의 배열로 반환
function getRangeData(lawdCd, kind, fromYmd, toYmd) {
  return listAvailableMonths(lawdCd, kind)
    .filter((yyyymm) => yyyymm >= fromYmd && yyyymm <= toYmd)
    .flatMap((yyyymm) => getMonthlyData(lawdCd, kind, yyyymm));
}

// 구 전체 기간의 시계열 데이터를 [{ dealYmd, items }] 형태로 반환
function getDistrictTimeSeries(lawdCd, kind) {
  return listAvailableMonths(lawdCd, kind).map((dealYmd) => ({
    dealYmd,
    items: getMonthlyData(lawdCd, kind, dealYmd),
  }));
}

// 캐시된 파일이 있으면 그대로 반환하고, 없으면 국토교통부 실거래자료 API(molitClient)에서
// 받아와 캐시에 저장한 뒤 반환한다. scripts/backfill-real-estate.js와 실시간 조회 라우트가
// 이 함수를 공유한다.
async function fetchAndCacheMonth(lawdCd, kind, dealYmd) {
  const cached = getMonthlyData(lawdCd, kind, dealYmd);
  const filePath = path.join(dataDir, lawdCd, kind, `${dealYmd}.json`);
  if (fs.existsSync(filePath)) return cached;

  let items =
    kind === "trade"
      ? await molitClient.fetchTrade(lawdCd, dealYmd)
      : await molitClient.fetchRent(lawdCd, dealYmd);
  if (kind === "jeonse") {
    items = items.filter((item) => item.monthly_rent_10k === 0);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
  return items;
}

module.exports = {
  listRegions,
  findRegionByName,
  listAvailableMonths,
  getMonthlyData,
  getRangeData,
  getDistrictTimeSeries,
  fetchAndCacheMonth,
};
