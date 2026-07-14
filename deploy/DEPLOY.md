# FocusReader — Production Deploy Runbook (single VPS)

Architecture: one small VPS (2GB RAM recommended, ~$5–12/mo: Hetzner CX22,
DigitalOcean, Racknerd) runs frontend + TTS backend + Caddy (auto-HTTPS)
via Docker Compose. SQLite + audio live on a shared volume — this is why
we deploy to a persistent disk, not serverless.

## 0. Prerequisites (owner actions — accounts/money)
- A VPS (Ubuntu 22.04+) and a domain you control
- Clerk **production** instance keys (dashboard.clerk.com → your app → Production)
- Stripe keys + the $19/mo price (see step 3 of the launch plan)
- An ELEVENLABS_API_KEY (free tier works to start) — **required**: the free
  local Mac voice does not exist on Linux

## 1. DNS
Create two A records pointing at the VPS IP:
- `app.<yourdomain>` and `api.<yourdomain>`

## 2. On the VPS
```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/Zhavior/focusreader.git && cd focusreader/deploy
cp env.production.example .env
nano .env          # fill every value; generate INTERNAL_API_SECRET fresh
docker compose up -d --build
```

## 3. Verify (do not skip)
```bash
# TTS engine healthy
curl -s https://api.<domain>/api/tts/health          # {"status":"ok"}

# Metering gate: no secret → 401 (engine is not open to the world)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.<domain>/api/tts/stream \
  -H "Content-Type: application/json" -d '{"text":"hi"}'   # expect 401

# Full voice check WITH the secret (from .env)
curl -s -X POST https://api.<domain>/api/tts/stream \
  -H "Content-Type: application/json" -H "x-internal-secret: $SECRET" \
  -d '{"text":"Production voice check."}' -o /tmp/check.mp3
ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/check.mp3

# Frontend up
curl -s -o /dev/null -w "%{http_code}\n" https://app.<domain>/    # 200
```

## 4. Stripe webhook (production)
Dashboard → Webhooks → Add endpoint:
`https://app.<domain>/api/webhooks/stripe`
Events: `checkout.session.completed`, `invoice.payment_succeeded`,
`customer.subscription.deleted`. Put the signing secret in `.env`
(STRIPE_WEBHOOK_SECRET) and `docker compose up -d` again.

## 5. Point the extension at production
The extension reads its endpoints from storage (defaults are localhost).
Open the extension popup → right-click → Inspect → Console:
```js
chrome.storage.sync.set({
  zhaviorApiBase: "https://app.<domain>",
  zhaviorTtsBase: "https://api.<domain>"
});
```
(Adding popup fields for this is a pre-Store-submission TODO.)

## 6. Backups (do this before real users)
```bash
# Nightly SQLite + audio snapshot; graduate to Litestream→S3 when revenue exists
(crontab -l; echo '0 3 * * * docker compose -f ~/focusreader/deploy/docker-compose.yml \
  exec -T backend sh -c "cp /data/focusreader.db /data/focusreader.db.bak"') | crontab -
```

## Known v1 limits (accepted deliberately)
- Single instance; in-process job queue dies with the container (restarts requeue nothing)
- No monitoring — add UptimeRobot on both /health URLs minimum, Sentry when possible
- SQLite write concurrency is fine at this scale; revisit past ~1k users
