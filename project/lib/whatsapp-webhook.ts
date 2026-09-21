import type Anthropic from "@anthropic-ai/sdk"

import { runAgent } from "@/lib/agent"
import { getWorkspaceOwnerFor } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import {
  cariDelegasiTerbuka,
  hentikanUntukNomor,
  tafsirBalasan,
  tandaiSelesai,
  kabariDirektur,
} from "@/lib/delegation"
import { runDelegationAgent } from "@/lib/delegation-agent"
import { sapaanOf } from "@/lib/sapaan"
import { findPrivateSessionOwner, outgoingSessionId, SHARED_SESSION_ID } from "@/lib/wa-session"
import { normalizePhoneNumber, sendWhatsappMessage } from "@/lib/wahub"

// Reset histori percakapan kalau nomor itu sudah idle lebih dari ini — supaya konteks lama
// tidak "nyangkut" ke topik baru yang tidak berhubungan.
const THREAD_IDLE_MS = 30 * 60 * 1000

/** Pesan WA yang diawali "##" langsung disimpan sebagai motivasi baru, tanpa lewat AI Agent
 *  (deterministik & hemat kuota Claude). Format: "## Judul, isi motivasi" — judul & koma opsional. */
function parseMotivationShortcut(body: string) {
  if (!body.startsWith("##")) return null

  const rest = body.slice(2).trim()
  if (!rest) return null

  const commaIndex = rest.indexOf(",")
  if (commaIndex === -1) return { label: null, content: rest }

  const label = rest.slice(0, commaIndex).trim()
  const content = rest.slice(commaIndex + 1).trim()
  if (!content) return { label: null, content: rest }

  return { label: label || null, content }
}

interface WahubIncomingMessage {
  from?: string
  senderNumber?: string
  senderName?: string | null
  /** JID chat asal pesan ini (beda dari "from" kalau pesannya dari GRUP — "from" sudah
   *  di-resolve ke JID pengirimnya, bukan chat/grupnya). Grup selalu berakhiran "@g.us". */
  chatId?: string
  isGroup?: boolean
  to?: string
  body?: string
  hasMedia?: boolean
  mediaBase64?: string | null
  mimetype?: string | null
  /** Isi pesan yang sedang DIBALAS, kalau pesan ini sebuah reply (null kalau bukan). WhatsApp
   *  menaruhnya di contextInfo, terpisah dari body — tanpa ini Naya cuma menerima kalimat
   *  telanjang seperti "ini sudah selesai" tanpa tahu "ini" merujuk ke apa, padahal pengirimnya
   *  merasa sudah jelas karena dia mengutip. Diteruskan WAHUB sejak commit quoted-reply. */
  quotedBody?: string | null
  quotedMessageId?: string | null
}

interface WahubWebhookPayload {
  sessionId?: string
  message?: WahubIncomingMessage
}

/** Cuma nomor yang cocok dengan User.phoneNumber (sudah dinormalisasi) DAN akunnya sudah disetujui
 *  admin yang bisa dibalas AI. Akun yang masih menunggu persetujuan sengaja diperlakukan sama
 *  seperti nomor tak dikenal: didiamkan — supaya orang yang asal mendaftar tidak bisa memakai
 *  Naya (dan menghabiskan kuota Claude) sebelum disetujui. */
async function findRegisteredSender(rawNumber: string) {
  const normalized = normalizePhoneNumber(rawNumber)

  const candidates = await prisma.user.findMany({
    where: { phoneNumber: { not: null }, approvedAt: { not: null } },
  })
  return candidates.find((u) => normalizePhoneNumber(u.phoneNumber!) === normalized)
}

/** Balasan dari penerima delegasi (mis. asisten direktur) — orang yang TIDAK punya akun di sini.
 *
 *  Tiga jalur, dan dua di antaranya tidak menyentuh Claude sama sekali supaya murah & bisa
 *  diprediksi. Jalur "ngobrol" memakai agen terkurung tanpa tool apapun (lihat
 *  lib/delegation-agent.ts) — penerima tidak boleh bisa menggerakkan data direktur lewat Naya.
 *
 *  Mengembalikan null kalau nomor ini memang bukan siapa-siapa, supaya pemanggilnya bisa
 *  mendiamkannya seperti biasa. */
async function tanganiBalasanDelegasi(
  digits: string,
  teks: string,
  replySession: string,
  /** Kalau diisi, hanya delegasi dari direktur INI yang dipertimbangkan — dipakai saat pesannya
   *  masuk lewat sesi pribadi seseorang, supaya balasan tidak nyasar ke delegasi direktur lain. */
  batasiKeDirekturId?: string
) {
  const semua = await cariDelegasiTerbuka(digits)
  const terbuka = batasiKeDirekturId ? semua.filter((d) => d.userId === batasiKeDirekturId) : semua
  if (terbuka.length === 0) return null

  const maksud = tafsirBalasan(teks)

  if (maksud === "stop") {
    const jumlah = await hentikanUntukNomor(digits)
    await sendWhatsappMessage(digits, "Oke, aku berhenti kirim pesan ya. Maaf sudah mengganggu 🙏", replySession)
    return { handled: true, delegasi: "opted out", jumlah }
  }

  // Kalau satu orang dititipi beberapa pekerjaan sekaligus, "sudah" jadi ambigu — tanya dulu
  // daripada menutup pekerjaan yang salah.
  if (terbuka.length > 1 && maksud !== "ngobrol") {
    const daftar = terbuka.map((d, i) => `${i + 1}. ${d.title}`).join("\n")
    await sendWhatsappMessage(digits, `Yang mana ya maksudnya?\n${daftar}\n\nBalas judulnya aja ya.`, replySession)
    return { handled: true, delegasi: "ambigu", jumlah: terbuka.length }
  }

  const delegasi = terbuka[0]
  await prisma.delegation.update({ where: { id: delegasi.id }, data: { lastReplyAt: new Date() } })

  if (maksud === "selesai") {
    await tandaiSelesai(delegasi.id)
    await sendWhatsappMessage(digits, `Siap, makasih ${delegasi.contactName}! Sudah aku teruskan ke ${sapaanOf(delegasi.user)} ya 🙌`, replySession)
    return { handled: true, delegasi: "selesai" }
  }

  if (maksud === "belum") {
    await sendWhatsappMessage(digits, "Oke, nggak apa-apa. Nanti aku tanya lagi ya 👌", replySession)
    return { handled: true, delegasi: "belum" }
  }

  // Di luar pola: ajak ngobrol, tapi dengan agen yang tidak punya akses ke apapun.
  const hasil = await runDelegationAgent({
    ownerId: delegasi.userId,
    judulPekerjaan: delegasi.title,
    namaPenerima: delegasi.contactName,
    pesanPenerima: teks,
  })

  await sendWhatsappMessage(digits, hasil.balasan, replySession)
  if (hasil.selesai) await tandaiSelesai(delegasi.id)
  if (hasil.perluDiteruskan) {
    await kabariDirektur(
      delegasi,
      `💬 ${sapaanOf(delegasi.user)}, ada kabar dari ${delegasi.contactName} soal "${delegasi.title}":\n${hasil.perluDiteruskan}`
    )
  }
  return { handled: true, delegasi: hasil.selesai ? "selesai lewat obrolan" : "diobrolkan" }
}

export async function handleWhatsappWebhook(payload: WahubWebhookPayload) {
  const message = payload.message
  // Sengaja TIDAK menulis payload mentah: isinya teks chat utuh (dan base64 foto). Dengan lebih
  // dari satu direktur, log server jadi tempat menumpuk isi percakapan orang lain — cukup catat
  // metadata yang dibutuhkan untuk menelusuri masalah.
  console.log("[whatsapp webhook] pesan masuk:", {
    sessionId: payload.sessionId,
    from: message?.from,
    chatId: message?.chatId,
    isGroup: message?.isGroup,
    to: message?.to,
    bodyLength: message?.body?.length ?? 0,
    hasMedia: !!message?.mediaBase64,
  })

  if (!message?.from) {
    console.log("[whatsapp webhook] skip: no message")
    return { skipped: "no message" }
  }

  // Baileys mengirim webhook untuk pesan masuk MAUPUN keluar (termasuk balasan bot sendiri).
  // "to" cuma berisi 'me' kalau pesan ini benar-benar masuk dari orang lain.
  if (message.to !== "me") {
    console.log("[whatsapp webhook] skip: outgoing message, to=", message.to)
    return { skipped: "outgoing message" }
  }
  if (!message.body?.trim()) {
    console.log("[whatsapp webhook] skip: empty body")
    return { skipped: "empty body" }
  }

  // Pesan dari WA Grup ops simple-system — dideteksi lewat "chatId" (JID grup, "...@g.us"),
  // BUKAN "from" (itu sudah di-resolve ke JID pengirimnya sendiri, bukan grupnya — lihat
  // backend-wahub). Sesi WA ini (Director Assistant) yang jadi anggota grupnya, jadi webhook
  // grup itu WAJIB lewat sini dulu. Cukup diteruskan mentah-mentah ke webhook simple-system
  // sendiri (yang sudah bisa jawab piutang/keuangan/dsb lewat agent-nya) — simple-system yang
  // urus balasannya sendiri (dia numpang WAHUB_API_KEY yang sama), jadi Director Assistant/Naya
  // TIDAK ikut memproses pesan ini sama sekali.
  const simpleSystemGroupJid = process.env.SIMPLE_SYSTEM_GROUP_JID
  if (simpleSystemGroupJid && message.chatId === simpleSystemGroupJid) {
    const baseUrl = process.env.SIMPLE_SYSTEM_BASE_URL
    const secret = process.env.SIMPLE_SYSTEM_WEBHOOK_SECRET
    if (!baseUrl || !secret) {
      console.warn("[whatsapp webhook] skip: SIMPLE_SYSTEM_BASE_URL/SIMPLE_SYSTEM_WEBHOOK_SECRET belum di-set, tidak bisa forward pesan grup ops")
      return { skipped: "relay not configured" }
    }
    try {
      await fetch(`${baseUrl}/api/whatsapp/webhook?secret=${secret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error("[whatsapp webhook] gagal forward pesan grup ops ke simple-system:", error)
    }
    return { skipped: "forwarded group message to simple-system" }
  }

  // Naya (Director Assistant) itu asisten PRIBADI 1:1 — bukan buat grup. Kalau chatId di atas
  // tidak cocok grup ops simple-system (termasuk kalau SIMPLE_SYSTEM_GROUP_JID belum di-set sama
  // sekali), pesan dari grup MANAPUN tetap tidak boleh diproses Naya — jangan sampai dia ikut
  // membalas pribadi ke pengirimnya cuma karena pengirimnya kebetulan user terdaftar. Diam saja.
  if (message.isGroup) {
    console.log("[whatsapp webhook] skip: pesan dari grup lain (bukan grup ops simple-system), chatId=", message.chatId)
    return { skipped: "group message not for Naya" }
  }

  // Sesi mana pesan ini masuk: null = nomor Naya bersama (boleh dari direktur manapun),
  // terisi = nomor pribadi milik satu direktur.
  const sessionOwner = await findPrivateSessionOwner(payload.sessionId)

  // Balas lewat sesi yang SAMA dengan tempat pesannya masuk, supaya balasan Naya selalu datang
  // dari nomor yang barusan dia chat — bukan tiba-tiba dari nomor lain. Ditentukan lebih awal
  // karena jalur delegasi (nomor tak terdaftar) juga membalas.
  const replySession = sessionOwner ? outgoingSessionId(sessionOwner) : SHARED_SESSION_ID

  const digits = message.senderNumber || message.from.replace(/@.*$/, "")
  const sender = await findRegisteredSender(digits)

  // Nomor tak terdaftar TAPI sedang dititipi pekerjaan oleh seorang direktur — satu-satunya
  // pengecualian yang boleh dilayani. Lingkupnya sengaja sesempit mungkin: dia cuma bisa
  // menjawab soal pekerjaannya sendiri, tidak bisa menyentuh data direktur apapun.
  if (!sender) {
    const hasil = await tanganiBalasanDelegasi(digits, message.body.trim(), replySession)
    if (hasil) return hasil

    console.log("[whatsapp webhook] skip: nomor tak terdaftar, digits=", digits)
    return { skipped: "unregistered number" }
  }

  console.log("[whatsapp webhook] diproses untuk user:", sender.name, "command:", message.body.trim())

  // Owner di-resolve dari PENGIRIMNYA, bukan direktur global — kalau tidak, pesan WA direktur
  // manapun akan menulis tugas/transaksi ke workspace direktur pertama di database.
  const owner = await getWorkspaceOwnerFor(sender)

  // Kalau pesan ini masuk lewat sesi PRIBADI seorang direktur (dia pakai nomor WhatsApp sendiri,
  // bukan nomor Naya bersama), maka sesi itu cuma melayani workspace-nya. Nomor direktur lain yang
  // kebetulan terdaftar tetap ditolak — kalau tidak, siapapun yang tahu nomor asisten pribadinya
  // bisa memerintah Naya lewat sana, dan balasannya terkirim dari nomor milik orang lain.
  if (sessionOwner && sessionOwner.id !== owner.id) {
    // ...KECUALI kalau orang ini memang sedang ditunggu jawabannya oleh pemilik sesi. Seorang
    // direktur bisa menitipkan pekerjaan ke direktur lain; balasannya masuk lewat sesi si
    // pemberi tugas, dan tanpa pengecualian ini ia hilang tanpa jejak — pengirimnya tidak dapat
    // respons apapun dan delegasinya menggantung selamanya.
    //
    // Tidak ada ambiguitas di sini: Naya milik si pengirim ada di NOMOR LAIN, jadi pesan yang
    // sampai ke sesi ini tidak mungkin ditujukan untuk workspace-nya sendiri.
    const hasil = await tanganiBalasanDelegasi(digits, message.body.trim(), replySession, sessionOwner.id)
    if (hasil) return hasil

    console.log("[whatsapp webhook] skip: pengirim bukan anggota workspace pemilik sesi ini")
    return { skipped: "sender not in this session's workspace" }
  }

  const motivationShortcut = parseMotivationShortcut(message.body.trim())
  if (motivationShortcut) {
    await prisma.motivationMessage.create({
      data: {
        userId: owner.id,
        label: motivationShortcut.label,
        content: motivationShortcut.content,
        source: "whatsapp",
      },
    })

    const confirmation = motivationShortcut.label
      ? `✅ Motivasi baru tersimpan: "${motivationShortcut.label}".`
      : "✅ Motivasi baru tersimpan."
    await sendWhatsappMessage(digits, confirmation, replySession)

    return { handled: true, motivationAdded: true }
  }

  const thread = await prisma.whatsappThread.findUnique({ where: { userId: sender.id } })
  const isFresh = thread && Date.now() - thread.updatedAt.getTime() < THREAD_IDLE_MS
  const history = isFresh ? (thread!.history as unknown as Anthropic.MessageParam[]) : undefined

  // Placeholder dari WAHUB kalau foto dikirim tanpa caption — tidak berguna dikirim apa adanya
  // ke AI, ganti dengan instruksi baca nota yang jelas.
  const bodyTrimmed = message.body.trim()
  const perintahDasar =
    message.mediaBase64 && bodyTrimmed === "[MEDIA Image]"
      ? "Tolong baca foto ini. Kalau ini nota/struk belanja, ekstrak & catat sebagai transaksi (record_transaction) sesuai isinya."
      : bodyTrimmed

  // Pesan yang dikutip disisipkan sebagai konteks, bukan digabung jadi satu kalimat — supaya AI
  // tahu mana ucapan pengguna dan mana kutipannya. Dipotong karena briefing pagi bisa panjang
  // sekali dan yang dibutuhkan cuma bagian yang ditunjuk.
  const kutipan = message.quotedBody?.trim()
  const command = kutipan
    ? `Pengguna membalas pesan ini:\n"""\n${kutipan.slice(0, 900)}\n"""\n\nBalasannya: ${perintahDasar}`
    : perintahDasar

  const { reply, messages } = await runAgent({
    ownerId: owner.id,
    actorId: sender.id,
    command,
    sapaan: sapaanOf(sender),
    assistantInstructions: sender.assistantInstructions,
    history,
    image: message.mediaBase64 ? { base64: message.mediaBase64, mimeType: message.mimetype || "image/jpeg" } : undefined,
  })

  await prisma.whatsappThread.upsert({
    where: { userId: sender.id },
    update: { history: messages as unknown as object },
    create: { userId: sender.id, history: messages as unknown as object },
  })

  await sendWhatsappMessage(digits, reply, replySession)

  return { handled: true, user: sender.name }
}
