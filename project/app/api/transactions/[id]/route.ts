import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "body tidak valid" }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.type !== undefined) {
    if (body.type !== "income" && body.type !== "expense") {
      return NextResponse.json({ error: "type wajib 'income' atau 'expense'" }, { status: 400 })
    }
    data.type = body.type
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount wajib angka lebih dari 0" }, { status: 400 })
    }
    data.amount = amount
  }
  if (body.category !== undefined) data.category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : null
  if (body.description !== undefined) data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null
  if (body.occurredAt !== undefined) data.occurredAt = new Date(body.occurredAt)

  const owner = await getWorkspaceOwner()

  try {
    const transaction = await prisma.transaction.update({
      where: { id, userId: owner.id },
      data,
    })
    return NextResponse.json({ transaction })
  } catch {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()

  try {
    await prisma.transaction.delete({ where: { id, userId: owner.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 })
  }
}
