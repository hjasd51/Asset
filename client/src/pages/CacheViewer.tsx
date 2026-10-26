import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Kind = 'trade' | 'jeonse'
type Level = 'seoul' | 'district' | 'dong' | 'apartment'

interface CacheInfoEntry {
  cutoffYmd: string | null
  builtAt: string
  fileSizeBytes: number
  counts: { seoul: number; district: number; dong: number; apartment: number }
}

interface CacheRow {
  district?: string
  dong?: string
  name?: string
  dealYmd: string
  count: number
  avgPricePerPyeong10k: number
}

const LEVEL_LABELS: Record<Level, string> = {
  seoul: '서울 전체',
  district: '구 단위',
  dong: '동 단위',
  apartment: '아파트 단위',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}`
}

function formatBuiltAt(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// avgPricePerPyeong10k는 "만원/평" 단위로 저장되어 있어 억 단위로 환산해 표시
function formatPricePerPyeong(p10k: number): string {
  return `${(p10k / 10000).toFixed(2)}억/평`
}

export default function CacheViewer() {
  const [info, setInfo] = useState<Record<Kind, CacheInfoEntry | null> | null>(null)
  const [kind, setKind] = useState<Kind>('trade')
  const [level, setLevel] = useState<Level>('seoul')
  const [district, setDistrict] = useState('')
  const [dong, setDong] = useState('')
  const [name, setName] = useState('')
  const [limit, setLimit] = useState(200)
  const [rows, setRows] = useState<CacheRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/analytics/cache-info`)
      .then((r) => r.json())
      .then(setInfo)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ kind, level, limit: String(limit) })
    if (district) params.set('district', district)
    if (dong) params.set('dong', dong)
    if (name) params.set('name', name)
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/analytics/cache-rows?${params}`)
        .then((r) => r.json())
        .then(setRows)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [kind, level, district, dong, name, limit])

  const currentInfo = info?.[kind] ?? null

  const columns = useMemo<{ key: keyof CacheRow; label: string }[]>(() => {
    const base: { key: keyof CacheRow; label: string }[] = []
    if (level === 'district' || level === 'dong' || level === 'apartment') base.push({ key: 'district', label: '구' })
    if (level === 'dong' || level === 'apartment') base.push({ key: 'dong', label: '동' })
    if (level === 'apartment') base.push({ key: 'name', label: '단지명' })
    base.push({ key: 'dealYmd', label: '월' })
    base.push({ key: 'count', label: '거래량' })
    base.push({ key: 'avgPricePerPyeong10k', label: '평단가(억/평)' })
    return base
  }, [level])

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">캐시 뷰어</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          <code className="text-xs">scripts/build-time-series-cache.js</code>로 생성된 시계열 캐시 파일 내용을 그대로 확인합니다 (라이브 꼬리 미포함).
        </p>
      </div>

      {/* 캐시 메타 정보 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">캐시 파일 메타 정보</h2>
        {!info ? (
          <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['trade', 'jeonse'] as Kind[]).map((k) => {
              const entry = info[k]
              return (
                <div key={k} className="rounded-lg bg-[var(--bg-muted)] p-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">{k === 'trade' ? '매매' : '전세'}</p>
                  {!entry ? (
                    <p className="text-sm text-[var(--text-muted)]">캐시 파일 없음 — <code className="text-xs">npm run build-cache</code> 실행 필요</p>
                  ) : (
                    <ul className="text-sm text-[var(--text-primary)] space-y-0.5">
                      <li>기준월(cutoff): <span className="font-medium">{entry.cutoffYmd ? formatYmd(entry.cutoffYmd) : '-'}</span> 까지 캐시, 이후는 라이브 계산</li>
                      <li>생성 시각: {formatBuiltAt(entry.builtAt)}</li>
                      <li>파일 크기: {formatBytes(entry.fileSizeBytes)}</li>
                      <li>
                        행 수: 서울 {entry.counts.seoul.toLocaleString()} · 구 {entry.counts.district.toLocaleString()} ·
                        동 {entry.counts.dong.toLocaleString()} · 아파트 {entry.counts.apartment.toLocaleString()}
                      </li>
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">종류</label>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="trade">매매</SelectItem>
              <SelectItem value="jeonse">전세</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">레벨</label>
          <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
                <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(level === 'district' || level === 'dong' || level === 'apartment') && (
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">구</label>
            <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="예: 강남구" className="w-32" />
          </div>
        )}
        {(level === 'dong' || level === 'apartment') && (
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">동</label>
            <Input value={dong} onChange={(e) => setDong(e.target.value)} placeholder="예: 역삼동" className="w-32" />
          </div>
        )}
        {level === 'apartment' && (
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">단지명(포함검색)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 래미안" className="w-40" />
          </div>
        )}
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">최대 행 수</label>
          <Input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 200)}
            className="w-24"
          />
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {LEVEL_LABELS[level]} · {loading ? '조회 중...' : `${rows.length.toLocaleString()}행`}
          </span>
          {currentInfo && rows.length >= limit && (
            <span className="text-xs text-[var(--text-muted)]">최대 행 수({limit})에 도달 — 필터를 좁히거나 최대 행 수를 늘려주세요.</span>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.key === 'dealYmd' ? 'text-[var(--text-secondary)]' : ''}>
                    {c.key === 'dealYmd'
                      ? formatYmd(row.dealYmd)
                      : c.key === 'avgPricePerPyeong10k'
                        ? formatPricePerPyeong(row.avgPricePerPyeong10k)
                        : row[c.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && rows.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] p-5">조건에 맞는 캐시 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  )
}
