// 상단 탭 구성 (대분류 → 하위 탭). 헤더와 "열린 페이지" 패널이 같은 정의를 공유한다.

export interface NavItem {
  to: string
  label: string
  end?: boolean
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'realestate',
    label: '부동산',
    items: [
      { to: '/', label: '홈', end: true },
      { to: '/ranking', label: '지역 랭킹' },
      { to: '/complex', label: '단지 시세' },
      { to: '/search', label: '실거래가 검색' },
    ],
  },
  {
    id: 'loan',
    label: '대출',
    items: [{ to: '/loan', label: '대출 시뮬레이터' }],
  },
  {
    id: 'etc',
    label: '기타',
    items: [
      { to: '/apartments', label: '아파트 목록' },
      { to: '/cache-viewer', label: '캐시 뷰어' },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, groupId: g.id })))

export function findGroupByPath(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.items.some((item) => item.to === pathname))
}

export function getPageLabel(path: string): string {
  return ALL_ITEMS.find((item) => item.to === path)?.label ?? path
}
