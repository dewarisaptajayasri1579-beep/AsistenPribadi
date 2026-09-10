const WAHUB_BASE_URL = process.env.WAHUB_BASE_URL
const WAHUB_API_KEY = process.env.WAHUB_API_KEY

/** Ubah nomor lokal (08...) jadi format internasional (62...) yang dipakai WAHUB. */
export function normalizePhoneNumber(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "")
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  return digits
}

function requireConfig() {
  if (!WAHUB_BASE_URL || !WAHUB_API_KEY) {
    throw new Error("WAHUB_BASE_URL / WAHUB_API_KEY belum di-set")
  }
  return { baseUrl: WAHUB_BASE_URL, apiKey: WAHUB_API_KEY }
}

/** Semua endpoint WAHUB menerima "sessionId" opsional dan otomatis memberinya prefix client id
 *  (lihat ensureSessionOwnership di backend-wahub/src/index.js). Tidak diisi = sesi "default",
 *  yaitu nomor Naya bersama. */
async function wahubFetch(path: string, init: { method: string; body?: object }) {
  const { baseUrl, apiKey } = requireConfig()

  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`WAHUB ${path} gagal (${res.status}): ${text.slice(0, 200)}`)
  }
  return res
}

/** Kirim pesan WhatsApp. `sessionId` menentukan NOMOR PENGIRIMNYA — kosongkan untuk memakai nomor
 *  Naya bersama, atau isi sesi milik direktur yang pakai nomor sendiri (lihat lib/wa-session.ts).
 *  Salah sesi berarti pesan terkirim dari nomor yang salah, jadi pemanggilnya wajib sadar ini. */
export async function sendWhatsappMessage(rawNumber: string, message: string, sessionId?: string | null) {
  const number = normalizePhoneNumber(rawNumber)

  const res = await wahubFetch("/api/messages/send", {
    method: "POST",
    body: sessionId ? { sessionId, number, message } : { number, message },
  })

  return res.json() as Promise<{ success: boolean }>
}

/** Mulai / hidupkan ulang sebuah sesi, sekaligus mendaftarkan webhook-nya. */
export async function startWahubSession(sessionId: string) {
  await wahubFetch("/api/sessions/start", {
    method: "POST",
    body: { sessionId, webhookUrl: buildWebhookUrl() },
  })
}

export async function getWahubSessionStatus(sessionId: string) {
  const { baseUrl, apiKey } = requireConfig()
  const res = await fetch(`${baseUrl}/api/sessions/status/${encodeURIComponent(sessionId)}`, {
    headers: { "x-api-key": apiKey },
  })
  if (!res.ok) return { status: "UNKNOWN" as const, phoneNumber: null }

  return res.json() as Promise<{ status: string; phoneNumber: string | null }>
}

/** QR login. WAHUB mengembalikan tag <img src="data:image/png;base64,..."> — kita ambil data
 *  URI-nya saja supaya sisi klien tinggal memasangnya ke <img src>. */
export async function getWahubSessionQr(sessionId: string) {
  const { baseUrl, apiKey } = requireConfig()
  const res = await fetch(`${baseUrl}/api/sessions/qr/${encodeURIComponent(sessionId)}`, {
    headers: { "x-api-key": apiKey },
  })
  if (!res.ok) return null

  const body = await res.text()
  return body.match(/(data:image\/png;base64,[A-Za-z0-9+/=]+)/)?.[1] ?? null
}

export async function logoutWahubSession(sessionId: string) {
  await wahubFetch(`/api/sessions/logout/${encodeURIComponent(sessionId)}`, { method: "POST" })
}

function buildWebhookUrl() {
  const appBaseUrl = process.env.APP_BASE_URL
  const webhookSecret = process.env.WAHUB_WEBHOOK_SECRET
  if (!appBaseUrl || !webhookSecret) throw new Error("APP_BASE_URL / WAHUB_WEBHOOK_SECRET belum di-set")

  return `${appBaseUrl}/api/whatsapp/webhook?secret=${webhookSecret}`
}

/** Daftarkan ulang webhook URL SEMUA sesi (nomor Naya bersama + tiap direktur yang pakai nomor
 *  sendiri) pakai env var yang sedang aktif — dipanggil sekali tiap server start (lihat
 *  instrumentation.ts), supaya webhook otomatis ter-sync ulang kalau WAHUB_API_KEY /
 *  WAHUB_WEBHOOK_SECRET / APP_BASE_URL berubah, tanpa perlu didaftarkan manual. */
export async function registerWahubWebhook(sessionIds: string[]) {
  const appBaseUrl = process.env.APP_BASE_URL
  const webhookSecret = process.env.WAHUB_WEBHOOK_SECRET

  if (!WAHUB_BASE_URL || !WAHUB_API_KEY || !appBaseUrl || !webhookSecret) {
    console.warn(
      "[wahub] Lewati registrasi webhook otomatis — pastikan WAHUB_BASE_URL, WAHUB_API_KEY, APP_BASE_URL, dan WAHUB_WEBHOOK_SECRET semua sudah di-set."
    )
    return
  }

  const webhookUrl = buildWebhookUrl()

  for (const sessionId of sessionIds) {
    try {
      const res = await fetch(`${WAHUB_BASE_URL}/api/sessions/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": WAHUB_API_KEY },
        body: JSON.stringify({ sessionId, webhookUrl }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        console.error(`[wahub] Gagal daftar ulang webhook sesi "${sessionId}" (${res.status}):`, JSON.stringify(data))
        continue
      }
      console.log(`[wahub] Webhook sesi "${sessionId}" ter-registrasi:`, data?.message ?? "sukses")
    } catch (error) {
      console.error(`[wahub] Gagal menghubungi WAHUB untuk sesi "${sessionId}":`, error)
    }
  }
}
