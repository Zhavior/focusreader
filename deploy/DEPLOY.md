# FocusReader / Hyperfi — Production Deploy & Cloud Orchestration Runbook

Our architecture supports both **Single VPS Docker Compose Orchestration** (recommended for launch & predictable fixed costs ~$5–12/mo) and **Auto-Scaling Google Cloud Run / AWS ECS Fargate** (for high-concurrency burst scaling).

---

## 0. Prerequisites (Owner Actions & Accounts)
- **Domain & SSL**: A domain you control (`hyperfi.ai` or your custom domain).
- **Authentication Keys**: Clerk **Production** instance API keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`).
- **Billing Keys**: Stripe Live Secret Key + Webhook Signing Secret (`STRIPE_WEBHOOK_SECRET`).
- **Neural TTS Provider**: `ELEVENLABS_API_KEY` or `OPEN_SOURCE_TTS_URL`. *(Note: macOS local `say` / `LocalTts` is only for local dev; Linux containers fall back to OpenSource / EdgeTTS if ElevenLabs is unavailable).*

---

## Option A: Single VPS Orchestration (Docker Compose - Recommended for Launch)

### 1. DNS Setup
Create two A records pointing at your VPS public IP:
- `app.<yourdomain>` (Frontend Next.js app)
- `api.<yourdomain>` (Backend TTS streaming engine)

### 2. Launch Stack on VPS
```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/Zhavior/focusreader.git && cd focusreader/deploy
cp env.production.example .env
nano .env          # Fill every value securely; generate INTERNAL_API_SECRET
docker compose up -d --build
```

---

## Option B: Auto-Scaling Cloud Deployment (Google Cloud Run / AWS ECS)

### 1. Build & Push Multi-Stage Hardened Container
Our Docker containers (`backend/Dockerfile` and `deploy/Dockerfile.frontend`) run under least-privilege `USER node` (`uid 1000:1000`) and contain multi-stage native compilation optimizations (`ffmpeg`, `curl`, `better-sqlite3`).

```bash
# Authenticate and configure Google Cloud project
gcloud auth configure-docker
export PROJECT_ID=your-gcp-project-id

# Build and push Backend Container
docker build -t gcr.io/$PROJECT_ID/hyperfi-backend:latest -f backend/Dockerfile ./backend
docker push gcr.io/$PROJECT_ID/hyperfi-backend:latest

# Deploy Backend to Cloud Run (Auto-scales from 1 up to 100+ concurrent instances)
gcloud run deploy hyperfi-backend \
  --image gcr.io/$PROJECT_ID/hyperfi-backend:latest \
  --port 4000 \
  --cpu 2 \
  --memory 1Gi \
  --min-instances 1 \
  --max-instances 100 \
  --set-env-vars NODE_ENV=production,PORT=4000 \
  --set-secrets ELEVENLABS_API_KEY=elevenlabs-key:latest,INTERNAL_API_SECRET=internal-api-secret:latest \
  --allow-unauthenticated \
  --region us-central1
```

---

## 3. Verification Commands (Do Not Skip)

### Verify Deep Health & Readiness Probes (`/health/live` & `/health/ready`)
```bash
# 1. Check Liveness Probe (Instant response checking HTTP event loop & process state)
curl -s https://api.<domain>/health/live
# Expected: {"status":"ok","timestamp":"2026-07-14T..."}

# 2. Check Readiness Probe (Verifies SQLite WAL write locks & audio cache write permissions)
curl -s https://api.<domain>/health/ready
# Expected: {"status":"ready","database":"connected","audioCacheDir":"writable"}
```

### Verify Metered Audio Stream Gate
```bash
# 1. No auth token / secret -> expect 401 Unauthorized (Protected endpoint)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.<domain>/api/tts/stream \
  -H "Content-Type: application/json" -d '{"text":"hi"}'
# Output: 401

# 2. Verified stream check with valid API key or Internal Secret
curl -s -X POST https://api.<domain>/api/tts/stream \
  -H "Content-Type: application/json" -H "x-internal-secret: $SECRET" \
  -d '{"text":"Production voice synthesis test."}' -o /tmp/check.mp3
ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/check.mp3
```

---

## 4. Stripe Production Webhook Configuration
In your Stripe Dashboard -> Webhooks -> Add endpoint (`https://app.<domain>/api/webhooks/stripe`):
- Subscribe to: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`.
- Copy the signing secret (`whsec_...`) into `.env` under `STRIPE_WEBHOOK_SECRET` and restart (`docker compose up -d`).

---

## 5. Automated Database Backups (WAL-Safe Snapshotting)
```bash
# Nightly atomic backup using SQLite online backup / safe copy
(crontab -l; echo '0 3 * * * docker compose -f ~/focusreader/deploy/docker-compose.yml \
  exec -T backend sh -c "cp /data/focusreader.db /data/focusreader.db.bak"') | crontab -
```
