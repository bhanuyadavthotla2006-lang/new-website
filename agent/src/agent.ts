/*
Windows-targeted JARVIS agent prototype.

Flow:
- Uses PvRecorder (pvrecorder-node) to capture microphone PCM frames.
- Uses Porcupine (porcupine-node) for wake-word detection (requires a keyword .ppn file and Picovoice access key).
- When wake-word is detected, it buffers audio frames for RECORD_AFTER_WAKE seconds, writes WAV data, and sends the audio to OpenAI Whisper transcription API.
- Forwards the transcribed text to your existing JARVIS server (/api/chat) and speaks the reply using PowerShell TTS on Windows.

Notes & requirements:
- You must provide a Picovoice access key and a compiled keyword file (.ppn) for the wake-word. Picovoice provides tooling to generate keywords.
- Porcupine and PvRecorder require native binaries that come with the npm packages; ensure you follow Picovoice installation instructions for Windows.
- You must set OPENAI_API_KEY in the agent/.env or root .env if you want to use Whisper. Alternatively, modify the code to POST to your server's /api/voice endpoint.
- This is a prototype and should be run locally only. The agent binds to localhost for any local APIs and stores a local SQLite DB for history.
*/

import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

import { Porcupine } from '@picovoice/porcupine-node'
import { PvRecorder } from '@picovoice/pvrecorder-node'
import fs from 'fs'
import path from 'path'
import { Writable } from 'stream'
import { WaveFile } from 'wav'
import fetch from 'node-fetch'
import FormData from 'form-data'
import { exec } from 'child_process'
import sqlite3 from 'sqlite3'

const PICOVOICE_ACCESS_KEY = process.env.PICOVOICE_ACCESS_KEY || ''
const PORCOVOICE_KEYWORD_PATH = process.env.PORCOVOICE_KEYWORD_PATH || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const JARVIS_SERVER = process.env.JARVIS_SERVER || 'http://localhost:4000'
const RECORD_AFTER_WAKE = Number(process.env.RECORD_AFTER_WAKE) || 6

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set — transcription will fail until you set it in agent/.env')
}

if (!PORCOVOICE_KEYWORD_PATH || !fs.existsSync(PORCOVOICE_KEYWORD_PATH)) {
  console.warn('PORCOVOICE_KEYWORD_PATH not set or file missing. Porcupine wake-word will not be available.');
}

// Simple SQLite for history
const dbFile = path.join(__dirname, '..', 'agent_history.sqlite3')
const db = new sqlite3.Database(dbFile)

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER, type TEXT, content TEXT)`
  )
})

function saveHistory(type: string, content: string) {
  db.run('INSERT INTO history (timestamp, type, content) VALUES (?, ?, ?)', [Date.now(), type, content])
}

async function ttsSpeakWindows(text: string) {
  // Use PowerShell's System.Speech to speak the text. This is a simple approach for Windows.
  const escaped = text.replace(/"/g, '\\"')
  const ps = `Add-Type –AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak(\"${escaped}\")`
  exec(`powershell -Command "${ps}"`, (err, stdout, stderr) => {
    if (err) console.error('TTS error', err)
  })
}

async function transcribeWithOpenAI(wavPath: string) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')

  const form = new FormData()
  form.append('file', fs.createReadStream(wavPath))
  form.append('model', 'whisper-1')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: form as any
  })
  const data = await res.json()
  return data.text
}

async function sendToJarvisServer(text: string) {
  try {
    const res = await fetch(`${JARVIS_SERVER}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
    const json = await res.json()
    return json.reply || json
  } catch (err) {
    console.error('Error contacting JARVIS server', err)
    return 'I had an error contacting the server.'
  }
}

// Helper to write PCM frames to WAV file
function writeWavFromInt16(samples: Int16Array, sampleRate = 16000, outPath: string) {
  // wav npm package provides WaveFile class
  const wav = new WaveFile()
  // Convert Int16Array to Buffer
  const buffer = Buffer.from(samples.buffer)
  wav.fromScratch(1, sampleRate, '16', buffer)
  fs.writeFileSync(outPath, wav.toBuffer())
}

async function runAgent() {
  console.log('Starting JARVIS agent prototype (Windows-targeted)...')

  // Initialize Porcupine if keyword provided
  let porcupine: Porcupine | null = null
  try {
    if (PORCOVOICE_KEYWORD_PATH && PICOVOICE_ACCESS_KEY) {
      const keywordPaths = [PORCOVOICE_KEYWORD_PATH]
      // Sensitivity can be a number between 0 and 1. Use 0.6 default.
      porcupine = new Porcupine(PICOVOICE_ACCESS_KEY, keywordPaths, [0.6])
      console.log('Porcupine initialized with keyword:', PORCOVOICE_KEYWORD_PATH)
    }
  } catch (err) {
    console.warn('Failed to initialize Porcupine:', err)
    porcupine = null
  }

  // Initialize PvRecorder
  let recorder: PvRecorder | null = null
  try {
    recorder = new PvRecorder(-1) // use default device
    console.log('PvRecorder started, frame length:', recorder.getFrameLength())
    recorder.start()
  } catch (err) {
    console.error('Failed to start PvRecorder:', err)
    process.exit(1)
  }

  const frameLength = recorder!.getFrameLength()
  const sampleRate = 16000

  // Buffers for post-wake recording
  let isRecording = false
  let recordSamples: Int16Array[] = []
  let recordingTimeout: NodeJS.Timeout | null = null

  function finishRecordingAndProcess() {
    if (!isRecording) return
    isRecording = false
    if (recordingTimeout) clearTimeout(recordingTimeout)
    // Concatenate samples
    const totalSamples = recordSamples.reduce((sum, a) => sum + a.length, 0)
    const combined = new Int16Array(totalSamples)
    let offset = 0
    for (const arr of recordSamples) {
      combined.set(arr, offset)
      offset += arr.length
    }
    recordSamples = []

    const tmpDir = path.join(__dirname, '..', 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const wavPath = path.join(tmpDir, `capture_${Date.now()}.wav`)
    writeWavFromInt16(combined, sampleRate, wavPath)

    ;(async () => {
      try {
        saveHistory('audio', wavPath)
        const text = await transcribeWithOpenAI(wavPath)
        console.log('Transcribed:', text)
        saveHistory('transcript', text)
        const reply = await sendToJarvisServer(text)
        console.log('Reply:', reply)
        saveHistory('reply', reply)
        await ttsSpeakWindows(String(reply))
      } catch (err) {
        console.error('Error processing recording:', err)
      } finally {
        // Optionally remove the wav file
        // fs.unlinkSync(wavPath)
      }
    })()
  }

  // Main loop: read frames and run porcupine on them
  const recorderReadLoop = async () => {
    while (true) {
      try {
        const pcm = recorder!.read() as Int16Array
        if (porcupine) {
          const keywordIndex = porcupine.process(pcm)
          if (keywordIndex >= 0) {
            console.log('Wake word detected!')
            // start recording for N seconds
            if (!isRecording) {
              isRecording = true
              recordSamples = []
              // start a timeout to finish recording
              recordingTimeout = setTimeout(() => finishRecordingAndProcess(), RECORD_AFTER_WAKE * 1000)
            }
            // append this frame as well
            recordSamples.push(pcm)
            continue
          }
        }

        if (isRecording) {
          // accumulate frames
          recordSamples.push(pcm)
        }

      } catch (err) {
        console.error('Error reading from recorder', err)
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  }

  recorderReadLoop()
}

runAgent().catch((e) => {
  console.error('Agent error', e)
  process.exit(1)
})
