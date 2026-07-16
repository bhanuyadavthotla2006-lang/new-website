import React, { useCallback, useEffect, useState } from 'react'
import useVoice from '../hooks/useVoice'
import { chat } from '../services/api'

export default function ChatPanel(){
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [awaitingCommand, setAwaitingCommand] = useState(false)

  // Called whenever the voice hook emits a final transcript chunk
  const onFinalTranscript = useCallback(async (text: string) => {
    if (!text) return
    const normalized = text.toLowerCase()

    if (!awaitingCommand) {
      // Detect wake word "hey jarvis"
      if (normalized.includes('hey jarvis')) {
        // If there's more after the wake word, treat that as the command
        const after = normalized.replace(/hey jarvis/g, '').trim()
        if (after) {
          await handleCommand(after)
        } else {
          // Wait for next phrase to be the command
          setAwaitingCommand(true)
          // Give a small audible/visual cue via TTS
          speakText('Yes?')
        }
      }
    } else {
      // We were awaiting a command after wake word
      setAwaitingCommand(false)
      await handleCommand(text)
    }
  }, [awaitingCommand])

  const { listening, toggleListening, startListening } = useVoice(onFinalTranscript)

  useEffect(() => {
    // As per browser policy, user interaction is required to start recognition.
    // If we are already listening, do nothing. If user toggles microphone on, start.
  }, [listening])

  async function handleCommand(command: string) {
    const trimmed = command.trim()
    if (!trimmed) return
    // display user message
    setMessages((m) => [...m, { role: 'user', text: trimmed }])
    setProcessing(true)
    try {
      const res = await chat(trimmed)
      const reply = (res && res.reply) || 'Sorry, I had no response.'
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
      speakText(reply)
    } catch (err) {
      const errMsg = 'Error processing command.'
      setMessages((m) => [...m, { role: 'assistant', text: errMsg }])
      speakText(errMsg)
    } finally {
      setProcessing(false)
    }
  }

  function speakText(text: string) {
    if (!('speechSynthesis' in window)) return
    const utter = new SpeechSynthesisUtterance(text)
    // choose a default voice if available
    const voices = window.speechSynthesis.getVoices()
    if (voices && voices.length) utter.voice = voices[0]
    utter.rate = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  async function onSend() {
    if (!input.trim()) return
    await handleCommand(input)
    setInput('')
  }

  return (
    <div className="bg-surface rounded-lg p-4 h-96 flex flex-col">
      <div className="flex-1 overflow-auto mb-2 space-y-2 p-2">
        {messages.length === 0 && (
          <div className="text-sm opacity-80">Welcome to JARVIS. Say "Hey Jarvis" or press the microphone.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block px-3 py-2 rounded ${m.role === 'user' ? 'bg-primary/20' : 'bg-zinc-800'}`}>{m.text}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            // Ensure recognition is started within a user gesture - browsers require this
            toggleListening()
            if (!listening) startListening()
          }}
          className={`px-4 py-2 rounded flex items-center gap-2 ${listening ? 'bg-success/80' : 'bg-primary'}`}
          aria-pressed={listening}
        >
          <span className={`w-3 h-3 rounded-full ${listening ? 'bg-green-400 animate-pulse' : 'bg-white'}`}></span>
          {listening ? 'Listening...' : 'Microphone'}
        </button>

        <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-transparent border border-zinc-800 rounded px-3 py-2" placeholder="Type a command" />
        <button onClick={onSend} className="px-4 py-2 bg-accent rounded">Send</button>
      </div>

      <div className="text-xs text-zinc-400 mt-2 flex items-center justify-between">
        <div>{processing ? 'Processing...' : awaitingCommand ? 'Awaiting command after wake word' : 'Idle'}</div>
        <div>Wake word: "Hey Jarvis"</div>
      </div>
    </div>
  )
}
