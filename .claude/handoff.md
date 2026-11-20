# 작업 인수인계서

> 작성일: 2026-11-20
> 브랜치: main
> 프로젝트: 서울 아파트 실거래가 분석 앱 (D:\claude\Private\Asset)

---

## 이번 세션 완료 작업

이번 세션(2026-11-20)에서는 코드 변경 없이 인수인계서만 갱신했습니다. 아래는 직전 작업 세션(2026-10-26 ~ 10-28)의 최종 결과이며, 이전 인수인계서가 마지막 커밋 내용을 반영하지 못해 이번에 바로잡았습니다.

- **홈 "준비 중" 영역 제거 + 지도 폭 조정** (57872cb8e): 급지 변동 콘텐츠가 추이 차트에 흡수되어 우측 placeholder가 불필요해짐 → 2열 grid를 없애고 `SeoulMap` 카드를 단독 배치(`lg:max-w-xl`)
- **추이 차트 동 단위 드릴다운** (57872cb8e): 구를 선택하면 해당 구의 동 목록 드롭다운이 추가로 노출되고, 동까지 고르면 기존 `dong-time-series-all` API로 동 단위 추이를 그림. 백엔드 변경 없음
- **추이 차트 연도별 급지 뱃지** (a359521ba, 9916ece15): 별도 히트맵 카드 대신 x축 연도 라벨 아래에 급지 뱃지를 표시 (폭 36 / 높이 22 / 폰트 13px)
- **추이 차트 컨트롤** (a8d2125c6): 매매/전세 토글, 구 드릴다운, 기간(1y/3y/all), 전년비교 오버레이

---

## 현재 코드 상태

| 파일 | 역할 / 변경 내용 |
|------|-----------------|
| `client/src/components/SeoulTrendChart.tsx` | 서울/구/동 단위 월별 추이 차트. 상태: `kind`, `scope`(구), `dong`, `dongOptions`, `period`, `showYoY`. URL 분기: `scope && dong` → `dong-time-series-all`, `scope`만 → `district-time-series`, 없으면 `seoul-time-series`. `scope` 변경 시 `dong` 초기화. `makeYearTierPlugin`이 연도 구분선·라벨·급지 뱃지를 캔버스에 직접 그림 |
| `client/src/lib/tier.ts` | 급지 임계값(`TIERS`)과 `getTierFill`/`getTierShort`. `SeoulMap.tsx`와 `SeoulTrendChart.tsx`가 공유 |
| `client/src/pages/Home.tsx` | 요약 카드 → 구별 히트맵 지도(단독 카드) → 지역별 월별 추이 순서 |
| `client/src/components/SeoulMap.tsx` | 구별 히트맵 지도 (모드 탭 + 전월/전년 토글) |
| `lib/analytics.js`, `routes/analytics.js` | 변경 없음 (`/district-yearly`는 추가했다가 되돌림) |

**동 드롭다운 데이터 출처**: `GET /api/analytics/dong-ranking?district=&dealYmd=&kind=`의 응답에서 동 이름만 뽑아 가나다순 정렬. `dealYmd`는 신고기한(30일) 때문에 최근월이 미완이라 **2개월 전** 기준(`DONG_LIST_YMD`, 모듈 로드 시점에 계산)을 사용합니다.

**뱃지 레이아웃 수치** (`makeYearTierPlugin`): x축 `afterFit` `scale.height += 50`, 연도 라벨 `xScale.bottom - 46`(10px), 뱃지 중심 `xScale.bottom - 18`.

---

## 미완성 / WIP

없음 — `git status` 기준 추적 파일 변경사항 없음.

- `client/README.md` (Vite 기본 템플릿, untracked): 여러 세션째 의도적으로 커밋 제외 중. 불필요하면 삭제해도 됨
- **미푸시 커밋 6개** (`origin/main..HEAD`): 아직 push하지 않았음. push 시 Vercel/Render 자동 배포가 트리거됨

---

## 다음 세션 할 일 (우선순위 순)

- [ ] **동 드릴다운 실동작 검증**: 57872cb8e에서 추가된 동 드롭다운은 커밋 시점에 브라우저 검증 기록이 없음. 구 선택 → 동 선택 → 구 변경(동 초기화) → 매매/전세 전환 시 동 목록 재조회 흐름, 동 데이터가 적을 때 차트 모양, 다크모드/모바일 레이아웃 확인
- [ ] **미푸시 커밋 push 여부 결정**: 위 검증 후 `git push origin main` (자동 배포됨 → 사용자 확인 후 진행)
- [ ] **동 드롭다운 엣지 케이스 점검** (`SeoulTrendChart.tsx`): `dong-ranking` fetch 실패 시 드롭다운이 사라지는 점(조용한 실패), `kind` 전환 때 이미 선택된 `dong`이 새 `dongOptions`에 없을 가능성 처리 여부
- [ ] (선택) 아파트 단위 드릴다운 검토: 백엔드 `getApartmentTimeSeriesAll`은 이미 존재, 프론트 UI만 추가하면 됨
- [ ] (선택) 지도 카드 옆 여백 활용 여부 재논의 — 현재 `lg:max-w-xl`로 지도가 좌측에만 있고 우측은 비어 있음

---

## 메모 / 주의사항

- **Bash 권한 (Windows git-bash)**: `kill`/`pkill`/`taskkill`이 차단되어 있음. 서버 재시작이 필요하면 사용자에게 직접 요청하거나 명시적 허용을 받고 `taskkill //PID <pid> //F` 사용
- **백그라운드 서버**: `run_in_background: true` 사용 권장. 같은 포트(백엔드 3000, 클라이언트 5173)가 이미 떠 있으면 `EADDRINUSE`이므로 먼저 `netstat -ano | grep :3000`으로 확인
- **서버 캐시**: `npm run dev`(백엔드)는 `node server.js`(nodemon 아님) → `lib/`, `routes/` 수정 시 수동 재시작 필수. 로컬 서버가 오래 떠 있었다면 최신 코드가 아닐 수 있음
- **브라우저 실동작 검증 방법**: 프로젝트 전용 run 스킬 없음. 격리된 임시 디렉토리에 `npm install playwright` 후 `chromium.launch({ channel: 'chrome', headless: true })`로 시스템 Chrome 구동. 프로젝트 `package.json`은 건드리지 않음
- **`avgPricePerPyeong10k` 단위**: 만원/평. 표시 시 `/10000`해 억 단위로 환산. `tier.ts` 임계값도 같은 단위(최상 12000=12억, 상 7000=7억 등)
- **MOLIT 데이터 특성**: 계약일 기준·신고 완료 건만 포함. 미신고 건은 DB에 없어 최근 1~2개월 수치가 낮게 나옴. 추이 차트와 급지 뱃지 모두 보정 없이 표시하기로 이전에 결정 (최근월이 포함된 연도의 뱃지는 실제보다 낮은 급지로 보일 수 있음)
- **배포**: Vercel(프론트) + Render(백엔드), `main` push 시 자동 배포
