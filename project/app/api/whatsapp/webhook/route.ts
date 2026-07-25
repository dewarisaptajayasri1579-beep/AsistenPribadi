import { NextResponse } from "next/server"

import { handleWhatsappWebhook } from "@/lib/whatsapp-webhook"

// Endpoint ini dipanggil oleh server WAHUB (bukan browser kita), jadi tidak ada session
// cookie — diproteksi pakai secret di query string sebagai gantinya. Lihat proxy.ts untuk
// pengecualian rute ini dari pengecekan login.
export async function POST(request: Request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get("secret")

  if (!process.env.WAHUB_WEBHOOK_SECRET || secret !== process.env.WAHUB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 })

  try {
    const result = await handleWhatsappWebhook(body)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[whatsapp webhook] gagal:", error)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
