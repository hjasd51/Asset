import { create } from 'zustand'
import { findGroupByPath } from '@/lib/navConfig'

// 탭(경로)별로 마지막에 보고 있던 URL(path + search)과, 대분류별로 마지막에 보던 하위 탭을 기억한다.
// 헤더 탭을 눌러 돌아올 때 이 값으로 이동해 상세 화면(예: 지역 랭킹의 구 상세)을 복원한다.
interface TabLocationState {
  lastUrlByPath: Record<string, string>
  lastPathByGroup: Record<string, string>
  remember: (path: string, url: string) => void
  forget: (path: string) => void
}

export const useTabLocationStore = create<TabLocationState>()((set) => ({
  lastUrlByPath: {},
  lastPathByGroup: {},
  remember: (path, url) =>
    set((state) => {
      const groupId = findGroupByPath(path)?.id
      const sameUrl = state.lastUrlByPath[path] === url
      const sameGroup = !groupId || state.lastPathByGroup[groupId] === path
      if (sameUrl && sameGroup) return state
      return {
        lastUrlByPath: { ...state.lastUrlByPath, [path]: url },
        lastPathByGroup: groupId ? { ...state.lastPathByGroup, [groupId]: path } : state.lastPathByGroup,
      }
    }),
  // 페이지를 닫으면 기억해 둔 URL도 지워서 다시 열 때 기본 화면에서 시작한다
  forget: (path) =>
    set((state) => {
      const { [path]: _removedUrl, ...restUrls } = state.lastUrlByPath
      const restGroups = Object.fromEntries(Object.entries(state.lastPathByGroup).filter(([, p]) => p !== path))
      return { lastUrlByPath: restUrls, lastPathByGroup: restGroups }
    }),
}))
