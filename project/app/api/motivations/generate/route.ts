import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/current-user"
import { expandMotivationMessage } from "@/lib/motivation-ai"

/** Rangkai kalimat inti (dari form Motivasi & Prinsip) jadi pesan yang lebih lengkap lewat AI. */
export async function POST(request: Request) {
  const user = await getApiUser()
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const coreSentence = body?.coreSentence
  if (typeof coreSentence !== "string" || !coreSentence.trim()) {
    return NextResponse.json({ error: "coreSentence wajib diisi" }, { status: 400 })
  }

  try {
    const content = await expandMotivationMessage(coreSentence.trim())
    return NextResponse.json({ content })
  } catch (error) {
    console.error("[api/motivations/generate] gagal:", error)
    return NextResponse.json({ error: "Gagal merangkai kalimat, coba lagi." }, { status: 500 })
  }
}
