const WAHUB_BASE_URL = process.env.WAHUB_BASE_URL
const WAHUB_API_KEY = process.env.WAHUB_API_KEY

/** Ubah nomor lokal (08...) jadi format internasional (62...) yang dipakai WAHUB. */
export function normalizePhoneNumber(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "")
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  return digits
}

export async function sendWhatsappMessage(rawNumber: string, message: string) {
  if (!WAHUB_BASE_URL || !WAHUB_API_KEY) {
    throw new Error("WAHUB_BASE_URL / WAHUB_API_KEY belum di-set")
  }

  const number = normalizePhoneNumber(rawNumber)

  const res = await fetch(`${WAHUB_BASE_URL}/api/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": WAHUB_API_KEY },
    body: JSON.stringify({ number, message }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`WAHUB gagal kirim (${res.status}): ${text.slice(0, 200)}`)
  }

  return res.json() as Promise<{ success: boolean }>
}
