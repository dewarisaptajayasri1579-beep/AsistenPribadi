import { NextResponse } from "next/server"

import { runAgent } from "@/lib/agent"
import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { modelLabel } from "@/lib/pricing"

export async function POST(request: Request) {
  const actor = await getApiUser()
  if (!actor) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const command = body?.command

  if (!command || typeof command !== "string" || !command.trim()) {
    return NextResponse.json({ error: "command wajib diisi" }, { status: 400 })
  }

  const owner = await getWorkspaceOwner()
  const { reply, model } = await runAgent({
    ownerId: owner.id,
    actorId: actor.id,
    command: command.trim(),
    assistantInstructions: actor.assistantInstructions,
  })

  return NextResponse.json({ reply, model: modelLabel(model) })
}
