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
5. Jika tugas belum selesai melewati deadline, tandai/sebut sebagai terlambat.`

function systemPrompt(assistantInstructions?: string | null): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: STATIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ]
  if (assistantInstructions?.trim()) {
    blocks.push({ type: "text", text: `Instruksi khusus tambahan dari pengguna:\n${assistantInstructions.trim()}` })
  }
  return blocks
}

export async function runAgent(userId: string, command: string, assistantInstructions?: string | null) {
  // Waktu sekarang dikirim lewat pesan user (bukan system prompt) supaya system prompt tetap
  // statis byte-per-byte dan bisa di-cache Anthropic — lihat shared/prompt-caching.md.
  const firstMessage = `Waktu sekarang: ${jakartaNowIso()} (Asia/Jakarta).\n\nPerintah: ${command}`
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: firstMessage }]

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

    if (toolUses.length === 0) break

    messages.push({ role: "assistant", content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const toolUse of toolUses) {
      let resultContent: string
      let status = "success"
      try {
        const result = await runTool(toolUse.name, toolUse.input, { userId })
        resultContent = JSON.stringify(result)
      } catch (error) {
        status = "error"
        resultContent = JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
      }

      await prisma.agentRun.create({
        data: {
          userId,
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
      userId,
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

  return { reply: finalText, model: MODEL }
}
