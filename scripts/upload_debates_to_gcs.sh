#!/usr/bin/env bash
set -e

# Upload debates and chunked JSONL to GCS bucket for Vertex AI Search and RAG
BUCKET_NAME="topos-data-elix-498805"
PROJECT_ID="elix-498805"

echo "=== Topos GCS Sync Script ==="
echo "Target Bucket: gs://${BUCKET_NAME}/debates/"

# Ensure chunking is up to date
python3 "$(dirname "$0")/prepare_gcs_and_chunks.py"

echo "Uploading sports_station markdown debates..."
gcloud storage cp -r "$(dirname "$0")/../data/debates/sports_station" "gs://${BUCKET_NAME}/debates/"

echo "Uploading sports_station chunked JSONL..."
gcloud storage cp "$(dirname "$0")/../data/debates/sports_station_chunks.jsonl" "gs://${BUCKET_NAME}/debates/"

echo "Successfully synchronized sports_station to gs://${BUCKET_NAME}/debates/!"
