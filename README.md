# FocusReader

**Turn boring PDFs and textbooks into dopamine-optimized audio tracks.**

Text-to-speech built for ADHD brains — the goal isn't *listening*, it's *finishing*:

- 🎧 **Focus tracks** — hyper-realistic speech at your speed (1.0–3.0×) with a brown-noise or binaural bed mixed underneath
- ⏱️ **Time math everywhere** — "≈ 26 min at 1.8×" before you commit; backlog totals in your library
- ✅ **Checkpoints** — spoken "section 2 of 5" markers every ~5 minutes turn passive listening into a chain of small completions
- 📖 **Read-along** — karaoke-style word highlighting synced to the audio; click any word to jump there
- 📄 **PDF / DOCX ingestion**, a persistent track library with resume positions, and MP3 downloads
- 💳 $19/mo for 100k characters (Stripe), 5k-character free trial, transactional credit ledger

## Architecture

```
frontend/   Next.js 15 (App Router) — UI, Clerk auth, Stripe billing,
            credit ledger + job queue (SQLite), track library
backend/    Express — TTS engine: smart chunking, provider abstraction
            (ElevenLabs or free local macOS voice), ffmpeg audio
            processing (tempo + noise beds), internal-secret auth
```

## Quick start

```bash
# Backend (TTS engine)
cd backend && cp .env.example .env && npm install && npm run dev   # :4000

# Frontend
cd frontend && cp .env.local.example .env.local && npm install && npm run dev  # :3001
```

Generate a shared secret and set the same `INTERNAL_API_SECRET` in both env
files. With `TTS_PROVIDER=local` (default in the example) no API keys are
needed on macOS — the built-in voice engine is used. Add an
`ELEVENLABS_API_KEY` and remove that line for production voices.

## Tests

```bash
cd backend && npm test    # chunking, checkpoint script, auth gate
cd frontend && npm test   # credit ledger, job queue, durations, karaoke timing
```
