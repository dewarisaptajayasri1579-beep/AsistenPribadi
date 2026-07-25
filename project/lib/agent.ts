import Anthropic from "@anthropic-ai/sdk"

import { jakartaNowIso } from "@/lib/datetime"
import { estimateCostUsd } from "@/lib/pricing"
import { prisma } from "@/lib/prisma"
import { runTool, toolDefinitions } from "@/lib/agent-tools"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = "claude-haiku-4-5"
const MAX_TOOL_ITERATIONS = 6
const MAX_TOKENS = 500

// Statis & tidak pernah berubah antar-request, supaya prompt caching Anthropic bisa "hit".
// Jangan sisipkan apapun yang berubah per-request (jam, tanggal, dll) ke sini.
const STATIC_SYSTEM_PROMPT = `Anda adalah asisten direktur.

Tugas Anda membantu mengelola jadwal, tugas, prioritas,
follow-up, dan briefing harian.

Gunakan tools yang tersedia untuk membaca dan menyimpan data. Jangan pernah mengarang data — selalu ambil lewat tool.

Aturan:
1. Jangan membuat jadwal jika waktu belum jelas. Tanyakan dulu ke pengguna.
2. Tugas klien, pembayaran, dan deadline diberi prioritas tinggi.
3. Jangan menghapus data tanpa persetujuan pengguna eksplisit.
4. Setelah menjalankan tool, jelaskan hasilnya secara singkat dan jelas dalam Bahasa Indonesia (maksimal beberapa kalimat, jangan menjelaskan proses internal).
5. Jika tugas belum selesai melewati deadline, tandai/sebut sebagai terlambat.
6. Saat membuat tugas baru (create_task), kalau pengguna belum menyebutkan tanggal mulai (startDate) ATAU tanggal selesai/deadline (dueDate), WAJIB tanyakan dulu keduanya sebelum memanggil tool — jangan menebak atau membiarkan kosong. Kalau pengguna cuma sebut satu tanggal, tanyakan tanggal yang belum disebut.
7. Tugas yang rentang startDate–dueDate-nya lebih dari 1 hari otomatis diingatkan setiap pagi lewat briefing sampai ditandai selesai — kalau pengguna bilang suatu tugas sudah selesai, langsung tandai done (complete_task/update_task), jangan cuma diakui di teks tanpa mengubah status.
8. Saat membuat follow-up (create_follow_up), JANGAN mengarang/menebak dueDate kalau pengguna bilang belum tahu tanggalnya atau masih menunggu pihak lain — biarkan dueDate kosong. Follow-up tanpa dueDate tetap otomatis muncul di briefing pagi & malam sebagai "menunggu konfirmasi" sampai pengguna kasih tanggal pasti atau menandainya selesai.`

function systemPrompt(assistantInstructions?: string | null): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: STATIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ]
  if (assistantInstructions?.trim()) {
    blocks.push({ type: "text", text: `Instruksi khusus tambahan dari pengguna:\n${assistantInstructions.trim()}` })
  }
  return blocks
}

const MAX_HISTORY_MESSAGES = 16

interface RunAgentParams {
  /** Pemilik data workspace — semua tool menulis/membaca tugas & jadwal di bawah id ini. */
  ownerId: string
  /** User yang sedang chat — dicatat di agent_runs & ai_usage_logs untuk audit/biaya per orang. */
  actorId: string
  command: string
  assistantInstructions?: string | null
  /** Riwayat percakapan sebelumnya (dari respons runAgent panggilan terakhir) — supaya pertanyaan
   *  lanjutan seperti "ya hapus saja" tetap tahu jadwal/tugas mana yang dimaksud. */
  history?: Anthropic.MessageParam[]
}

export async function runAgent({ ownerId, actorId, command, assistantInstructions, history }: RunAgentParams) {
  // Waktu sekarang dikirim lewat pesan user (bukan system prompt) supaya system prompt tetap
  // statis byte-per-byte dan bisa di-cache Anthropic — lihat shared/prompt-caching.md.
  const firstMessage = `Waktu sekarang: ${jakartaNowIso()} (Asia/Jakarta).\n\nPerintah: ${command}`
  const trimmedHistory = (history ?? []).slice(-MAX_HISTORY_MESSAGES)
  const messages: Anthropic.MessageParam[] = [...trimmedHistory, { role: "user", content: firstMessage }]

  let finalText = ""
  const startedAt = Date.now()
  const usageTotals = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }
  let apiCallCount = 0

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(assistantInstructions),
      tools: toolDefinitions,
      messages,
    })
    apiCallCount += 1
    usageTotals.inputTokens += response.usage.input_tokens
    usageTotals.outputTokens += response.usage.output_tokens
    usageTotals.cacheCreationTokens += response.usage.cache_creation_input_tokens ?? 0
    usageTotals.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0

    const toolUses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
    const textBlocks = response.content.filter((block): block is Anthropic.TextBlock => block.type === "text")
    finalText = textBlocks.map((b) => b.text).join("\n")

    messages.push({ role: "assistant", content: response.content })

    if (toolUses.length === 0) break

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const toolUse of toolUses) {
      let resultContent: string
      let status = "success"
      try {
        const result = await runTool(toolUse.name, toolUse.input, { userId: ownerId })
        resultContent = JSON.stringify(result)
      } catch (error) {
        status = "error"
        resultContent = JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
      }

      await prisma.agentRun.create({
        data: {
          userId: actorId,
          command,
          agentAction: toolUse.name,
          result: resultContent,
          status,
        },
      })

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: resultContent,
        is_error: status === "error",
      })
    }

    messages.push({ role: "user", content: toolResults })

    if (response.stop_reason !== "tool_use") break
  }

  await prisma.aiUsageLog.create({
    data: {
      userId: actorId,
      command,
      model: MODEL,
      inputTokens: usageTotals.inputTokens,
      outputTokens: usageTotals.outputTokens,
      cacheCreationTokens: usageTotals.cacheCreationTokens,
      cacheReadTokens: usageTotals.cacheReadTokens,
      apiCallCount,
      estimatedCostUsd: estimateCostUsd(MODEL, usageTotals),
      durationMs: Date.now() - startedAt,
    },
  })

  return { reply: finalText, model: MODEL, messages }
}
