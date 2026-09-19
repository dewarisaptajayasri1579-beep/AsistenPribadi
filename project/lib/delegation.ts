import { prisma } from "@/lib/prisma"
import { sapaanOf } from "@/lib/sapaan"
import { outgoingSessionId } from "@/lib/wa-session"
import { normalizePhoneNumber, sendWhatsappMessage } from "@/lib/wahub"

/** Berhenti mengejar setelah sekian HARI tanpa balasan. Dihitung per hari, bukan per pengingat:
 *  pengingatnya dikirim 2x sehari (08:00 & 15:00 WIB), jadi batas "5 pengingat" cuma akan bertahan
 *  2,5 hari — bukan itu yang dimaksud.
 *
 *  Mengejar orang tanpa batas adalah cara tercepat nomor WhatsApp dilaporkan sebagai spam lalu
 *  diblokir — dan penerimanya tidak pernah mendaftar ke aplikasi ini, jadi dia tidak punya
 *  kewajiban apapun untuk merespons. */
export const MAX_HARI_TANPA_BALASAN = 5

/** Jam pengingat harian (WIB). Dipakai cron; lihat instrumentation.ts. */
export const JAM_PENGINGAT_WIB = [8, 15]

const KATA_SELESAI = ["sudah", "udah", "sdh", "done", "selesai", "beres", "kelar", "oke sudah"]
const KATA_BELUM = ["belum", "blm", "nanti", "besok", "masih proses", "on progress", "lagi dikerjakan"]
const KATA_STOP = ["stop", "berhenti", "jangan kirim", "unsubscribe"]

/** Tafsir balasan penerima. Sengaja deterministik untuk tiga hal yang paling sering & paling
 *  penting (selesai / belum / stop) — tidak perlu memanggil Claude untuk membaca kata "sudah",
 *  dan hasilnya bisa diprediksi. Sisanya "ngobrol", ditangani terpisah. */
export function tafsirBalasan(teks: string): "selesai" | "belum" | "stop" | "ngobrol" {
  const t = teks.toLowerCase().trim()
  if (KATA_STOP.some((k) => t === k || t.startsWith(k))) return "stop"
  if (KATA_SELESAI.some((k) => t === k || t.startsWith(k + " ") || t.startsWith(k + ","))) return "selesai"
  if (KATA_BELUM.some((k) => t === k || t.startsWith(k + " ") || t.startsWith(k + ","))) return "belum"
  return "ngobrol"
}

/** Delegasi terbuka milik sebuah nomor. Dipakai webhook untuk memutuskan apakah pesan dari nomor
 *  TAK TERDAFTAR boleh diproses — hanya boleh kalau nomor itu memang sedang ditunggu jawabannya. */
export async function cariDelegasiTerbuka(rawNumber: string) {
  const nomor = normalizePhoneNumber(rawNumber)
  const kandidat = await prisma.delegation.findMany({
    where: { status: "menunggu", optedOut: false },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  })
  return kandidat.filter((d) => normalizePhoneNumber(d.contactPhone) === nomor)
}

/** Pesan perkenalan. Wajib menyebut siapa pengirimnya, atas permintaan siapa, dan cara berhenti —
 *  penerima tidak pernah mendaftar, jadi tanpa ini pesannya tidak bisa dibedakan dari spam. */
export function pesanPerkenalan(d: { contactName: string; title: string; notes: string | null }, dariSapaan: string) {
  return [
    `Halo ${d.contactName}! Aku Naya, asisten ${dariSapaan}.`,
    ``,
    `${dariSapaan} nitip pekerjaan ini ke kamu:`,
    `📌 ${d.title}`,
    d.notes ? `Catatan: ${d.notes}` : "",
    ``,
    `Nanti aku kabarin pagi & sore buat nanya progresnya ya. Kalau sudah kelar, balas "sudah" aja — langsung aku teruskan ke ${dariSapaan}.`,
    `Kalau nggak mau dikirimi pesan lagi, balas "STOP".`,
  ]
    .filter(Boolean)
    .join("\n")
}

/** Kirim pesan ke penerima delegasi lewat sesi WA milik direktur yang mendelegasikan — supaya
 *  pesannya datang dari nomor yang sama dengan yang dipakai direktur itu, bukan nomor acak. */
export async function kirimKePenerima(
  delegasi: { contactPhone: string; user: { wahubSessionId: string | null } },
  pesan: string
) {
  return sendWhatsappMessage(delegasi.contactPhone, pesan, outgoingSessionId(delegasi.user))
}

export async function kabariDirektur(
  delegasi: { user: { phoneNumber: string | null; wahubSessionId: string | null } },
  pesan: string
) {
  if (!delegasi.user.phoneNumber) return
  return sendWhatsappMessage(delegasi.user.phoneNumber, pesan, outgoingSessionId(delegasi.user))
}

/** Tandai selesai lalu laporkan balik ke direktur — inti dari fitur ini. */
export async function tandaiSelesai(delegasiId: string) {
  const d = await prisma.delegation.update({
    where: { id: delegasiId },
    data: { status: "selesai", completedAt: new Date(), lastReplyAt: new Date() },
    include: { user: true },
  })

  await kabariDirektur(
    d,
    `✅ Kabar baik ${sapaanOf(d.user)}! ${d.contactName} barusan bilang "${d.title}" sudah selesai.`
  )
  return d
}

/** Penerima minta berhenti. Ditandai di SEMUA delegasi terbuka untuk nomor itu, bukan cuma yang
 *  sedang dibalas — orang yang bilang berhenti tidak sedang memilah-milah pekerjaan. */
export async function hentikanUntukNomor(rawNumber: string) {
  const nomor = normalizePhoneNumber(rawNumber)
  const semua = await prisma.delegation.findMany({ where: { optedOut: false }, include: { user: true } })
  const cocok = semua.filter((d) => normalizePhoneNumber(d.contactPhone) === nomor)

  for (const d of cocok) {
    await prisma.delegation.update({ where: { id: d.id }, data: { optedOut: true, lastReplyAt: new Date() } })
    if (d.status === "menunggu") {
      await kabariDirektur(
        d,
        `ℹ️ ${sapaanOf(d.user)}, ${d.contactName} minta berhenti dikirimi pesan. Pekerjaan "${d.title}" nggak akan aku ingatkan lagi — tolong dikoordinasikan langsung ya.`
      )
    }
  }
  return cocok.length
}
