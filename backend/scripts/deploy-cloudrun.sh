#!/usr/bin/env bash
# Hyperfi TTS Backend - Automated Google Cloud Run Deployment Script
# Usage: ./scripts/deploy-cloudrun.sh <PROJECT_ID> <REGION>

set -e

PROJECT_ID=${1:-$(gcloud config get-value project 2>/dev/null)}
REGION=${2:-"us-central1"}
SERVICE_NAME="hyperfi-tts-engine"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID not provided and no default gcloud project configured."
  echo "Usage: ./scripts/deploy-cloudrun.sh <PROJECT_ID> [REGION]"
  exit 1
fi

echo "=========================================================================="
echo " Deploying Hyperfi TTS Backend to Google Cloud Run"
echo " Project ID:  $PROJECT_ID"
echo " Region:      $REGION"
echo " Service:     $SERVICE_NAME"
echo "=========================================================================="

# Build and push Docker image via Cloud Build
echo "Building container image using Google Cloud Build..."
gcloud builds submit --project "$PROJECT_ID" --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest" .

# Deploy container image to Cloud Run with auto-scaling (1 to 100 instances)
echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "gcr.io/$PROJECT_ID/$SERVICE_NAME:latest" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 100 \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 80 \
  --port 4000 \
  --set-env-vars="NODE_ENV=production,TTS_PROVIDER=edge"

echo "=========================================================================="
echo " Deployment Complete! Service URL:"
gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)'
echo "=========================================================================="
