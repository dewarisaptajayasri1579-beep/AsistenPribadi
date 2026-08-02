import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()
  const motivations = await prisma.motivationMessage.findMany({
    where: { userId: owner.id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ motivations })
}

export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)

  if (!body?.content || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content wajib diisi" }, { status: 400 })
  }

  const owner = await getWorkspaceOwner()
  const motivation = await prisma.motivationMessage.create({
    data: {
      userId: owner.id,
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : null,
      content: body.content.trim(),
      source: "manual",
    },
  })

  return NextResponse.json({ motivation }, { status: 201 })
}
