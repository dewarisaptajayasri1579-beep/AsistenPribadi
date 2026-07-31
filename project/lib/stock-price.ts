/** Ubah "BBCA"/"bbca"/"BBCA.JK" jadi format ticker Yahoo Finance untuk saham IDX. */
function normalizeTicker(raw: string) {
  const trimmed = raw.trim().toUpperCase()
  return trimmed.includes(".") ? trimmed : `${trimmed}.JK`
}

export interface StockQuote {
  ticker: string
  price: number
  companyName: string | null
}

/** Ambil harga saham terkini lewat Yahoo Finance (unofficial, gratis, delay ~15-20 menit).
 *  Bukan API resmi — kalau formatnya berubah suatu saat, ini titik yang perlu diperbaiki. */
export async function getStockPrice(rawTicker: string): Promise<StockQuote> {
  const ticker = normalizeTicker(rawTicker)

  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })

  if (!res.ok) {
    throw new Error(`Gagal ambil harga "${rawTicker}" (${res.status})`)
  }

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  const price = result?.meta?.regularMarketPrice

  if (!result || typeof price !== "number") {
    throw new Error(`Ticker "${rawTicker}" tidak ditemukan`)
  }

  return {
    ticker: result.meta.symbol,
    price,
    companyName: result.meta.longName ?? result.meta.shortName ?? null,
  }
}
