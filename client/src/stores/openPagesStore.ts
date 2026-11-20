import { create } from 'zustand'

// 지금 "열려 있는" 페이지(= 상태를 유지하며 마운트된 페이지) 목록.
// openPaths: 열린 순서(화면 표시용, 순서 고정), recentPaths: 가장 최근에 본 순서(닫을 때 다음 페이지 선택용)
interface OpenPagesState {
  openPaths: string[]
  recentPaths: string[]
  // 페이지를 새로 마운트(상태 초기화)하기 위한 세대 번호
  generation: Record<string, number>
  open: (path: string) => void
  close: (path: string) => void
  reset: (path: string) => void
}

export const useOpenPagesStore = create<OpenPagesState>()((set) => ({
  openPaths: [],
  recentPaths: [],
  generation: {},
  open: (path) =>
    set((state) => ({
      openPaths: state.openPaths.includes(path) ? state.openPaths : [...state.openPaths, path],
      recentPaths: [...state.recentPaths.filter((p) => p !== path), path],
    })),
  close: (path) =>
    set((state) => ({
      openPaths: state.openPaths.filter((p) => p !== path),
      recentPaths: state.recentPaths.filter((p) => p !== path),
    })),
  reset: (path) =>
    set((state) => ({ generation: { ...state.generation, [path]: (state.generation[path] ?? 0) + 1 } })),
}))
