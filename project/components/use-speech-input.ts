"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Voice input pakai Web Speech API browser (gratis, jalan di client, tanpa API tambahan),
 *  plus level volume mic real-time (Web Audio API) buat animasi bar naik-turun ala ChatGPT.
 *  Dukungan: Chrome/Edge (desktop & Android) — belum ada di Safari/Firefox. */
export function useSpeechInput(onResult: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [level, setLevel] = useState(0)

  const recognitionRef = useRef<any>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const accumulatedRef = useRef("")

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopMeter = useCallback(() => {
    setIsListening(false)
    setLevel(0)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
  }, [])

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    setIsSupported(true)

    const recognition = new SpeechRecognition()
    recognition.lang = "id-ID"
    // continuous:true supaya tidak otomatis berhenti pas ada jeda sebentar di tengah kalimat —
    // baru berhenti kalau user klik tombol stop sendiri (atau browser benar-benar timeout lama).
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      let finalChunk = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript
      }
      finalChunk = finalChunk.trim()
      if (finalChunk) {
        accumulatedRef.current = accumulatedRef.current ? `${accumulatedRef.current} ${finalChunk}` : finalChunk
      }
    }
    recognition.onend = () => {
      if (accumulatedRef.current) {
        onResultRef.current(accumulatedRef.current)
        accumulatedRef.current = ""
      }
      stopMeter()
    }
    recognition.onerror = () => stopMeter()

    recognitionRef.current = recognition

    return () => stopMeter()
  }, [stopMeter])

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextCtor()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sumSquares = 0
        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] - 128) / 128
          sumSquares += normalized * normalized
        }
        const rms = Math.sqrt(sumSquares / data.length)
        setLevel(Math.min(1, rms * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // Izin mikrofon ditolak/gagal — speech recognition tetap jalan, cuma tanpa animasi bar.
    }
  }, [])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
      stopMeter()
    } else {
      setIsListening(true)
      recognition.start()
      startMeter()
    }
  }, [isListening, startMeter, stopMeter])

  return { isSupported, isListening, level, toggle }
}
