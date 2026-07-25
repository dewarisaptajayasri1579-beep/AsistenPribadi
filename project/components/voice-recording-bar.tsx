"use client"

import { Square } from "lucide-react"

import { Button } from "@/components/ui/button"

const BAR_MULTIPLIERS = [0.4, 0.7, 1, 0.7, 0.4]

interface VoiceRecordingBarProps {
  level: number
  onStop: () => void
  className?: string
}

export function VoiceRecordingBar({ level, onStop, className }: VoiceRecordingBarProps) {
  return (
    <div className={`flex h-10 flex-1 items-center gap-3 rounded-2xl bg-secondary/40 px-3 ${className ?? ""}`}>
      <Button
        type="button"
        size="icon"
        variant="destructive"
        className="size-7 shrink-0 rounded-full"
        onClick={onStop}
        aria-label="Berhenti merekam"
      >
        <Square className="size-3" fill="currentColor" />
      </Button>
      <div className="flex h-6 flex-1 items-center justify-center gap-1">
        {BAR_MULTIPLIERS.map((multiplier, index) => (
          <span
            key={index}
            className="w-1 shrink-0 rounded-full bg-primary transition-[height] duration-100"
            style={{ height: `${4 + level * 20 * multiplier}px` }}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">Mendengarkan…</span>
    </div>
  )
}
