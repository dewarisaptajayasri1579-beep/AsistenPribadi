import Anthropic from "@anthropic-ai/sdk"

import { estimateCostUsd } from "@/lib/pricing"
import { prisma } from "@/lib/prisma"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = "claude-haiku-4-5"
const MAX_TOKENS = 400

/** Naya versi TERKURUNG, untuk meladeni penerima delegasi (mis. asisten direktur).
 *
 *  Kenapa agen terpisah, bukan runAgent biasa: penerima delegasi bukan pengguna aplikasi ini dan
 *  tidak boleh menggerakkan apapun milik direktur. runAgent membawa 27 tool yang bisa membuat
 *  jadwal, mencatat transaksi, membaca seluruh tugas — kalau dipakai di sini, siapapun yang tahu
 *  nomor si penerima bisa menyuruh Naya lewat dia. Agen ini TIDAK PUNYA TOOL SAMA SEKALI, dan
 *  satu-satunya konteks yang ia tahu adalah judul pekerjaan yang didelegasikan.
 *
 *  Keluarannya dipaksa berbentuk JSON dengan dua bagian: balasan untuk si penerima, dan penilaian
 *  apakah pekerjaannya terdengar sudah selesai. Penilaian itu yang dipakai pemanggilnya untuk
 *  memutuskan tindakan — modelnya sendiri tidak bisa mengubah data apapun. */
const SYSTEM_PROMPT = `Kamu Naya, asisten yang sedang menindaklanjuti SATU pekerjaan yang dititipkan seorang direktur kepada lawan bicaramu. Gaya bicaramu ramah, santai, sopan, dan singkat — lawan bicaramu bukan bosmu, tapi rekan yang sedang dimintai tolong, jadi jangan menekan atau menggurui.

BATASAN KERAS:
- Kamu TIDAK punya akses ke jadwal, tugas, keuangan, atau data apapun milik direktur. Kalau ditanya soal itu, bilang terus terang kamu tidak bisa melihatnya dan sarankan menghubungi direkturnya langsung.
- Kamu hanya boleh membahas pekerjaan yang tertulis di konteks. Kalau diajak membahas hal lain, arahkan kembali dengan sopan.
- Jangan pernah mengarang janji atas nama direktur (mis. soal bayaran, tenggat baru, atau keputusan).
- Kalau lawan bicara menyampaikan kendala, pertanyaan, atau permintaan yang harus diputuskan direktur, JANGAN dijawab sendiri — katakan akan kamu teruskan.

Jawab HANYA dengan JSON valid, tanpa penjelasan lain, berbentuk:
{"balasan": "<yang kamu kirim ke lawan bicara, 1-2 kalimat>", "selesai": <true kalau dia jelas menyatakan pekerjaannya sudah rampung, selain itu false>, "perluDiteruskan": "<ringkasan 1 kalimat untuk direktur kalau ada kendala/pertanyaan yang perlu keputusannya, kosongkan kalau tidak ada>"}`

export interface HasilDelegasiAgent {
  balasan: string
  selesai: boolean
  perluDiteruskan: string
}

export async function runDelegationAgent(params: {
  /** Dicatat ke ai_usage_logs atas nama DIREKTUR — dia yang memicu percakapan ini, dan dia yang
   *  menanggung biayanya. Penerima delegasi tidak punya akun untuk dibebani. */
  ownerId: string
  judulPekerjaan: string
  namaPenerima: string
  pesanPenerima: string
}): Promise<HasilDelegasiAgent> {
  const startedAt = Date.now()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: [
      {
        role: "user",
        content: `Pekerjaan yang dititipkan: "${params.judulPekerjaan}"\nNama lawan bicara: ${params.namaPenerima}\n\nDia baru saja membalas:\n${params.pesanPenerima}`,
      },
    ],
  })

  await prisma.aiUsageLog.create({
    data: {
      userId: params.ownerId,
      command: `[delegasi] ${params.namaPenerima}: ${params.pesanPenerima.slice(0, 120)}`,
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      apiCallCount: 1,
      estimatedCostUsd: estimateCostUsd(MODEL, {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      }),
      durationMs: Date.now() - startedAt,
    },
  })

  const teks = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? ""

  // Model kadang membungkus JSON dengan ```json — ambil objek pertama yang terlihat. Kalau tetap
  // gagal diurai, jangan lempar error: lebih baik balasan netral daripada penerima didiamkan.
  try {
    const json = JSON.parse(teks.slice(teks.indexOf("{"), teks.lastIndexOf("}") + 1))
    return {
      balasan: typeof json.balasan === "string" && json.balasan.trim() ? json.balasan.trim() : teks.trim(),
      selesai: json.selesai === true,
      perluDiteruskan: typeof json.perluDiteruskan === "string" ? json.perluDiteruskan.trim() : "",
    }
  } catch {
    return { balasan: "Oke, aku catat ya. Makasih kabarnya!", selesai: false, perluDiteruskan: params.pesanPenerima }
  }
}
