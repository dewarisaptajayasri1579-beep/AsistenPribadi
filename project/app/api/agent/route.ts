import { NextResponse } from "next/server"

import { runAgent } from "@/lib/agent"
import { getCurrentUser } from "@/lib/current-user"
import { modelLabel } from "@/lib/pricing"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const command = body?.command

  if (!command || typeof command !== "string" || !command.trim()) {
    return NextResponse.json({ error: "command wajib diisi" }, { status: 400 })
  }

  const user = await getCurrentUser()
  const { reply, model } = await runAgent(user.id, command.trim(), user.assistantInstructions)

  return NextResponse.json({ reply, model: modelLabel(model) })
}
