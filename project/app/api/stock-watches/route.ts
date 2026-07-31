import { NextResponse } from "next/server"

import { getApiUser, getWorkspaceOwner } from "@/lib/current-user"
import { getStockWatchesOverview } from "@/lib/stock-queries"

/** Dipakai halaman /saham buat auto-refresh — data sudah delay ~15-20 menit dari sumbernya
 *  (Yahoo Finance), polling di sini cuma bikin UI ikut update begitu cron nyimpen harga baru. */
export async function GET() {
  const actor = await getApiUser()
  if (!actor) return NextResponse.json({ error: "Belum login" }, { status: 401 })

  const owner = await getWorkspaceOwner()
  const overview = await getStockWatchesOverview(owner.id)

  return NextResponse.json(overview)
}
