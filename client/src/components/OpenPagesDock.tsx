import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { findGroupByPath, getPageLabel } from '@/lib/navConfig'
import { useClosePage } from '@/hooks/useClosePage'
import { useOpenPagesStore } from '@/stores/openPagesStore'
import { useTabLocationStore } from '@/stores/tabLocationStore'

// 왼쪽 아래에 "지금 열려 있는 페이지"를 보여주고, 이름 옆 x로 닫을 수 있는 패널.
// 열린 페이지가 2개 이상일 때만 나타난다 (하나뿐이면 보여줄 게 없음).
export default function OpenPagesDock() {
  const { pathname } = useLocation()
  const openPaths = useOpenPagesStore((s) => s.openPaths)
  const lastUrlByPath = useTabLocationStore((s) => s.lastUrlByPath)
  const closePage = useClosePage()
  const [collapsed, setCollapsed] = useState(false)

  if (openPaths.length < 2) return null

  return (
    <aside
      aria-label="열린 페이지"
      className="fixed bottom-4 left-4 z-40 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg"
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[var(--text-secondary)]"
      >
        <span>열린 페이지 {openPaths.length}</span>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {!collapsed && (
        <ul className="max-h-60 space-y-0.5 overflow-y-auto border-t border-[var(--border-color)] p-1.5">
          {openPaths.map((path) => {
            const isCurrent = path === pathname
            const group = findGroupByPath(path)
            const label = getPageLabel(path)
            return (
              <li
                key={path}
                className={cn('flex items-center rounded-md', isCurrent ? 'bg-[var(--bg-muted)]' : 'hover:bg-[var(--bg-muted)]')}
              >
                <Link
                  to={isCurrent ? path : (lastUrlByPath[path] ?? path)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', isCurrent ? 'bg-emerald-500' : 'bg-[var(--border-color)]')} />
                  <span className="min-w-0 truncate">
                    <span className={cn(isCurrent && 'font-medium')}>{label}</span>
                    {group && <span className="ml-1 text-xs text-[var(--text-muted)]">{group.label}</span>}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => closePage(path)}
                  aria-label={`${label} 닫기`}
                  className="mr-1 shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
