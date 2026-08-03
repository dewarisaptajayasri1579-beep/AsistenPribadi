import { isSameJakartaDay } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
import { sendWhatsappMessage } from "@/lib/wahub"
import { getStockPrice } from "@/lib/stock-price"

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`
}

/** Cek harga tiap saham yang dipantau, log ke histori, dan kirim WA kalau sudah capai
 *  target jual (harga tetap atau persentase untung dari harga beli). Maks 1 alert per hari
 *  per saham supaya tidak spam WA kalau harga bertahan di atas target berkali-kali cek. */
export async function runStockWatchCheck() {
  const watches = await prisma.stockWatch.findMany({ where: { active: true }, include: { user: true } })
  if (watches.length === 0) return

  const now = new Date()

  for (const watch of watches) {
    let quote
    try {
      quote = await getStockPrice(watch.ticker)
    } catch (error) {
      console.error(`[stock-watch] gagal ambil harga ${watch.ticker}:`, error)
      continue
    }

    await prisma.stockPriceLog.create({ data: { stockWatchId: watch.id, price: quote.price } })

    const targetHit = watch.targetPrice != null && quote.price >= watch.targetPrice
    const percentHit =
      watch.buyPrice != null &&
      watch.targetPercent != null &&
      quote.price >= watch.buyPrice * (1 + watch.targetPercent / 100)

    if (!targetHit && !percentHit) continue
    if (!watch.user.notifyStockMarket) continue

    const numbers = [watch.user.stockNotifyPhone1, watch.user.stockNotifyPhone2].filter(
      (n): n is string => !!n
    )
    if (numbers.length === 0) continue

    const alreadyAlertedToday = watch.lastAlertAt && isSameJakartaDay(watch.lastAlertAt, now)
    if (alreadyAlertedToday) continue

    const message = [
      `📈 Mas Ony, ${watch.ticker}${quote.companyName ? ` (${quote.companyName})` : ""} sekarang ${formatRupiah(quote.price)} nih~`,
      targetHit ? `Udah nyampe target jual kamu (${formatRupiah(watch.targetPrice!)}) lho!` : "",
      percentHit && !targetHit
        ? `Udah untung ${watch.targetPercent}%+ dari harga beli (${formatRupiah(watch.buyPrice!)})!`
        : "",
      "(Harga dari Yahoo Finance, delay ~15-20 menit ya)",
    ]
      .filter(Boolean)
      .join("\n")

    try {
      for (const number of numbers) {
        await sendWhatsappMessage(number, message)
      }
      await prisma.stockWatch.update({ where: { id: watch.id }, data: { lastAlertAt: now } })
    } catch (error) {
      console.error(`[stock-watch] gagal kirim WA alert ${watch.ticker}:`, error)
    }
  }
}
