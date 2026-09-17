import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "@/lib/wahub"

export async function GET() {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  return NextResponse.json({
    name: user.name,
    role: user.role,
    sapaan: user.sapaan ?? "",
    email: user.email,
    phoneNumber: user.phoneNumber ?? "",
    assistantInstructions: user.assistantInstructions ?? "",
    notifyAgenda: user.notifyAgenda,
    notifyDailyReport: user.notifyDailyReport,
    notifyGombal: user.notifyGombal,
    notifyMorningBriefing: user.notifyMorningBriefing,
    notifyStockMarket: user.notifyStockMarket,
    stockNotifyPhone1: user.stockNotifyPhone1 ?? "",
    stockNotifyPhone2: user.stockNotifyPhone2 ?? "",
  })
}

export async function PATCH(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: "body tidak valid" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === "string") data.name = body.name
  if (typeof body.role === "string") data.role = body.role
  if (typeof body.sapaan === "string") data.sapaan = body.sapaan.trim() || null
  if (typeof body.email === "string") data.email = body.email
  if (typeof body.phoneNumber === "string") data.phoneNumber = body.phoneNumber || null
  if (typeof body.assistantInstructions === "string") data.assistantInstructions = body.assistantInstructions
  if (typeof body.notifyAgenda === "boolean") data.notifyAgenda = body.notifyAgenda
  if (typeof body.notifyDailyReport === "boolean") data.notifyDailyReport = body.notifyDailyReport
  if (typeof body.notifyGombal === "boolean") data.notifyGombal = body.notifyGombal
  if (typeof body.notifyMorningBriefing === "boolean") data.notifyMorningBriefing = body.notifyMorningBriefing
  if (typeof body.notifyStockMarket === "boolean") data.notifyStockMarket = body.notifyStockMarket
  if (typeof body.stockNotifyPhone1 === "string") data.stockNotifyPhone1 = body.stockNotifyPhone1 || null
  if (typeof body.stockNotifyPhone2 === "string") data.stockNotifyPhone2 = body.stockNotifyPhone2 || null

  // Nomor WA adalah SATU-SATUNYA cara Naya tahu pesan masuk ini dari direktur yang mana
  // (lihat findRegisteredSender di lib/whatsapp-webhook.ts). Kalau dua akun memakai nomor yang
  // sama, pencarian itu ambigu dan pesan bisa masuk ke workspace orang lain — jadi ditolak di sini.
  if (typeof data.phoneNumber === "string") {
    const normalized = normalizePhoneNumber(data.phoneNumber)
    const others = await prisma.user.findMany({
      where: { id: { not: user.id }, phoneNumber: { not: null } },
      select: { phoneNumber: true },
    })
    if (others.some((o) => normalizePhoneNumber(o.phoneNumber!) === normalized)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp ini sudah dipakai akun lain. Tiap orang harus punya nomor sendiri." },
        { status: 409 }
      )
    }
  }

  try {
    const updated = await prisma.user.update({ where: { id: user.id }, data })
    return NextResponse.json({ ok: true, user: updated })
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 400 })
  }
}
