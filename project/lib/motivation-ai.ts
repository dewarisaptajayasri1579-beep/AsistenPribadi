import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = "claude-haiku-4-5"

const SYSTEM_PROMPT = `Kamu membantu merangkai kalimat inti jadi pesan motivasi/prinsip hidup yang enak dibaca, untuk dikirim lewat WhatsApp.

Aturan:
- Bahasa Indonesia, nada hangat & memotivasi, bukan menggurui.
- Pertahankan makna/inti asli dari kalimat pengguna — jangan tambah gagasan baru yang tidak diminta.
- Maksimal 3-4 kalimat pendek. Jangan pakai emoji berlebihan (0-1 saja kalau pas).
- Balas HANYA isi pesannya — tanpa tanda kutip, tanpa penjelasan, tanpa "Berikut adalah...".`

/** Rangkai satu kalimat inti jadi pesan motivasi yang lebih lengkap & enak dibaca. */
export async function expandMotivationMessage(coreSentence: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: coreSentence }],
  })

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text")
  const text = textBlock?.text.trim()
  if (!text) throw new Error("AI tidak menghasilkan teks")

  return text
}
