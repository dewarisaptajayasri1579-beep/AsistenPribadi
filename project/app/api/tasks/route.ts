import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()
  const tasks = await prisma.task.findMany({
    where: { userId: owner.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  })
  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body?.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title wajib diisi" }, { status: 400 })
  }

  const owner = await getWorkspaceOwner()
  const task = await prisma.task.create({
    data: {
      userId: owner.id,
      title: body.title,
      description: body.description,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      priority: body.priority ?? "normal",
      category: body.category,
    },
  })

  return NextResponse.json({ task }, { status: 201 })
}
