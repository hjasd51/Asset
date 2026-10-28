// 백필된 실거래가 데이터를 기반으로 하는 지역 랭킹 / 단지 시세 추이 분석.

const fs = require("fs");
const path = require("path");
const store = require("./realEstateStore");
const { PYEONG_M2, toPyeong, estimateSupplyAreaM2 } = require("./areaUtils");

const cacheDir = path.join(__dirname, "../data/cache");
// 캐시 파일(build-time-series-cache.js로 생성)을 프로세스 생애주기 동안 1회만 읽어 메모리에 둠.
// 캐시는 서버 재시작 전까지 바뀌지 않으므로(재빌드 후 수동 재시작하는 기존 운영 방식과 동일한 전제) 매 요청마다 다시 읽지 않음.
const timeSeriesCacheMemo = {};

function loadTimeSeriesCache(kind) {
  if (!timeSeriesCacheMemo[kind]) {
    const file = path.join(cacheDir, `time-series-${kind}.json`);
    timeSeriesCacheMemo[kind] = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : { cutoffYmd: null, seoul: [], district: [], dong: [], apartment: [] };
  }
  return timeSeriesCacheMemo[kind];
}

// 캐시에 없는(= cutoffYmd 이후) 월만 추려서 라이브 계산 대상으로 넘긴다.
function liveMonthsAfter(cutoffYmd, kind, lawdCds) {
  const months = new Set();
  for (const lawdCd of lawdCds) {
    for (const m of store.listAvailableMonths(lawdCd, kind)) {
      if (!cutoffYmd || m > cutoffYmd) months.add(m);
    }
  }
  return [...months].sort();
}

function shiftYmd(ymd, delta) {
  const y = parseInt(ymd.slice(0, 4));
  const rawM = parseInt(ymd.slice(4, 6)) + delta;
  const yy = y + Math.floor((rawM - 1) / 12);
  const mm = (((rawM - 1) % 12) + 12) % 12 + 1;
  return `${yy}${String(mm).padStart(2, "0")}`;
}

// area_m2(전용면적) 기준 평형(전용)과, 전용률 가정치로 역산한 공급면적 추정 평형을 함께 붙인다.
function enrichWithPyeong(items) {
  return items.map((item) => {
    const supplyAreaM2Estimate = Math.round(estimateSupplyAreaM2(item.area_m2) * 10) / 10;
    return {
      ...item,
      pyeong: toPyeong(item.area_m2),
      supplyAreaM2Estimate,
      pyeongSupplyEstimate: toPyeong(supplyAreaM2Estimate),
    };
  });
}

function sortByDealDateDesc(items) {
  return [...items].sort((a, b) => b.deal_date.localeCompare(a.deal_date));
}

function summarizeByField(items, priceField) {
  if (items.length === 0) {
    return { count: 0, avgPricePerPyeong10k: 0, maxPrice10k: 0 };
  }
  let totalPricePerPyeong = 0;
  let maxPrice10k = 0;
  for (const item of items) {
    const pyeong = item.area_m2 / PYEONG_M2;
    const price = item[priceField];
    totalPricePerPyeong += price / pyeong;
    if (price > maxPrice10k) maxPrice10k = price;
  }
  return {
    count: items.length,
    avgPricePerPyeong10k: Math.round(totalPricePerPyeong / items.length),
    maxPrice10k,
  };
}

// 특정 월 기준 서울 25개 구를 평균 평당가 내림차순으로 랭킹
function getDistrictRankingForMonth(dealYmd, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const ranking = store.listRegions().map((region) => {
    const items = store.getMonthlyData(region.lawd_cd, kind, dealYmd);
    return { district: region.name, dealYmd, ...summarizeByField(items, priceField) };
  });
  ranking.sort((a, b) => b.avgPricePerPyeong10k - a.avgPricePerPyeong10k);
  return ranking;
}

// 단지명(부분일치)으로 25개 구 x 백필된 전체 기간을 스캔해 거래 내역을 모은다.
function searchComplexTimeSeries(name, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const matches = [];

  for (const region of store.listRegions()) {
    for (const dealYmd of store.listAvailableMonths(region.lawd_cd, kind)) {
      const items = store.getMonthlyData(region.lawd_cd, kind, dealYmd);
      for (const item of items) {
        if (item.name.includes(name)) {
          const supplyAreaM2Estimate = Math.round(estimateSupplyAreaM2(item.area_m2) * 10) / 10;
          matches.push({
            ...item,
            dong: item.district,
            gu: region.name,
            dealYmd,
            price10k: item[priceField],
            pyeong: toPyeong(item.area_m2),
            supplyAreaM2Estimate,
            pyeongSupplyEstimate: toPyeong(supplyAreaM2Estimate),
          });
        }
      }
    }
  }

  return sortByDealDateDesc(matches);
}

// 전월/전년동기 비교 데이터를 포함한 랭킹 반환
function getDistrictRankingWithComparison(dealYmd, kind = "trade") {
  const prevMonthYmd = shiftYmd(dealYmd, -1);
  const prevYearYmd = shiftYmd(dealYmd, -12);

  const current = getDistrictRankingForMonth(dealYmd, kind);
  const prevMonth = getDistrictRankingForMonth(prevMonthYmd, kind);
  const prevYear = getDistrictRankingForMonth(prevYearYmd, kind);

  const prevMonthMap = new Map(prevMonth.map((d) => [d.district, d]));
  const prevYearMap = new Map(prevYear.map((d) => [d.district, d]));

  return current.map((d) => ({
    ...d,
    countPrevMonth: prevMonthMap.get(d.district)?.count ?? null,
    countPrevYear: prevYearMap.get(d.district)?.count ?? null,
    avgPricePrevMonth: prevMonthMap.get(d.district)?.avgPricePerPyeong10k ?? null,
    avgPricePrevYear: prevYearMap.get(d.district)?.avgPricePerPyeong10k ?? null,
  }));
}

// 특정 구(districtName)의 동별 평단가 집계
function getDongRankingForDistrict(districtName, dealYmd, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const region = store.findRegionByName(districtName);
  if (!region) return [];

  const items = store.getMonthlyData(region.lawd_cd, kind, dealYmd);
  const dongMap = new Map();

  for (const item of items) {
    const dong = item.district;
    const price = item[priceField];
    const area = item.area_m2;
    if (!price || !area) continue;
    if (!dongMap.has(dong)) dongMap.set(dong, { total: 0, count: 0 });
    const entry = dongMap.get(dong);
    entry.total += price / (area / PYEONG_M2);
    entry.count++;
  }

  return [...dongMap.entries()]
    .map(([dong, { total, count }]) => ({
      dong,
      count,
      avgPricePerPyeong10k: Math.round(total / count),
    }))
    .sort((a, b) => b.avgPricePerPyeong10k - a.avgPricePerPyeong10k);
}

// 특정 동의 최근 12개월 평균 평단가 시계열
function getDongTimeSeries(districtName, dong, dealYmd, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const region = store.findRegionByName(districtName);
  if (!region) return [];

  const result = [];
  for (let i = 11; i >= 0; i--) {
    const ymd = shiftYmd(dealYmd, -i);
    const dongItems = store
      .getMonthlyData(region.lawd_cd, kind, ymd)
      .filter((item) => item.district === dong);

    let total = 0, validCount = 0;
    for (const item of dongItems) {
      const price = item[priceField];
      const area = item.area_m2;
      if (!price || !area) continue;
      total += price / (area / PYEONG_M2);
      validCount++;
    }
    result.push({
      dealYmd: ymd,
      avgPricePerPyeong10k: validCount > 0 ? Math.round(total / validCount) : null,
    });
  }
  return result;
}

// 특정 동의 아파트별 평단가 랭킹 (전월비/전년비 포함)
function getDongApartmentRanking(districtName, dong, dealYmd, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const region = store.findRegionByName(districtName);
  if (!region) return [];

  const prevMonthYmd = shiftYmd(dealYmd, -1);
  const prevYearYmd = shiftYmd(dealYmd, -12);

  function computeAptAvg(ymd) {
    const aptMap = new Map();
    const items = store
      .getMonthlyData(region.lawd_cd, kind, ymd)
      .filter((item) => item.district === dong);
    for (const item of items) {
      const price = item[priceField];
      const area = item.area_m2;
      if (!price || !area) continue;
      if (!aptMap.has(item.name)) aptMap.set(item.name, { total: 0, count: 0 });
      const e = aptMap.get(item.name);
      e.total += price / (area / PYEONG_M2);
      e.count++;
    }
    return aptMap;
  }

  const currentMap = computeAptAvg(dealYmd);
  const prevMonthMap = computeAptAvg(prevMonthYmd);
  const prevYearMap = computeAptAvg(prevYearYmd);

  return [...currentMap.entries()]
    .map(([name, { total, count }]) => {
      const avgPrice = Math.round(total / count);
      const pm = prevMonthMap.get(name);
      const py = prevYearMap.get(name);
      return {
        name,
        count,
        avgPricePerPyeong10k: avgPrice,
        avgPricePrevMonth: pm ? Math.round(pm.total / pm.count) : null,
        avgPricePrevYear: py ? Math.round(py.total / py.count) : null,
      };
    })
    .sort((a, b) => b.avgPricePerPyeong10k - a.avgPricePerPyeong10k);
}

// 서울 전체 특정 월 집계 (25개 구 합산)
function getSeoulMonthlySummary(dealYmd, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const prevMonthYmd = shiftYmd(dealYmd, -1);
  const prevYearYmd = shiftYmd(dealYmd, -12);

  function aggregate(ymd) {
    const allItems = store
      .listRegions()
      .flatMap((r) => store.getMonthlyData(r.lawd_cd, kind, ymd));
    return summarizeByField(allItems, priceField);
  }

  const current = aggregate(dealYmd);
  const prevMonth = aggregate(prevMonthYmd);
  const prevYear = aggregate(prevYearYmd);

  return {
    dealYmd,
    ...current,
    countPrevMonth: prevMonth.count,
    countPrevYear: prevYear.count,
    avgPricePrevMonth: prevMonth.avgPricePerPyeong10k,
    avgPricePrevYear: prevYear.avgPricePerPyeong10k,
  };
}

// 서울 전체 라이브 꼬리(최근 1~2개월)는 25개 구를 매번 다시 훑어야 해 상대적으로 비싸므로
// (약 0.5~1초) 프로세스 생애주기 동안 한 번만 계산해 메모이즈한다. 캐시 전체와 동일하게
// 서버 재시작 전까지는 바뀌지 않는다는 전제.
const seoulLiveMemo = {};

// 서울 전체 월별 거래량/평단가 시계열 (25개 구 합산, 백필된 전 기간)
// cutoffYmd 이하는 캐시 파일에서, 그 이후(최근 1~2개월)만 라이브로 계산해 합친다.
function getSeoulTimeSeriesAll(kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const cache = loadTimeSeriesCache(kind);
  const regions = store.listRegions();

  if (!seoulLiveMemo[kind]) {
    const liveMonths = liveMonthsAfter(cache.cutoffYmd, kind, regions.map((r) => r.lawd_cd));
    seoulLiveMemo[kind] = liveMonths
      .map((dealYmd) => {
        const items = regions.flatMap((r) => store.getMonthlyData(r.lawd_cd, kind, dealYmd));
        const { count, avgPricePerPyeong10k } = summarizeByField(items, priceField);
        return { dealYmd, count, avgPricePerPyeong10k };
      })
      .filter((row) => row.count > 0);
  }

  return [...cache.seoul, ...seoulLiveMemo[kind]];
}

// 특정 구(districtName)의 월별 거래량/평단가 시계열 (백필된 전 기간)
function getDistrictTimeSeriesAll(districtName, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const region = store.findRegionByName(districtName);
  if (!region) return [];

  const cache = loadTimeSeriesCache(kind);
  const cached = cache.district.filter((r) => r.district === districtName);

  const liveMonths = liveMonthsAfter(cache.cutoffYmd, kind, [region.lawd_cd]);
  const live = liveMonths
    .map((dealYmd) => {
      const items = store.getMonthlyData(region.lawd_cd, kind, dealYmd);
      const { count, avgPricePerPyeong10k } = summarizeByField(items, priceField);
      return { district: districtName, dealYmd, count, avgPricePerPyeong10k };
    })
    .filter((row) => row.count > 0);

  return [...cached, ...live];
}

// 특정 구·동의 월별 거래량/평단가 시계열 (백필된 전 기간)
function getDongTimeSeriesAll(districtName, dong, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const region = store.findRegionByName(districtName);
  if (!region) return [];

  const cache = loadTimeSeriesCache(kind);
  const cached = cache.dong.filter((r) => r.district === districtName && r.dong === dong);

  const liveMonths = liveMonthsAfter(cache.cutoffYmd, kind, [region.lawd_cd]);
  const live = liveMonths
    .map((dealYmd) => {
      const items = store.getMonthlyData(region.lawd_cd, kind, dealYmd).filter((i) => i.district === dong);
      const { count, avgPricePerPyeong10k } = summarizeByField(items, priceField);
      return { district: districtName, dong, dealYmd, count, avgPricePerPyeong10k };
    })
    .filter((row) => row.count > 0);

  return [...cached, ...live];
}

// 특정 구·동·단지의 월별 거래량/평단가 시계열 (백필된 전 기간)
function getApartmentTimeSeriesAll(districtName, dong, name, kind = "trade") {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const region = store.findRegionByName(districtName);
  if (!region) return [];

  const cache = loadTimeSeriesCache(kind);
  const cached = cache.apartment.filter(
    (r) => r.district === districtName && r.dong === dong && r.name === name
  );

  const liveMonths = liveMonthsAfter(cache.cutoffYmd, kind, [region.lawd_cd]);
  const live = liveMonths
    .map((dealYmd) => {
      const items = store
        .getMonthlyData(region.lawd_cd, kind, dealYmd)
        .filter((i) => i.district === dong && i.name === name);
      const { count, avgPricePerPyeong10k } = summarizeByField(items, priceField);
      return { district: districtName, dong, name, dealYmd, count, avgPricePerPyeong10k };
    })
    .filter((row) => row.count > 0);

  return [...cached, ...live];
}

// 캐시 뷰어 탭용: 캐시 파일 메타 정보(기준월, 생성시각, 크기, 레벨별 행 수)
function getCacheInfo() {
  const result = {};
  for (const kind of ["trade", "jeonse"]) {
    const file = path.join(cacheDir, `time-series-${kind}.json`);
    if (!fs.existsSync(file)) {
      result[kind] = null;
      continue;
    }
    const stat = fs.statSync(file);
    const cache = loadTimeSeriesCache(kind);
    result[kind] = {
      cutoffYmd: cache.cutoffYmd,
      builtAt: stat.mtime.toISOString(),
      fileSizeBytes: stat.size,
      counts: {
        seoul: cache.seoul.length,
        district: cache.district.length,
        dong: cache.dong.length,
        apartment: cache.apartment.length,
      },
    };
  }
  return result;
}

// 캐시 뷰어 탭용: 레벨별 캐시 원본 행 조회 (라이브 꼬리 합치지 않고 캐시 파일 내용 그대로)
function getCacheRows(kind, level, { district, dong, name, limit = 500 } = {}) {
  const cache = loadTimeSeriesCache(kind);
  let rows = cache[level] ?? [];
  if (district) rows = rows.filter((r) => r.district === district);
  if (dong) rows = rows.filter((r) => r.dong === dong);
  if (name) rows = rows.filter((r) => r.name?.includes(name));
  return rows.slice(0, Number(limit) || 500);
}

module.exports = {
  shiftYmd,
  getDistrictRankingForMonth,
  getDistrictRankingWithComparison,
  getDongRankingForDistrict,
  getDongTimeSeries,
  getDongApartmentRanking,
  getSeoulMonthlySummary,
  getSeoulTimeSeriesAll,
  getDistrictTimeSeriesAll,
  getDongTimeSeriesAll,
  getApartmentTimeSeriesAll,
  getCacheInfo,
  getCacheRows,
  searchComplexTimeSeries,
  enrichWithPyeong,
  sortByDealDateDesc,
  summarizeByField,
};
