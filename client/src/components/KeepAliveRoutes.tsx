import { useEffect, useLayoutEffect, useRef, type ComponentType } from 'react'
import { UNSAFE_LocationContext, useLocation, useNavigationType, type Location } from 'react-router-dom'
import { useOpenPagesStore } from '@/stores/openPagesStore'
import { useTabLocationStore } from '@/stores/tabLocationStore'

interface KeepAlivePage {
  path: string
  Component: ComponentType
}

// 열어 본 페이지는 언마운트하지 않고 숨겨 둔다 → 탭을 옮겨 다녀도 입력값·결과·차트 상태가 유지된다.
// 아직 열지 않았거나 닫은 페이지는 마운트하지 않아 데이터를 불러오지 않는다. (열린 목록은 openPagesStore가 관리)
//
// 숨겨진 페이지의 useSearchParams/useLocation이 "지금 보고 있는 다른 탭의 URL"을 읽으면
// 상태가 꼬이므로(예: 지역 랭킹 상세가 목록으로 돌아감), 각 페이지에는 그 페이지가 마지막으로 활성이었을 때의
// location을 고정해서 내려준다.
export default function KeepAliveRoutes({ pages }: { pages: KeepAlivePage[] }) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const openPaths = useOpenPagesStore((s) => s.openPaths)
  const generation = useOpenPagesStore((s) => s.generation)
  const openPage = useOpenPagesStore((s) => s.open)
  const remember = useTabLocationStore((s) => s.remember)

  const activePath = pages.find((p) => p.path === location.pathname)?.path ?? null

  const frozenLocationRef = useRef(new Map<string, Location>())
  const scrollRef = useRef(new Map<string, number>())
  const prevActiveRef = useRef<string | null>(null)
  const scrollTargetRef = useRef<number | null>(null)

  if (activePath && prevActiveRef.current !== activePath) {
    // 렌더 단계에서는 아직 DOM이 바뀌기 전이라 이전 탭의 스크롤 위치를 정확히 읽을 수 있다
    if (prevActiveRef.current) scrollRef.current.set(prevActiveRef.current, window.scrollY)
    // 같은 탭으로 다른 파라미터를 들고 들어온 경우(예: 랭킹 → 단지 시세 ?name=)는 맨 위에서 시작
    const prevSearch = frozenLocationRef.current.get(activePath)?.search
    scrollTargetRef.current = prevSearch === location.search ? (scrollRef.current.get(activePath) ?? 0) : 0
    prevActiveRef.current = activePath
  }
  if (activePath) frozenLocationRef.current.set(activePath, location)

  // 열린 페이지 + 지금 보고 있는 페이지 (닫기 직후 이동이 반영되기 전 한 번의 렌더에서도 화면이 비지 않도록)
  const renderPaths = new Set(openPaths)
  if (activePath) renderPaths.add(activePath)

  // 닫힌 페이지가 들고 있던 위치·스크롤 정보는 버린다 (다시 열면 기본 화면에서 시작)
  useEffect(() => {
    const open = new Set(openPaths)
    for (const path of [...frozenLocationRef.current.keys()]) {
      if (!open.has(path) && path !== activePath) {
        frozenLocationRef.current.delete(path)
        scrollRef.current.delete(path)
      }
    }
  }, [openPaths, activePath])

  // 탭 전환 후 이전에 보던 스크롤 위치 복원
  useLayoutEffect(() => {
    if (scrollTargetRef.current != null) {
      window.scrollTo(0, scrollTargetRef.current)
      scrollTargetRef.current = null
    }
  }, [activePath])

  // 실제로 이동했을 때만 "열린 페이지"로 등록한다 (닫은 직후 재등록되는 것을 막기 위해 location.key 기준)
  useEffect(() => {
    if (activePath) openPage(activePath)
  }, [activePath, location.key, openPage])

  useEffect(() => {
    if (activePath) remember(activePath, location.pathname + location.search)
  }, [activePath, location.pathname, location.search, remember])

  return (
    <>
      {pages
        .filter(({ path }) => renderPaths.has(path))
        .map(({ path, Component }) => {
          const isActive = path === activePath
          const pageLocation = isActive ? location : (frozenLocationRef.current.get(path) ?? location)
          return (
            <div key={`${path}#${generation[path] ?? 0}`} className={isActive ? undefined : 'hidden'} aria-hidden={!isActive}>
              <UNSAFE_LocationContext.Provider value={{ location: pageLocation, navigationType }}>
                <Component />
              </UNSAFE_LocationContext.Provider>
            </div>
          )
        })}
    </>
  )
}
