// 백필된 실거래가 데이터를 기반으로 하는 지역 랭킹 / 단지 시세 추이 분석.

const store = require("./realEstateStore");
const { PYEONG_M2, toPyeong, estimateSupplyAreaM2 } = require("./areaUtils");

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

module.exports = {
  getDistrictRankingForMonth,
  getDistrictRankingWithComparison,
  getDongRankingForDistrict,
  searchComplexTimeSeries,
  enrichWithPyeong,
  sortByDealDateDesc,
  summarizeByField,
};
