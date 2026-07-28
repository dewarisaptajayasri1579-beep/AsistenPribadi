import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

/** Expose isi WhatsappThread pemilik workspace supaya halaman /wa-test bisa menampilkan
 *  balasan WA nyata yang sudah ditangkap webhook (lib/whatsapp-webhook.ts). */
export async function GET() {
  const actor = await getApiUser()
  if (!actor) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()
  const thread = await prisma.whatsappThread.findUnique({ where: { userId: owner.id } })

  return NextResponse.json({
    history: thread?.history ?? [],
    updatedAt: thread?.updatedAt ?? null,
  })
}
