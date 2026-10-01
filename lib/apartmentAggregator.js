// data/real-estate/ 캐시(trade)를 스캔한 원본 거래 레코드 배열을 받아, (구/동/아파트명) 단위로
// 평형·연식·거래건수·평당가를 미리 집계한 "아파트 기준정보"를 만든다.
// 순수 함수만 담고 있으며 fs 접근은 하지 않는다(파일 I/O는 scripts/build-apartment-index.js가 담당).
//
// 세대수는 국토교통부 실거래가 API에도 당근부동산 API에도 없는 값이라 이번 스키마에는 넣지 않는다.
// 나중에 K-apt(공동주택관리정보시스템) 등 별도 API를 연동할 때 households 필드를 추가하면 된다.

const { toPyeong, estimateSupplyAreaM2 } = require("./areaUtils");
const { summarizeByField } = require("./analytics");

const RECENT_WINDOW_MONTHS = 12;

// 공백만 다르게 표기된 이름("래미안1차"/"래미안 1차")을 같은 그룹으로 묶기 위한 정규화.
// 로마숫자/한글 약어 차이("Ⅱ" vs "2", "제1차" vs "1차") 같은 표기 오차는 잡지 못하는 걸
// 알려진 한계로 남긴다.
function normalizeName(raw) {
  return String(raw).trim().replace(/\s+/g, "");
}

// 배열에서 가장 많이 등장한 값을 반환한다(동률이면 먼저 나온 값).
function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// (원본이름 -> 등장횟수) Map에서 가장 많이 등장한 원본 이름을 표시용 이름으로 채택한다.
function pickMostFrequentName(rawNameCounts) {
  let best = null;
  let bestCount = 0;
  for (const [name, count] of rawNameCounts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

// 기준 연월(YYYYMM)에서 delta개월만큼 이동한 연월을 반환한다 (delta는 음수 가능).
// public/js/complex.js의 shiftYmd와 동일한 알고리즘(서버/브라우저가 번들러 없이 분리돼 있어 복제).
function shiftYmd(ymd, delta) {
  const y = parseInt(ymd.slice(0, 4), 10);
  const rawM = parseInt(ymd.slice(4, 6), 10) + delta;
  const yy = y + Math.floor((rawM - 1) / 12);
  const mm = (((rawM - 1) % 12) + 12) % 12 + 1;
  return `${yy}${String(mm).padStart(2, "0")}`;
}

// analytics.js의 searchComplexTimeSeries/enrichWithPyeong과 완전히 동일한 계산식으로
// 공급면적 추정 기준 평형("23평, 34평"처럼 사용자에게 보여주는 값)을 구한다.
function pyeongSupplyEstimateOf(item) {
  if (item.area_m2 == null) return null;
  const supplyAreaM2Estimate = Math.round(estimateSupplyAreaM2(item.area_m2) * 10) / 10;
  return toPyeong(supplyAreaM2Estimate);
}

// summarizeByField는 거래 0건일 때 avgPricePerPyeong10k: 0을 반환하는데, 이걸 그대로 노출하면
// "평당가 0원"처럼 오해를 준다. 0건이면 null로 감싼다.
function toAvgOrNull(summary) {
  return summary.count > 0 ? summary.avgPricePerPyeong10k : null;
}

// records: molitClient.normalizeTrade 결과에 gu(구 이름)와 dealYmd(연월)를 덧붙인 배열.
function buildApartmentIndex(records) {
  const months = [...new Set(records.map((r) => r.dealYmd))].sort();
  const globalLatestYmd = months.length ? months[months.length - 1] : null;
  const recentWindowStartYmd = globalLatestYmd
    ? shiftYmd(globalLatestYmd, -(RECENT_WINDOW_MONTHS - 1))
    : null;

  const groups = new Map();
  for (const r of records) {
    const key = `${r.gu}|${r.district}|${normalizeName(r.name)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        gu: r.gu,
        dong: r.district,
        rawNameCounts: new Map(),
        buildYears: [],
        pyeongSet: new Set(),
        items: [],
      });
    }
    const g = groups.get(key);
    g.rawNameCounts.set(r.name, (g.rawNameCounts.get(r.name) || 0) + 1);
    if (r.build_year) g.buildYears.push(r.build_year);
    const pyeong = pyeongSupplyEstimateOf(r);
    if (pyeong != null) g.pyeongSet.add(pyeong);
    g.items.push(r);
  }

  const items = [...groups.values()].map((g) => {
    const nonDirect = g.items.filter((it) => it.deal_type !== "직거래");
    const recentNonDirect = recentWindowStartYmd
      ? nonDirect.filter((it) => it.dealYmd >= recentWindowStartYmd)
      : [];

    return {
      name: pickMostFrequentName(g.rawNameCounts),
      gu: g.gu,
      dong: g.dong,
      pyeongList: [...g.pyeongSet].sort((a, b) => a - b),
      buildYear: g.buildYears.length ? mode(g.buildYears) : null,
      dealCount: g.items.length,
      dealCountExcludingDirect: nonDirect.length,
      avgPricePerPyeong10kAllTime: toAvgOrNull(summarizeByField(nonDirect, "price_10k")),
      avgPricePerPyeong10kRecent12m: toAvgOrNull(summarizeByField(recentNonDirect, "price_10k")),
      recentDealCount: recentNonDirect.length,
      lastDealYmd: g.items.map((it) => it.dealYmd).sort().pop(),
    };
  });

  items.sort((a, b) => b.dealCountExcludingDirect - a.dealCountExcludingDirect);

  return {
    generatedAt: new Date().toISOString(),
    sourceKind: "trade",
    globalLatestYmd,
    recentWindowStartYmd,
    count: items.length,
    items,
  };
}

module.exports = { buildApartmentIndex, normalizeName, mode, shiftYmd };
