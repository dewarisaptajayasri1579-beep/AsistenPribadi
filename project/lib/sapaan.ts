/** Cara Naya memanggil seorang direktur di semua pesan (WA, briefing, gombalan, chat AI).
 *
 *  Dulu semua template menuliskan "Mas Ony" langsung di dalam string-nya. Dengan lebih dari satu
 *  direktur, setiap orang jadi disapa dengan nama orang lain — makanya disatukan di sini.
 *
 *  Kalau kolom sapaan belum diisi, jatuh ke nama DEPAN saja: menyapa dengan nama lengkap
 *  ("Halo Budi Santoso!") terdengar kaku seperti surat resmi, bukan seperti Naya. */
export function sapaanOf(user: { sapaan: string | null; name: string }) {
  const custom = user.sapaan?.trim()
  if (custom) return custom

  return user.name.trim().split(/\s+/)[0] || user.name
}
