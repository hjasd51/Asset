// data/real-estate/ 원본 파일을 1회 전체 스캔해 서울/구/동/아파트 4단계 월별 집계를
// data/cache/time-series-<kind>.json 에 저장한다. 백필로 새 월이 추가될 때마다 재실행한다
// (node scripts/build-time-series-cache.js 또는 npm run build-cache).
//
// 원본 1,725개(25개 구 x 69개월) 파일을 다시 읽는 무거운 작업이라 수십 초가 걸릴 수 있지만,
// 오프라인에서 한 번 돌리는 배치라 서비스 요청을 막지 않는다.
// 신고기한(30일) 미완인 최근 2개월은 캐시에서 제외하고(cutoffYmd), 요청 시점에 라이브로 계산한다.

const fs = require("fs");
const path = require("path");
const store = require("../lib/realEstateStore");
const { PYEONG_M2 } = require("../lib/areaUtils");
const { shiftYmd } = require("../lib/analytics");

const cacheDir = path.join(__dirname, "../data/cache");

function bump(map, key) {
  let entry = map.get(key);
  if (!entry) {
    entry = { total: 0, count: 0 };
    map.set(key, entry);
  }
  return entry;
}

function finalize(map, fields) {
  return [...map.entries()].map(([key, { total, count }]) => {
    const parts = key.split("|");
    const row = {};
    fields.forEach((f, i) => { row[f] = parts[i]; });
    row.count = count;
    row.avgPricePerPyeong10k = Math.round(total / count);
    return row;
  });
}

function buildForKind(kind) {
  const priceField = kind === "trade" ? "price_10k" : "deposit_10k";
  const regions = store.listRegions();

  const allMonths = [...new Set(regions.flatMap((r) => store.listAvailableMonths(r.lawd_cd, kind)))].sort();
  if (allMonths.length === 0) {
    return { cutoffYmd: null, seoul: [], district: [], dong: [], apartment: [] };
  }
  // 신고기한 미완인 최근 2개월은 캐시 대상에서 제외 (Home/Ranking과 동일한 컷오프 규칙)
  const cutoffYmd = shiftYmd(allMonths[allMonths.length - 1], -2);
  const cachedMonths = allMonths.filter((ymd) => ymd <= cutoffYmd);

  const seoulMap = new Map();
  const districtMap = new Map();
  const dongMap = new Map();
  const aptMap = new Map();

  for (const region of regions) {
    const gu = region.name;
    for (const dealYmd of cachedMonths) {
      const items = store.getMonthlyData(region.lawd_cd, kind, dealYmd);
      for (const item of items) {
        const price = item[priceField];
        if (!price || !item.area_m2) continue;
        const pricePerPyeong = price / (item.area_m2 / PYEONG_M2);
        const dong = item.district;
        const name = item.name;

        for (const [map, key] of [
          [seoulMap, dealYmd],
          [districtMap, `${gu}|${dealYmd}`],
          [dongMap, `${gu}|${dong}|${dealYmd}`],
          [aptMap, `${gu}|${dong}|${name}|${dealYmd}`],
        ]) {
          const entry = bump(map, key);
          entry.total += pricePerPyeong;
          entry.count += 1;
        }
      }
    }
  }

  return {
    cutoffYmd,
    seoul: finalize(seoulMap, ["dealYmd"]),
    district: finalize(districtMap, ["district", "dealYmd"]),
    dong: finalize(dongMap, ["district", "dong", "dealYmd"]),
    apartment: finalize(aptMap, ["district", "dong", "name", "dealYmd"]),
  };
}

function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const kind of ["trade", "jeonse"]) {
    const start = Date.now();
    const result = buildForKind(kind);
    fs.writeFileSync(path.join(cacheDir, `time-series-${kind}.json`), JSON.stringify(result));
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[${kind}] cutoff=${result.cutoffYmd} seoul=${result.seoul.length} ` +
      `district=${result.district.length} dong=${result.dong.length} apartment=${result.apartment.length} ` +
      `(${elapsedSec}s)`
    );
  }
}

main();
