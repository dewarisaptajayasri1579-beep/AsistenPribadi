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
  if (body.label !== undefined) data.label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null
  if (body.content !== undefined) {
    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json({ error: "content tidak boleh kosong" }, { status: 400 })
    }
    data.content = body.content.trim()
  }
  if (typeof body.active === "boolean") data.active = body.active

  const owner = await getWorkspaceOwner()

  try {
    const motivation = await prisma.motivationMessage.update({
      where: { id, userId: owner.id },
      data,
    })
    return NextResponse.json({ motivation })
  } catch {
    return NextResponse.json({ error: "Motivasi tidak ditemukan" }, { status: 404 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()

  try {
    await prisma.motivationMessage.delete({ where: { id, userId: owner.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Motivasi tidak ditemukan" }, { status: 404 })
  }
}
