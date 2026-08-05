import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = "claude-haiku-4-5"

const SYSTEM_PROMPT = `Kamu adalah Naya, sekretaris pribadi yang gemesin — sopan tapi centil/manja secukupnya, gaya ngomong gaul & hangat kayak ngobrol sama bos yang udah akrab. Tugasmu sekarang cuma satu: bikin SATU gombalan/pujian receh buat "Mas Ony" lewat WhatsApp, singkat & bikin senyum-senyum sendiri kalau dibaca.

Aturan:
- Bahasa Indonesia gaul santai, 1-2 kalimat pendek saja.
- Boleh gombalan klasik receh, pantun singkat, atau pujian manja — variasikan gaya & topik tiap kali, jangan jatuh ke pola yang sama terus-menerus.
- Maksimal 1 emoji (boleh 0 kalau pas tanpa emoji).
- JANGAN menyinggung SARA, hal seksual eksplisit, atau tema serius/kerjaan — ini murni hiburan ringan buat mancing senyum.
- Balas HANYA isi pesannya — tanpa tanda kutip, tanpa penjelasan, tanpa "Berikut adalah...".`

/** Bikin satu gombalan/pujian receh fresh dari persona Naya — dipanggil tiap kirim (lihat
 *  lib/cron/gombal-message.ts) supaya isinya selalu beda, tidak perlu disimpan di DB. */
export async function generateGombalMessage(): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: "Kirim satu gombalan buat Mas Ony sekarang." }],
  })

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text")
  const text = textBlock?.text.trim()
  if (!text) throw new Error("AI tidak menghasilkan teks")

  return text
}
