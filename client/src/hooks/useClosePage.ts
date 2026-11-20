import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useOpenPagesStore } from '@/stores/openPagesStore'
import { useTabLocationStore } from '@/stores/tabLocationStore'

// 열린 페이지를 닫는다 (마운트 해제 → 입력값·결과 등 상태 폐기).
// 보고 있는 페이지를 닫으면 직전에 보던 열린 페이지로 이동하고, 열린 페이지가 하나뿐이면 그 페이지를 기본 화면으로 초기화한다.
export function useClosePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return useCallback(
    (path: string) => {
      const { recentPaths, close, reset } = useOpenPagesStore.getState()
      const { lastUrlByPath, forget } = useTabLocationStore.getState()
      const others = recentPaths.filter((p) => p !== path)

      if (pathname === path && others.length === 0) {
        // 닫을 곳이 없으면 같은 페이지를 처음 상태로 되돌린다
        forget(path)
        reset(path)
        navigate(path)
        return
      }

      // 보고 있던 페이지를 닫을 때는 먼저 이동한 뒤 닫는다 (이동 전에 닫으면 잠깐 빈 화면이 생길 수 있음)
      if (pathname === path) {
        const next = others[others.length - 1]
        navigate(lastUrlByPath[next] ?? next)
      }
      forget(path)
      close(path)
    },
    [navigate, pathname]
  )
}
