import type { PreviewResult } from '@/types/loan'

// 서비스 안내 / 산출 기준 및 가정 / 적용된 규제 근거
export default function LoanNotice({ result }: { result: PreviewResult }) {
  return (
    <section className="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 text-sm text-[var(--text-secondary)]">
      <div>
        <h3 className="mb-1.5 font-semibold text-[var(--text-primary)]">서비스 안내</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>입력한 소득·자산·부채 정보로 현재 금융 규제에 따른 예상 대출 가능 한도를 시뮬레이션해요.</li>
          <li>규제지역 여부와 금융 규제를 반영해 주택담보대출 한도를 추정하는 참고용 계산이며, 실제 은행 심사 결과와 다를 수 있어요.</li>
          <li>주택가격은 단지 시세와 같은 실거래 데이터(직거래 제외, 평형별 최근 2개월 평균)를 기준으로 하며 KB시세와 다를 수 있어요.</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-1.5 font-semibold text-[var(--text-primary)]">산출 기준 및 가정</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>무주택자 혹은 처분조건부 1주택자(대출 실행일로부터 6개월 안에 기존 주택 처분)의 구입자금 목적, 아파트를 가정해요.</li>
          <li>부대비용: 취득세(지방교육세·농어촌특별세 포함)와 중개보수 상한요율로 추정한 값이라 실제와 다를 수 있어요. 등기·법무사 비용 등은 포함하지 않아요.</li>
          <li>기존 대출의 스트레스 금리는 반영하지 않고, 원리금균등 상환으로 계산해요.</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-1.5 font-semibold text-[var(--text-primary)]">적용된 규제 근거</h3>
        <ul className="list-disc space-y-1 pl-5">
          {result.appliedRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{result.basis.basisLabel}</p>
      </div>
    </section>
  )
}
