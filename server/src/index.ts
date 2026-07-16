import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000

// Basic health
app.get('/api/system', (req, res) => {
  // Return basic system info; replace with real monitoring
  res.json({ status: 'ok', uptime: process.uptime() })
})

// Chat endpoint - placeholder
app.post('/api/chat', async (req, res) => {
  const { message } = req.body
  // TODO: integrate with GPT/Gemini provider
  res.json({ reply: `You said: ${message}` })
})

// Voice endpoint - placeholder for TTS/STT proxy
app.post('/api/voice', (req, res) => {
  res.status(501).json({ error: 'Not implemented' })
})

// Open app - attempts to open common apps (cross-platform)
app.post('/api/open-app', (req, res) => {
  const { appName } = req.body
  // For safety this is a scaffold - be careful exposing arbitrary commands.
  // Use the `open` package to open files/urls and platform-specific commands for native apps.
  res.json({ opened: appName })
})

// Search - proxy to a search engine or provider
app.get('/api/search', (req, res) => {
  const q = req.query.q
  res.json({ results: [], query: q })
})

// Reminders - simple in-memory placeholder
const reminders: any[] = []
app.post('/api/reminder', (req, res) => {
  const { text, time } = req.body
  reminders.push({ text, time })
  res.json({ ok: true })
})

// Weather - placeholder
app.get('/api/weather', (req, res) => {
  res.json({ location: 'Unknown', weather: 'Not implemented' })
})

app.listen(PORT, () => {
  console.log(`JARVIS server running on port ${PORT}`)
})
