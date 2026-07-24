import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json({
    name: user.name,
    role: user.role,
    email: user.email,
    assistantInstructions: user.assistantInstructions ?? "",
    notifyAgenda: user.notifyAgenda,
    notifyDailyReport: user.notifyDailyReport,
    notifyPriorityAlert: user.notifyPriorityAlert,
    notifyMorningBriefing: user.notifyMorningBriefing,
  })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: "body tidak valid" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === "string") data.name = body.name
  if (typeof body.role === "string") data.role = body.role
  if (typeof body.email === "string") data.email = body.email
  if (typeof body.assistantInstructions === "string") data.assistantInstructions = body.assistantInstructions
  if (typeof body.notifyAgenda === "boolean") data.notifyAgenda = body.notifyAgenda
  if (typeof body.notifyDailyReport === "boolean") data.notifyDailyReport = body.notifyDailyReport
  if (typeof body.notifyPriorityAlert === "boolean") data.notifyPriorityAlert = body.notifyPriorityAlert
  if (typeof body.notifyMorningBriefing === "boolean") data.notifyMorningBriefing = body.notifyMorningBriefing

  try {
    const updated = await prisma.user.update({ where: { id: user.id }, data })
    return NextResponse.json({ ok: true, user: updated })
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 400 })
  }
}
