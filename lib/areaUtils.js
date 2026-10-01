// 국토교통부 실거래가 자료의 면적(area_m2)은 "전용면적" 기준이며, 분양가 표기에 쓰이는
// "공급면적"은 원본 데이터에 없다. 공급면적 = 전용면적 + 주거공용면적(복도·계단 등)인데
// 단지·타입마다 전용률이 달라 전용면적만으로는 정확한 공급면적을 계산할 수 없다.
// 아파트 평균 전용률(약 76~80%)을 참고해 78%로 가정하고 역산한 추정값이며, 실제 분양
// 공급면적과 다를 수 있다.
const PYEONG_M2 = 3.3;
const ASSUMED_EXCLUSIVE_RATE = 0.78;

function toPyeong(areaM2) {
  return Math.round(areaM2 / PYEONG_M2);
}

// 전용면적(㎡) -> 공급면적 추정치(㎡)
function estimateSupplyAreaM2(exclusiveAreaM2) {
  return exclusiveAreaM2 / ASSUMED_EXCLUSIVE_RATE;
}

module.exports = { PYEONG_M2, ASSUMED_EXCLUSIVE_RATE, toPyeong, estimateSupplyAreaM2 };
