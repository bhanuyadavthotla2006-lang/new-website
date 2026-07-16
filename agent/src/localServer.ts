import express from 'express'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import { executeCommand } from './commands'

dotenv.config({ path: './.env' })

const AGENT_PORT = Number(process.env.AGENT_PORT) || 41234
const AGENT_TOKEN = process.env.AGENT_TOKEN || ''

export function startLocalServer() {
  const app = express()
  app.use(bodyParser.json())

  // simple token auth middleware
  app.use((req, res, next) => {
    const token = req.headers['x-agent-token'] || req.query.token
    if (!AGENT_TOKEN) return res.status(500).json({ error: 'AGENT_TOKEN not configured' })
    if (!token || token !== AGENT_TOKEN) return res.status(401).json({ error: 'unauthorized' })
    next()
  })

  app.get('/status', (req, res) => {
    res.json({ status: 'ok', platform: 'windows' })
  })

  app.post('/command', async (req, res) => {
    const { action, args } = req.body
    if (!action) return res.status(400).json({ error: 'action required' })
    const result = await executeCommand(action, args)
    res.json(result)
  })

  app.listen(AGENT_PORT, '127.0.0.1', () => {
    console.log(`Agent local server listening on http://127.0.0.1:${AGENT_PORT}`)
  })
}
