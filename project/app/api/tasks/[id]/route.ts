import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: "body tidak valid" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.priority !== undefined) data.priority = body.priority
  if (body.category !== undefined) data.category = body.category
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.status !== undefined) {
    data.status = body.status
    data.completedAt = body.status === "done" ? new Date() : null
  }

  try {
    const task = await prisma.task.update({
      where: { id, userId: user.id },
      data,
    })
    return NextResponse.json({ task })
  } catch {
    return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 })
  }
}
