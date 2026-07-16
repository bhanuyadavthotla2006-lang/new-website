import { useEffect, useRef, useState, useCallback } from 'react'

type UseVoiceReturn = {
  listening: boolean
  transcript: string
  toggleListening: () => void
  startListening: () => void
  stopListening: () => void
}

// Hook that manages the Web Speech API (SpeechRecognition).
// Exposes start/stop/toggle and the latest transcript. It also supports a callback
// for each final transcript chunk.
export default function useVoice(onFinalTranscript?: (text: string) => void): UseVoiceReturn {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  const createRecognition = useCallback(() => {
    const win = window as any
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      // update transcript with best available (final preferred)
      setTranscript((prev) => (final ? (prev + ' ' + final).trim() : interim))

      if (final) {
        if (onFinalTranscript) onFinalTranscript(final.trim())
      }
    }

    recognition.onerror = (e: any) => {
      // console.warn('SpeechRecognition error', e)
    }

    recognition.onend = () => {
      // When the recognition ends (maybe due to silence or browser), reflect state
      setListening(false)
    }

    return recognition
  }, [onFinalTranscript])

  const startListening = useCallback(() => {
    if (listening) return
    const existing = recognitionRef.current || createRecognition()
    if (!existing) return
    recognitionRef.current = existing
    try {
      existing.start()
      setListening(true)
    } catch (e) {
      // start may throw if already started; ignore
      setListening(true)
    }
  }, [createRecognition, listening])

  const stopListening = useCallback(() => {
    const r = recognitionRef.current
    if (r) {
      try {
        r.stop()
      } catch (e) {
        // ignore
      }
    }
    setListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (listening) stopListening()
    else startListening()
  }, [listening, startListening, stopListening])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      const r = recognitionRef.current
      if (r) {
        try {
          r.onresult = null
          r.onend = null
          r.onerror = null
          r.stop()
        } catch (e) {}
      }
    }
  }, [])

  return { listening, transcript, toggleListening, startListening, stopListening }
}
