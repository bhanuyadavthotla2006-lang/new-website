# Windows agent - install & run

This agent runs on Windows, listens for a wake word (Porcupine), records audio after wake, transcribes (via OpenAI Whisper by default), sends text to the JARVIS server, and performs local commands on your machine.

1. Prereqs
- Node 18+ installed
- A Porcupine keyword file (.ppn) and Picovoice access key (or skip wake-word and use manual triggers)
- An OpenAI API key if using cloud transcription

2. Install & configure
cd agent
npm install
cp .env.example .env
Edit agent/.env and set PICOVOICE_ACCESS_KEY, PORCOVOICE_KEYWORD_PATH, OPENAI_API_KEY, JARVIS_SERVER, AGENT_TOKEN

3. Run
npm run start

4. Register at login (optional)
Run the PowerShell script to register the agent as a scheduled task that runs on user logon:
- Open PowerShell as Administrator and run: .\windows\register-service.ps1

Security
- The local HTTP server binds to 127.0.0.1 and is protected by AGENT_TOKEN. Keep the token secret.

Notes
- For full offline capability, we can replace OpenAI Whisper with whisper.cpp later.
