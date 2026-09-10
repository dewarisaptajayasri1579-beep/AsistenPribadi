import { prisma } from "@/lib/prisma"

/** Sesi WAHUB bersama ("nomor Naya") — dipakai semua direktur yang tidak punya nomor sendiri.
 *  WAHUB memberi nama sesi default persis "default" (lihat ensureSessionOwnership di
 *  backend-wahub/src/index.js: sessionId kosong -> "default", lalu diprefix client id). */
export const SHARED_SESSION_ID = "default"

/** Short session id untuk direktur yang pakai nomor WhatsApp sendiri. Sengaja diturunkan dari
 *  id user (bukan angka urut atau nomor HP) supaya stabil walau namanya/nomornya diganti, dan
 *  tidak membocorkan nomor telepon siapapun ke dalam nama sesi. */
export function sessionIdFor(userId: string) {
  return `dir-${userId.slice(0, 8)}`
}

/** Sesi mana yang harus dipakai untuk MENGIRIM pesan ke direktur ini. */
export function outgoingSessionId(owner: { wahubSessionId: string | null }) {
  return owner.wahubSessionId ?? SHARED_SESSION_ID
}

/** Kebalikannya: dari sessionId yang dikirim WAHUB di payload webhook, cari direktur pemilik
 *  sesi itu. WAHUB mengirim sessionId LENGKAP ("<clientId>-<short>"), sementara yang kita simpan
 *  cuma bagian short-nya — jadi dicocokkan lewat akhiran.
 *
 *  Mengembalikan null kalau itu sesi bersama: pesannya boleh datang dari direktur manapun, dan
 *  penentuan siapa pengirimnya tetap lewat nomor telepon seperti biasa. */
export async function findPrivateSessionOwner(fullSessionId: string | undefined) {
  if (!fullSessionId) return null

  // Dicocokkan lewat akhiran, bukan dengan memotong panjang client id — supaya tidak ikut rusak
  // kalau format client id WAHUB suatu saat berubah (mis. bukan UUID 36 karakter lagi).
  const owners = await prisma.user.findMany({ where: { wahubSessionId: { not: null } } })
  return owners.find((o) => fullSessionId.endsWith(`-${o.wahubSessionId}`)) ?? null
}
