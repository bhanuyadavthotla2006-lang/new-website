import React from 'react'

export default function ChatPanel(){
  return (
    <div className="bg-surface rounded-lg p-4 h-96 flex flex-col">
      <div className="flex-1 overflow-auto mb-2">
        <div className="text-sm opacity-80">Welcome to JARVIS. Say "Hey Jarvis" or press the microphone.</div>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-4 py-2 bg-primary rounded">Microphone</button>
        <input className="flex-1 bg-transparent border border-zinc-800 rounded px-3 py-2" placeholder="Type a command" />
        <button className="px-4 py-2 bg-accent rounded">Send</button>
      </div>
    </div>
  )
}
