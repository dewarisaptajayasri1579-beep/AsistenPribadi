import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()
  const transactions = await prisma.transaction.findMany({
    where: { userId: owner.id },
    orderBy: { occurredAt: "desc" },
  })
  return NextResponse.json({ transactions })
}

export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (body?.type !== "income" && body?.type !== "expense") {
    return NextResponse.json({ error: "type wajib 'income' atau 'expense'" }, { status: 400 })
  }
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount wajib angka lebih dari 0" }, { status: 400 })
  }

  const owner = await getWorkspaceOwner()
  const transaction = await prisma.transaction.create({
    data: {
      userId: owner.id,
      type: body.type,
      amount,
      category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : null,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      source: "manual",
    },
  })

  return NextResponse.json({ transaction }, { status: 201 })
}
