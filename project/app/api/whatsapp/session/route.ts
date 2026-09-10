import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwnerFor } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { SHARED_SESSION_ID, sessionIdFor } from "@/lib/wa-session"
import { getWahubSessionQr, getWahubSessionStatus, logoutWahubSession, startWahubSession } from "@/lib/wahub"

/** Sesi WA itu milik WORKSPACE, jadi yang boleh mengaturnya cuma direkturnya sendiri —
 *  bukan anggota tim yang kebetulan ikut login ke workspace itu. */
async function requireDirector() {
  const user = await getApiUser()
  if (!user) return { error: NextResponse.json({ error: "Belum login" }, { status: 401 }) }

  const owner = await getWorkspaceOwnerFor(user)
  if (owner.id !== user.id) {
    return { error: NextResponse.json({ error: "Hanya direktur yang bisa mengatur nomor WhatsApp" }, { status: 403 }) }
  }
  return { owner }
}

export async function GET() {
  const { owner, error } = await requireDirector()
  if (error) return error

  // Numpang nomor Naya bersama — tidak perlu (dan tidak boleh) mengintip status sesi bersama
  // lewat sini, cukup laporkan modenya.
  if (!owner!.wahubSessionId) {
    return NextResponse.json({ mode: "shared", sessionId: SHARED_SESSION_ID })
  }

  const status = await getWahubSessionStatus(owner!.wahubSessionId)
  const qr = status.status === "QR_READY" ? await getWahubSessionQr(owner!.wahubSessionId) : null

  return NextResponse.json({
    mode: "own",
    sessionId: owner!.wahubSessionId,
    status: status.status,
    phoneNumber: status.phoneNumber,
    qr,
  })
}

/** Pindah ke nomor sendiri (mulai sesi baru + siapkan QR), atau kembali numpang nomor Naya. */
export async function POST(request: Request) {
  const { owner, error } = await requireDirector()
  if (error) return error

  const body = await request.json().catch(() => null)
  const mode = body?.mode

  if (mode === "shared") {
    // Sesi pribadinya di-logout dulu supaya tidak ada koneksi WhatsApp yang menggantung di WAHUB
    // tanpa ada yang memakainya. Gagal logout tidak boleh menghalangi pindah mode.
    if (owner!.wahubSessionId) {
      try {
        await logoutWahubSession(owner!.wahubSessionId)
      } catch (e) {
        console.error("[wa-session] gagal logout sesi lama:", e)
      }
    }
    await prisma.user.update({ where: { id: owner!.id }, data: { wahubSessionId: null } })
    return NextResponse.json({ ok: true, mode: "shared" })
  }

  if (mode === "own") {
    const sessionId = owner!.wahubSessionId ?? sessionIdFor(owner!.id)
    // Disimpan DULU sebelum sesinya dimulai: kalau urutannya dibalik dan penyimpanan gagal, sesi
    // sudah telanjur jalan di WAHUB tapi tidak ada yang mengenalinya saat webhook masuk.
    await prisma.user.update({ where: { id: owner!.id }, data: { wahubSessionId: sessionId } })

    try {
      await startWahubSession(sessionId)
    } catch (e) {
      console.error("[wa-session] gagal memulai sesi:", e)
      return NextResponse.json({ error: "Gagal menghubungi WAHUB. Coba lagi sebentar." }, { status: 502 })
    }
    return NextResponse.json({ ok: true, mode: "own", sessionId })
  }

  return NextResponse.json({ error: "mode harus 'shared' atau 'own'" }, { status: 400 })
}
