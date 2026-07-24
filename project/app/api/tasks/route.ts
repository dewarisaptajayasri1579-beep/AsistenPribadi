import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getCurrentUser()
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  })
  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json().catch(() => null)

  if (!body?.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title wajib diisi" }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      priority: body.priority ?? "normal",
      category: body.category,
    },
  })

  return NextResponse.json({ task }, { status: 201 })
}
