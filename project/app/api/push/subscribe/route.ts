import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth

  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Subscription tidak valid" }, { status: 400 })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth },
    create: { userId: user.id, endpoint, p256dh, auth },
  })

  return NextResponse.json({ ok: true })
}
