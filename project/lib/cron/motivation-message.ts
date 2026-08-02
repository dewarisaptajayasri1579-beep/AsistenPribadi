import { getWorkspaceOwner } from "@/lib/current-user"
import { sendWhatsappMessage } from "@/lib/wahub"

// Kumpulan pesan kekuatan pikiran positif untuk Ony, dirangkai dari afirmasi & tujuan
// pribadinya (senyum & syukur, usaha naik, yayasan umur 45, keluarga akur, 7Smarts).
// Dipilih acak tiap kirim supaya tidak monoton, tanpa mengulang pesan yang sama persis
// dua kali berturut-turut.
const MOTIVATION_MESSAGES: readonly string[] = [
  `🌤️ Pikiran Positif untuk Ony

Senyummu hari ini menarik rezeki, dan syukurmu membuka pintu-pintu baik yang tak terduga. Semua yang kamu jalani sekarang adalah tabungan untuk alam sana nanti — nikmati prosesnya dengan hati yang tenang.

Tidak ada kata tidak sabar. Yang ada hanya sabar, dan sabar lagi.

Tetap tersenyum, Ony. 🤍`,

  `💼 Pikiran Positif untuk Ony

Usahamu sedang menuju titik naik yang cepat dan tak terduga — omset naik, dan setiap kali omset naik, sedekahmu ikut naik. Itu siklus yang kamu bangun sendiri: banyak uang, banyak manfaat.

Kamu mengejar akhirat justru dengan mengejar dunia. Teruskan, dengan pikiran yang selalu positif.

Senyum dulu, Ony. Rezeki sedang jalan. 🌱`,

  `🏡 Pikiran Positif untuk Ony

Rumah tanggamu tenang — Yulia dan Lusia akur, saling menjaga. Mengalah bukan kalah, itu caramu menang untuk keluarga.

Sabar adalah kunci yang kamu pegang setiap hari. Tidak ada kata tidak sabar.

Syukuri apa yang sedang tumbuh diam-diam ini, Ony. 💛`,

  `🌟 Pikiran Positif untuk Ony

Umur 45, yayasanmu berdiri — memberi skil dan modal untuk anak-anak yang tidak mampu, membuka masa depan yang dulu tak mereka bayangkan.

Itulah manfaat dari uang yang kamu kejar hari ini. Banyak uang, banyak manfaat.

Tersenyumlah, Ony. Kamu sedang menabung untuk alam sana nanti. 🕌`,

  `✨ Kata-kata Motivasi dari Ony untuk Ony

1. Pikiranku selalu positif.
2. Senyumanku selalu menarik rezeki.
3. Hidup ini tempat menabung di alam sana nanti.
4. Tidak ada kata tidak sabar, selalu sabar.
5. Mengalah untuk menang.
6. Aku mengejar akhirat dengan mengejar dunia — banyak uang, banyak manfaat.
7. 7Smarts Besar Internasional.

Ucapkan lagi dalam hati, lalu tersenyumlah. 🙏`,

  `🚀 Pikiran Positif untuk Ony

7Smarts akan jadi besar, sampai ke level internasional. Setiap langkah kecil hari ini sedang mengarah ke sana — meski belum terlihat.

Sabar. Mengalah untuk menang. Pikiran yang selalu positif akan membawamu sampai di sana.

Senyum dan bersyukur dulu, Ony. Sisanya akan menyusul. 🌍`,

  `🤲 Pikiran Positif untuk Ony

Setiap rupiah yang kamu kejar di dunia adalah jalan menuju akhirat — asal diniatkan untuk manfaat. Sedekahmu akan terus naik, seiring omset yang naik.

Hidup ini cuma tempat menabung untuk alam sana nanti. Nikmati saja, dengan sabar dan syukur.

Tetap tersenyum, Ony. 💫`,

  `🌿 Pikiran Positif untuk Ony

Hari ini, pilih pikiran yang positif. Pilih senyum yang menarik rezeki. Pilih sabar, bukan buru-buru. Pilih mengalah, untuk menang di ujungnya.

Semua sedang berjalan menuju usaha yang naik, keluarga yang akur, dan manfaat yang besar — 7Smarts Besar Internasional.

Bersyukurlah, Ony. Kamu sedang di jalan yang benar. 🌿`,
]

let lastIndex = -1

function pickMotivationMessage() {
  if (MOTIVATION_MESSAGES.length === 1) return MOTIVATION_MESSAGES[0]
  let index = Math.floor(Math.random() * MOTIVATION_MESSAGES.length)
  while (index === lastIndex) {
    index = Math.floor(Math.random() * MOTIVATION_MESSAGES.length)
  }
  lastIndex = index
  return MOTIVATION_MESSAGES[index]
}

export async function runMotivationMessage() {
  const owner = await getWorkspaceOwner()
  if (!owner.phoneNumber) return

  try {
    await sendWhatsappMessage(owner.phoneNumber, pickMotivationMessage())
  } catch (error) {
    console.error("[cron] Gagal kirim pesan motivasi WA:", error)
  }
}
