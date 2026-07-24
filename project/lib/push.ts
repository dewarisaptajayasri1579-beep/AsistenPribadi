import webpush from "web-push"

import { prisma } from "@/lib/prisma"

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT

let configured = false
function ensureConfigured() {
  if (configured) return
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT belum di-set")
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  configured = true
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

/** Kirim push notification ke semua device yang subscribe milik satu user. Subscription yang sudah
 *  tidak valid (device uninstall app, dsb — HTTP 404/410 dari browser push service) otomatis dihapus. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured()

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error(`[push] Gagal kirim ke subscription ${sub.id}:`, error)
        }
      }
    })
  )
}
