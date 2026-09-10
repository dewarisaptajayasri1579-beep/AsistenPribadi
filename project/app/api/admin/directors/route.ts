import { NextResponse } from "next/server"

import { getApiUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

/** Admin cuma boleh mengurus AKUN, bukan isi workspace orang lain — makanya select-nya dibatasi
 *  ke kolom identitas & status saja. Tugas/jadwal/keuangan direktur lain tetap tidak terjangkau. */
const ACCOUNT_FIELDS = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  approvedAt: true,
  createdAt: true,
} as const

async function requireAdmin() {
  const user = await getApiUser()
  if (!user) return { error: NextResponse.json({ error: "Belum login" }, { status: 401 }) }
  if (!user.isAdmin) return { error: NextResponse.json({ error: "Tidak punya akses" }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const directors = await prisma.user.findMany({
    where: { ownerId: null },
    select: ACCOUNT_FIELDS,
    orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
  })

  return NextResponse.json({
    pending: directors.filter((d) => !d.approvedAt),
    approved: directors.filter((d) => d.approvedAt),
  })
}

/** Setujui pendaftaran, atau cabut persetujuan (menonaktifkan tanpa menghapus datanya). */
export async function PATCH(request: Request) {
  const { user, error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : ""
  const approved = body?.approved

  if (!id || typeof approved !== "boolean") {
    return NextResponse.json({ error: "id dan approved wajib diisi" }, { status: 400 })
  }
  // Admin menonaktifkan dirinya sendiri = tidak ada lagi yang bisa menyetujui siapapun.
  if (id === user!.id && !approved) {
    return NextResponse.json({ error: "Tidak bisa menonaktifkan akunmu sendiri" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.ownerId) {
    return NextResponse.json({ error: "Direktur tidak ditemukan" }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { approvedAt: approved ? (target.approvedAt ?? new Date()) : null },
    select: ACCOUNT_FIELDS,
  })

  return NextResponse.json({ ok: true, director: updated })
}

/** Tolak pendaftaran — hanya untuk akun yang BELUM pernah disetujui, jadi tidak mungkin ada data
 *  kerja yang ikut terhapus. Direktur aktif cukup dinonaktifkan lewat PATCH. */
export async function DELETE(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const id = new URL(request.url).searchParams.get("id") ?? ""
  const target = await prisma.user.findUnique({ where: { id } })

  if (!target || target.ownerId) {
    return NextResponse.json({ error: "Direktur tidak ditemukan" }, { status: 404 })
  }
  if (target.approvedAt) {
    return NextResponse.json(
      { error: "Akun ini sudah pernah aktif — nonaktifkan saja, jangan dihapus" },
      { status: 400 }
    )
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
