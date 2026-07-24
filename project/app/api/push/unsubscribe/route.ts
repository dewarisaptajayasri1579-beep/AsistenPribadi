import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint tidak valid" }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })

  return NextResponse.json({ ok: true })
}
