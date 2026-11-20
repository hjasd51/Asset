import { BrowserRouter } from 'react-router-dom'
import Header from '@/components/Header'
import KeepAliveRoutes from '@/components/KeepAliveRoutes'
import OpenPagesDock from '@/components/OpenPagesDock'
import Home from '@/pages/Home'
import Search from '@/pages/Search'
import Ranking from '@/pages/Ranking'
import Complex from '@/pages/Complex'
import Apartments from '@/pages/Apartments'
import Loan from '@/pages/Loan'
import CacheViewer from '@/pages/CacheViewer'

// 탭을 옮겨도 보던 화면이 유지되도록 한 번 열린 페이지는 숨겨 두고 다시 보여준다 (KeepAliveRoutes)
const PAGES = [
  { path: '/', Component: Home },
  { path: '/ranking', Component: Ranking },
  { path: '/complex', Component: Complex },
  { path: '/search', Component: Search },
  { path: '/apartments', Component: Apartments },
  { path: '/loan', Component: Loan },
  { path: '/cache-viewer', Component: CacheViewer },
]

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <KeepAliveRoutes pages={PAGES} />
      </main>
      <OpenPagesDock />
    </BrowserRouter>
  )
}

export default App
