import { NextResponse } from "next/server"

import { runAgent } from "@/lib/agent"
import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { modelLabel } from "@/lib/pricing"

export async function POST(request: Request) {
  const actor = await getApiUser()
  if (!actor) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const command = body?.command
  const history = Array.isArray(body?.history) ? body.history : undefined

  if (!command || typeof command !== "string" || !command.trim()) {
    return NextResponse.json({ error: "command wajib diisi" }, { status: 400 })
  }

  const owner = await getWorkspaceOwner()
  const runParams = {
    ownerId: owner.id,
    actorId: actor.id,
    command: command.trim(),
    assistantInstructions: actor.assistantInstructions,
  }

  try {
    const { reply, model, messages } = await runAgent({ ...runParams, history })
    return NextResponse.json({ reply, model: modelLabel(model), history: messages })
  } catch (error) {
    console.error("[api/agent] gagal, coba ulang tanpa histori:", error)
    try {
      // Kalau histori dari client korup/tidak valid, coba sekali lagi dari percakapan baru
      // daripada langsung error ke user.
      const { reply, model, messages } = await runAgent(runParams)
      return NextResponse.json({ reply, model: modelLabel(model), history: messages })
    } catch (retryError) {
      console.error("[api/agent] gagal walau tanpa histori:", retryError)
      return NextResponse.json({ error: "Gagal memproses perintah, coba lagi." }, { status: 500 })
    }
  }
}
