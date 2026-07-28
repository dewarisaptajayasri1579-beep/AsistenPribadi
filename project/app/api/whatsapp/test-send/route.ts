import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { sendWhatsappMessage } from "@/lib/wahub"

/** Kirim pesan WA test ke nomor pemilik workspace sendiri — dipakai halaman /wa-test
 *  untuk memverifikasi integrasi WAHUB tanpa harus lewat agent/cron. */
export async function POST(request: Request) {
  const actor = await getApiUser()
  if (!actor) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const message = body?.message
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message wajib diisi" }, { status: 400 })
  }

  const owner = await getWorkspaceOwner()
  if (!owner.phoneNumber) {
    return NextResponse.json({ error: "Nomor WhatsApp pemilik workspace belum diatur di Pengaturan" }, { status: 400 })
  }

  try {
    await sendWhatsappMessage(owner.phoneNumber, message.trim())
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("[api/whatsapp/test-send] gagal kirim:", error)
    return NextResponse.json({ error: "Gagal mengirim pesan WA, cek konfigurasi WAHUB." }, { status: 500 })
  }
}
