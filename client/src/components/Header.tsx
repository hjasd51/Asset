import { NavLink, useLocation } from 'react-router-dom'
import { Building2, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, findGroupByPath } from '@/lib/navConfig'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useTabLocationStore } from '@/stores/tabLocationStore'

export default function Header() {
  const { dark, toggle } = useDarkMode()
  const { pathname } = useLocation()
  const lastUrlByPath = useTabLocationStore((s) => s.lastUrlByPath)
  const lastPathByGroup = useTabLocationStore((s) => s.lastPathByGroup)

  const activeGroup = findGroupByPath(pathname) ?? NAV_GROUPS[0]

  // 하위 탭: 다른 탭에서 돌아올 때는 그 탭에서 마지막으로 보던 URL로, 이미 그 탭이면 기본 화면으로(상세 → 목록 초기화)
  const resolveTabTarget = (to: string) => (pathname === to ? to : (lastUrlByPath[to] ?? to))

  // 대분류: 그 분류에서 마지막으로 보던 하위 탭으로 이동 (처음이면 첫 번째 탭)
  const resolveGroupTarget = (groupId: string) => {
    const group = NAV_GROUPS.find((g) => g.id === groupId)!
    if (group.id === activeGroup.id) return pathname
    const lastPath = lastPathByGroup[groupId] ?? group.items[0].to
    return lastUrlByPath[lastPath] ?? lastPath
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-surface)]/80">
      <div className="mx-auto max-w-screen-xl px-4">
        <div className="flex h-12 items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-[var(--text-primary)] shrink-0">
            <Building2 className="h-5 w-5" />
            <span className="hidden sm:inline">부동산 인사이트</span>
          </NavLink>
          <nav aria-label="대분류" className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {NAV_GROUPS.map((group) => {
              const isActive = group.id === activeGroup.id
              return (
                <NavLink
                  key={group.id}
                  to={resolveGroupTarget(group.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                    isActive ? 'bg-[var(--text-primary)] text-[var(--bg-surface)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-surface)]' : 'text-[var(--text-secondary)]'
                  )}
                >
                  {group.label}
                </NavLink>
              )
            })}
          </nav>
          <button
            onClick={toggle}
            aria-label="다크 모드 전환"
            className="shrink-0 rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <nav aria-label={`${activeGroup.label} 하위 탭`} className="-mb-px flex items-center gap-0.5 overflow-x-auto text-sm">
          {activeGroup.items.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={resolveTabTarget(to)}
              end={end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap border-b-2 px-3 py-2 transition-colors hover:text-[var(--text-primary)]',
                  isActive
                    ? 'border-[var(--text-primary)] font-medium text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)]'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
