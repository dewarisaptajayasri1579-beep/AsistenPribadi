import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** User yang sedang login (untuk personalisasi & audit trail). Redirect ke /login jika belum login. */
export async function getCurrentUser() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

/** Sama seperti getCurrentUser tapi tidak throw — untuk middleware/cek opsional. */
export async function getOptionalCurrentUser() {
  return getSessionUser()
}

/** Untuk Route Handlers (API) — tidak bisa pakai redirect(), jadi kembalikan null saja. */
export async function getApiUser() {
  return getSessionUser()
}

/** Pemilik workspace — semua jadwal/tugas/follow-up bersama disimpan di bawah user ini. */
export async function getWorkspaceOwner() {
  const owner = await prisma.user.findFirst({ where: { isOwner: true } })
  if (!owner) throw new Error("Workspace owner belum di-set")
  return owner
}
