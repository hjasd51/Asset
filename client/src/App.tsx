import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from '@/components/Header'
import Home from '@/pages/Home'
import Search from '@/pages/Search'
import Ranking from '@/pages/Ranking'
import Complex from '@/pages/Complex'
import Apartments from '@/pages/Apartments'
import Loan from '@/pages/Loan'
import CacheViewer from '@/pages/CacheViewer'

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/complex" element={<Complex />} />
          <Route path="/apartments" element={<Apartments />} />
          <Route path="/loan" element={<Loan />} />
          <Route path="/cache-viewer" element={<CacheViewer />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
