# JARVIS AI - Initial Scaffold

This repository contains an initial scaffold for the JARVIS desktop/web assistant project.

This commit creates a monorepo-like layout with a React + TypeScript client (Vite + Tailwind) and an Express + TypeScript server.

This is a scaffold only — endpoints and UI components are placeholders with comments explaining where to implement features (wake word, speech-to-text, text-to-speech, desktop automation).

Next steps (what I did):
- Created a feature branch `feature/jarvis-scaffold` and added initial files for client, server, shared, and docs.
- Implemented minimal API routes and placeholder UI components so you can run the scaffold locally.

How to run:
1. In two terminals:
   - cd client && npm install && npm run dev
   - cd server && npm install && npm run dev

Or run the commands in sequence.

Environment:
- Copy `.env.example` to `.env` and add your API keys.

Notes:
- Desktop automation and native integrations are platform-specific. The scaffold includes placeholders and recommended packages.
- If you'd like, I can proceed to implement full features (voice, AI provider integration, native agents) incrementally — tell me which OS to prioritise.
