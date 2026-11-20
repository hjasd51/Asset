// 주담대 미리보기용 규제 수치 설정 (초안).
// 규제는 자주 바뀌므로 계산 로직과 분리해 이 파일에서만 수정한다.
// 모든 금액 단위는 "만원", 비율은 % 단위.

const seoulDistricts = require("./seoul-districts.json");

module.exports = {
  // 화면에 "참고용 / 기준" 으로 노출되는 메타 정보
  meta: {
    basisLabel: "10.15 주택시장 안정화 대책 기준 (참고용 초안 — 최신 규제와 다를 수 있음)",
    basisDate: "2025-10-15",
  },

  // 규제지역 목록 — 10.15 대책 기준 서울 전 지역을 규제지역으로 취급
  regulatedDistricts: seoulDistricts,

  // 기본 대출 조건 (사용자가 화면에서 변경 가능)
  defaults: {
    annualRatePct: 5.0,
    years: 30,
    // 스트레스 DSR 가산금리 (혼합형: 5년 고정 후 변동 가정, 은행연합회 공시 기준 값으로 교체 필요)
    stressRatePct: 2.4,
  },

  // DSR 한도 (은행권)
  dsrLimitPct: 40,

  // LTV 한도: null = 규제 미적용
  ltv: {
    regulated: { default: 40, firstPurchase: 70 },
    nonRegulated: { default: 70, firstPurchase: 80 },
  },

  // DTI 한도: null = 규제 미적용 (비규제지역은 DTI 해제)
  dti: {
    regulated: { default: 40, firstPurchase: 60 },
    nonRegulated: { default: null, firstPurchase: null },
  },

  // 주택가격 구간별 주담대 금액 상한 (규제지역). maxPrice 이하면 해당 상한 적용.
  loanCap: {
    regulated: [
      { maxPrice: 150000, cap: 60000 }, // 15억 이하 6억
      { maxPrice: 250000, cap: 40000 }, // 15~25억 4억
      { maxPrice: Infinity, cap: 20000 }, // 25억 초과 2억
    ],
    nonRegulated: null,
  },

  // 취득세 (주택 유상취득)
  acquisitionTax: {
    // 6억 이하 1%, 6~9억 구간 선형 증가(1~3%), 9억 초과 3%
    lowMaxPrice: 60000,
    highMinPrice: 90000,
    lowRatePct: 1,
    highRatePct: 3,
    // 지방교육세 = 취득세율의 10%
    localEduTaxRatioOfAcqTax: 0.1,
    // 농어촌특별세: 전용 85㎡ 초과 시 0.2%
    ruralSpecialTaxPct: 0.2,
    ruralSpecialTaxAreaM2: 85,
    // 생애최초 취득세 감면 (주택가격 상한, 감면 한도)
    firstPurchaseReduction: { maxPrice: 120000, maxAmount: 200 },
  },

  // 중개보수 상한요율 (주택 매매, 부가세 별도)
  brokerageFee: [
    { maxPrice: 5000, ratePct: 0.6, maxFee: 25 },
    { maxPrice: 20000, ratePct: 0.5, maxFee: 80 },
    { maxPrice: 90000, ratePct: 0.4, maxFee: null },
    { maxPrice: 120000, ratePct: 0.5, maxFee: null },
    { maxPrice: 150000, ratePct: 0.6, maxFee: null },
    { maxPrice: Infinity, ratePct: 0.7, maxFee: null },
  ],
};
