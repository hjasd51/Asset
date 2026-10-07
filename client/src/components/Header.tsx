import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Building2, Moon, Sun } from 'lucide-react'
import { useDarkMode } from '@/hooks/useDarkMode'

const navItems = [
  { to: '/', label: '홈', end: true },
  { to: '/ranking', label: '구별 랭킹' },
  { to: '/search', label: '실거래가 검색' },
  { to: '/complex', label: '단지 시세' },
  { to: '/apartments', label: '아파트 목록' },
  { to: '/loan', label: '대출 시뮬레이터' },
]

export default function Header() {
  const { dark, toggle } = useDarkMode()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-surface)]/80">
      <div className="mx-auto max-w-screen-xl px-4">
        <div className="flex h-14 items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-[var(--text-primary)] shrink-0">
            <Building2 className="h-5 w-5" />
            <span className="hidden sm:inline">부동산 인사이트</span>
          </NavLink>
          <nav className="flex items-center gap-0.5 text-sm overflow-x-auto flex-1">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                    isActive
                      ? 'bg-[var(--bg-muted)] font-medium text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)]'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={toggle}
            aria-label="다크 모드 전환"
            className="shrink-0 rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
