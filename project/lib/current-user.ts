import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** User yang sedang login (untuk personalisasi & audit trail). Redirect ke /login jika belum login,
 *  atau ke halaman tunggu kalau pendaftarannya belum disetujui admin. Karena semua halaman memakai
 *  fungsi ini, satu pemeriksaan di sini sudah mengunci seluruh aplikasi dari akun yang pending. */
export async function getCurrentUser() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!user.approvedAt) redirect("/menunggu-persetujuan")
  return user
}

/** Sama seperti getCurrentUser tapi tidak throw — untuk middleware/cek opsional. */
export async function getOptionalCurrentUser() {
  return getSessionUser()
}

/** Untuk Route Handlers (API) — tidak bisa pakai redirect(), jadi kembalikan null saja.
 *  Akun yang belum disetujui diperlakukan seperti belum login: seluruh API route yang memakai
 *  fungsi ini otomatis menolaknya tanpa perlu menambah pemeriksaan satu per satu. */
export async function getApiUser() {
  const user = await getSessionUser()
  if (!user?.approvedAt) return null
  return user
}

/** Direktur pemilik workspace tempat `user` bekerja: dirinya sendiri kalau dia direktur,
 *  atau direkturnya kalau dia anggota tim (mis. sekretaris). Semua tugas/jadwal/keuangan
 *  selalu disimpan di bawah id direktur, bukan id anggota tim. */
export async function getWorkspaceOwnerFor(user: { id: string; ownerId: string | null }) {
  // Selalu ambil ulang dari database (walau ownerId null dan jawabannya user itu sendiri) supaya
  // tipe kembaliannya konsisten User utuh — pemanggilnya butuh phoneNumber, assistantInstructions,
  // dsb. Query-nya lookup primary key, murah.
  const ownerId = user.ownerId ?? user.id

  const owner = await prisma.user.findUnique({ where: { id: ownerId } })
  if (!owner) throw new Error(`Direktur pemilik workspace (${ownerId}) tidak ditemukan`)
  return owner
}

/** Pemilik workspace milik user yang SEDANG LOGIN — semua halaman & API route memakai ini.
 *
 *  Dulu fungsi ini `findFirst({ where: { isOwner: true } })`: satu direktur global, tidak peduli
 *  siapa yang login. Artinya siapapun yang punya akun langsung melihat data direktur pertama di
 *  database. Sekarang di-resolve dari sesi, jadi tiap direktur otomatis terkurung di
 *  workspace-nya sendiri tanpa perlu mengubah satu pun pemanggilnya. */
export async function getWorkspaceOwner() {
  const user = await getCurrentUser()
  return getWorkspaceOwnerFor(user)
}

/** Semua direktur (pemilik workspace) yang aktif — dipakai cron untuk melakukan pekerjaannya
 *  sekali per direktur, bukan sekali untuk satu direktur global. */
export async function getAllWorkspaceOwners() {
  return prisma.user.findMany({ where: { ownerId: null, approvedAt: { not: null } } })
}
