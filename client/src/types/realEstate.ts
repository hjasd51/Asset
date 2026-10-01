export type DealKind = 'trade' | 'jeonse'

export interface TradeItem {
  aptNm: string
  dealYear: string
  dealMonth: string
  dealDay: string
  dealAmount: string
  excluUseAr: string
  floor: string
  umdNm: string
  sggNm?: string
}

export interface RentItem {
  aptNm: string
  year: string
  month: string
  day: string
  deposit: string
  monthlyRent: string
  excluUseAr: string
  floor: string
  umdNm: string
  sggNm?: string
}

export interface DistrictRankingItem {
  gu: string
  count: number
  avgPrice10k: number
  medianPrice10k: number
}

export interface ComplexTimeSeriesItem {
  gu: string
  dong: string
  deal_date: string
  dealYmd: string
  area_m2: number
  supplyAreaM2Estimate: number
  pyeong: number
  pyeongSupplyEstimate: number
  floor: number
  price10k: number | null
  deposit10k?: number | null
  deal_type?: string
  build_year?: number | null
}

export interface DaangnListing {
  buildingName: string
  addressInfo: string
  area_m2: number | null
  supplyAreaM2Estimate: number | null
  pyeong: number | null
  pyeongSupplyEstimate: number | null
  floor: number | null
  trade: {
    tradeType: string
    price10k: number | null
    deposit10k: number | null
  }
}

export interface ApartmentIndexEntry {
  name: string
  gu: string
  dong: string
  count: number
  avgPrice10k?: number
}
