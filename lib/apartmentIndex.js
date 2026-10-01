// scripts/build-apartment-index.js가 만든 data/apartments/index.json을 프로세스 시작 시
// 한 번만 메모리로 읡어와 검색/조회에 쓴다. 자동완성은 키 입력마다(debounce가 있어도) 호출되므로
// 매 요청 파일을 다시 읡는 realEstateStore.js 방식 대신 메모리 캐싱을 쓴다.
// 트레이드오프: 배치 스크립트를 재실행해도 이미 뜬 서버 프로세스는 require 캐시에 남은 예전
// 내용을 계속 서빙한다 — 갱신 후에는 서버 재시작이 필요하다.

const fs = require("fs");
const path = require("path");
const { normalizeName } = require("./apartmentAggregator");

const indexPath = path.join(__dirname, "../data/apartments/index.json");

function loadIndex() {
  if (!fs.existsSync(indexPath)) {
    // 배치 스크립트를 아직 실행하지 않은 상태에서도 서버가 죽지 않도록 방어.
    return { generatedAt: null, globalLatestYmd: null, recentWindowStartYmd: null, count: 0, items: [] };
  }
  return JSON.parse(fs.readFileSync(indexPath, "utf8"));
}

const INDEX = loadIndex();

function getMeta() {
  return {
    generatedAt: INDEX.generatedAt,
    globalLatestYmd: INDEX.globalLatestYmd,
    recentWindowStartYmd: INDEX.recentWindowStartYmd,
    count: INDEX.count,
  };
}

function filterByDistrict(items, { gu, dong }) {
  let pool = items;
  if (gu) pool = pool.filter((it) => it.gu === gu);
  if (dong) pool = pool.filter((it) => it.dong === dong);
  return pool;
}

// 이름 부분일치 검색(정규화된 문자열 기준). 시작일치를 우선 노출하고, 그 안에서는
// 거래건수(직거래 제외) 내림차순으로 정렬한다.
function search(query, { gu, dong, limit = 8 } = {}) {
  const q = normalizeName(query || "");
  if (!q) return [];
  const lim = Math.min(Math.max(Number(limit) || 8, 1), 20);

  return filterByDistrict(INDEX.items, { gu, dong })
    .filter((it) => normalizeName(it.name).includes(q))
    .sort((a, b) => {
      const aStarts = normalizeName(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalizeName(b.name).startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.dealCountExcludingDirect - a.dealCountExcludingDirect;
    })
    .slice(0, lim);
}

// 구/동으로 목록을 좁혀서 보여준다("아파트정보" 탭용). 필터가 없으면 거래건수 상위 N개만
// 반환한다(인덱스가 이미 dealCountExcludingDirect desc로 정렬되어 있어 그대로 자른다).
function listByDistrict({ gu, dong, limit = 50 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return filterByDistrict(INDEX.items, { gu, dong }).slice(0, lim);
}

// 특정 구에서 실제로 거래가 있었던 동 목록(구 select 선택 시 동 select를 채우는 용도).
function listDongs(gu) {
  if (!gu) return [];
  return [...new Set(INDEX.items.filter((it) => it.gu === gu).map((it) => it.dong))].sort();
}

module.exports = { getMeta, search, listByDistrict, listDongs };
