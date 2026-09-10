import { NextResponse } from "next/server"

import { createSession, hashPassword } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: "Email wajib diisi dan password minimal 6 karakter" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    // Akun yang sudah punya password ATAU sudah disetujui admin tidak boleh "diklaim" — kalau
    // tidak, siapapun yang tahu email seorang direktur bisa mengambil alih akunnya (beserta
    // seluruh isi workspace-nya) cukup dengan mendaftar ulang memakai email itu.
    if (existing.passwordHash || existing.approvedAt) {
      return NextResponse.json({ error: "Email sudah terdaftar. Silakan login." }, { status: 409 })
    }
    // Akun lama (mis. hasil seed) yang belum pernah set password & belum disetujui — klaim akun ini.
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hashPassword(password), name: name || existing.name },
    })
    await createSession(user.id)
    return NextResponse.json({ ok: true, pending: true })
  }

  if (!name) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 })
  }

  // Pendaftar baru = calon direktur dengan workspace-nya SENDIRI (ownerId null), tapi statusnya
  // menunggu persetujuan admin (approvedAt null): belum bisa melihat data apapun dan Naya tidak
  // akan membalas WhatsApp-nya. Lihat getCurrentUser/getApiUser di lib/current-user.ts.
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: "Direktur",
    },
  })

  await createSession(user.id)
  return NextResponse.json({ ok: true, pending: true })
}
