import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'

// Allowlist-based command execution for safety.
// Map friendly command names to safe actions implemented below.

export type CommandResult = { ok: boolean; message?: string; data?: any }

const appMap: Record<string, string> = {
  chrome: 'start chrome',
  notepad: 'start notepad',
  vscode: 'start code'
}

export async function executeCommand(action: string, args: any): Promise<CommandResult> {
  try {
    action = action.toLowerCase()
    if (action === 'open_url') {
      const url = String(args?.url || '')
      if (!url) return { ok: false, message: 'url missing' }
      // Use start on Windows to open default browser
      exec(`start "" "${url}"`)
      return { ok: true, message: `Opening URL ${url}` }
    }

    if (action === 'open_app') {
      const app = String(args?.app || '').toLowerCase()
      if (!app) return { ok: false, message: 'app missing' }
      const cmd = appMap[app]
      if (!cmd) return { ok: false, message: 'app not allowed' }
      exec(cmd)
      return { ok: true, message: `Opening ${app}` }
    }

    if (action === 'screenshot') {
      // Save screenshot to tmp and return path
      const screenshot = require('screenshot-desktop')
      const tmpDir = path.join(__dirname, '..', 'tmp')
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
      const outPath = path.join(tmpDir, `screenshot_${Date.now()}.jpg`)
      const img = await screenshot({ filename: outPath })
      return { ok: true, message: 'screenshot saved', data: { path: outPath } }
    }

    if (action === 'say') {
      const text = String(args?.text || '')
      if (!text) return { ok: false, message: 'text missing' }
      // Use PowerShell TTS
      const escaped = text.replace(/"/g, '\\"')
      const ps = `Add-Type –AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak(\"${escaped}\")`
      exec(`powershell -Command "${ps}"`)
      return { ok: true, message: 'spoken' }
    }

    return { ok: false, message: 'unknown action' }
  } catch (err: any) {
    return { ok: false, message: String(err?.message || err) }
  }
}
