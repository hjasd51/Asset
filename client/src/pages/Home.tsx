import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Search, BarChart2, Building, Calculator } from 'lucide-react'

const features = [
  {
    to: '/search',
    icon: Search,
    title: '실거래가 검색',
    description: '서울 아파트 실거래 데이터를 구·월 기준으로 조회합니다.',
  },
  {
    to: '/ranking',
    icon: BarChart2,
    title: '구별 랭킹',
    description: '월별 거래 건수·평균 평당가·최고가 기준 서울 25개 구 랭킹을 확인합니다.',
  },
  {
    to: '/complex',
    icon: Building,
    title: '단지 시세',
    description: '단지명을 검색해 매매·전세 시세 추이와 거래 내역을 조회합니다.',
  },
  {
    to: '/apartments',
    icon: Building,
    title: '아파트 목록',
    description: '구·동 필터로 아파트 단지 목록과 평균 평당가를 조회합니다.',
  },
  {
    to: '/loan',
    icon: Calculator,
    title: '대출 시뮬레이터',
    description: 'DSR·LTV·스트레스 DSR 기준 최대 대출 한도를 계산합니다.',
  },
]

export default function Home() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">부동산 인사이트</h1>
        <p className="mt-2 text-[var(--text-secondary)]">서울 아파트 실거래 데이터 분석 및 대출 시뮬레이션</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to}>
            <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
              <CardHeader>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                  <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
