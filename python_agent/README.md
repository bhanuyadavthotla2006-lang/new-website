# Python Jarvis Agent

This is a self-contained Python implementation of a Jarvis-style voice agent. It listens on the system microphone for a wake word (default: "hey jarvis"), captures a short command, executes safe, allow-listed actions (open URL, open app, say text), or forwards the command to OpenAI (if you provide OPENAI_API_KEY) for a conversational reply. Replies are spoken aloud via the platform TTS engine (pyttsx3).

Features
- Background speech listener using SpeechRecognition + microphone
- Optional transcription via OpenAI Whisper (upload) or Google Speech (fallback)
- Local Flask control API (127.0.0.1) with token auth
- Allowlist-based native actions (open_url, open_app, say)
- Offline TTS via pyttsx3

Limitations
- This prototype uses a simple keyword match for the wake word. For robust wake-word detection consider using Picovoice Porcupine or similar.
- Requires platform audio input drivers and Python dependencies such as PyAudio (installation on Windows may require extra steps).

Quickstart (Windows)
1. Open the project in VS Code (File → Open Folder → select python_agent/)
2. Create a Python virtual environment and activate it:
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1   # PowerShell
3. Install dependencies:
   pip install -r requirements.txt
   # On Windows, if pyaudio fails: pip install pipwin; pipwin install pyaudio
4. Copy the env example and edit:
   cp .env.example .env
   Set OPENAI_API_KEY if you want cloud transcription/AI replies. Set AGENT_TOKEN for the local HTTP API.
5. Run Jarvis:
   python jarvis.py

VS Code
- A .vscode/launch.json is included. Open the folder in VS Code and press F5 to run the agent under the Python debugger (select the "Python: Run Jarvis" config).

Usage
- Say "hey jarvis" followed by a command (or say "hey jarvis" then wait for the prompt and speak the command).
- Sample commands:
  - "Hey Jarvis, open https://example.com"
  - "Hey Jarvis, open notepad"
  - "Hey Jarvis, say hello"

Control API
- Start/stop or send commands via HTTP (127.0.0.1 only):
  - GET /status (header x-agent-token)
  - POST /command { action: "say" | "open_url" | "open_app", args: { ... } } (header x-agent-token)

Security
- The local HTTP API requires AGENT_TOKEN (set in .env). Keep the token secret.
- The agent runs local actions using an allowlist — it does not execute arbitrary shell commands.

Next steps
- Add Porcupine wake-word integration for lower-latency, robust wake detection.
- Replace cloud transcription with whisper.cpp for offline transcription.
- Add a UI front-end or websocket bridge to the existing web client.
