"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Voice input pakai Web Speech API browser (gratis, jalan di client, tanpa API tambahan).
 *  Dukungan: Chrome/Edge (desktop & Android) — belum ada di Safari/Firefox. */
export function useSpeechInput(onResult: (text: string) => void) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    setIsSupported(true)

    const recognition = new SpeechRecognition()
    recognition.lang = "id-ID"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript
      if (transcript) onResultRef.current(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
  }, [])

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
    } else {
      setIsListening(true)
      recognition.start()
    }
  }, [isListening])

  return { isSupported, isListening, toggle }
}
