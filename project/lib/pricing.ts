// Harga per 1 juta token (USD). Sonnet 5 pakai harga intro sampai 2026-08-31.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
}

const CACHE_WRITE_MULTIPLIER = 1.25 // TTL 5 menit (default)
const CACHE_READ_MULTIPLIER = 0.1

export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export function estimateCostUsd(model: string, usage: UsageTotals) {
  const pricing = PRICING[model] ?? PRICING["claude-haiku-4-5"]
  const inputCost = (usage.inputTokens * pricing.input) / 1_000_000
  const outputCost = (usage.outputTokens * pricing.output) / 1_000_000
  const cacheWriteCost = (usage.cacheCreationTokens * pricing.input * CACHE_WRITE_MULTIPLIER) / 1_000_000
  const cacheReadCost = (usage.cacheReadTokens * pricing.input * CACHE_READ_MULTIPLIER) / 1_000_000
  return inputCost + outputCost + cacheWriteCost + cacheReadCost
}

const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5": "Haiku 4.5",
  "claude-sonnet-5": "Sonnet 5",
}

export function modelLabel(model: string) {
  return MODEL_LABELS[model] ?? model
}

const USD_TO_IDR = 15800

export function usdToIdr(usd: number) {
  return usd * USD_TO_IDR
}

export function formatIdr(usd: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(usdToIdr(usd))
}
