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
  if (body.status !== undefined) data.status = body.status
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.notes !== undefined) data.notes = body.notes

  const owner = await getWorkspaceOwner()

  try {
    const followUp = await prisma.followUp.update({
      where: { id, userId: owner.id },
      data,
    })
    return NextResponse.json({ followUp })
  } catch {
    return NextResponse.json({ error: "Follow-up tidak ditemukan" }, { status: 404 })
  }
}
