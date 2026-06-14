#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-akitaonrails/frank_type:latest}"
PORT="${PORT:-3200}"
HOST="${HOST:-localhost}"
FORCE_SSL="${FORCE_SSL:-false}"
ASSUME_SSL="${ASSUME_SSL:-false}"
SECRET_KEY_BASE="${SECRET_KEY_BASE:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Frank Type." >&2
  exit 1
fi

if [ -z "${SECRET_KEY_BASE}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    SECRET_KEY_BASE="$(openssl rand -hex 64)"
  else
    SECRET_KEY_BASE="development-only-secret-key-base-change-me-development-only-secret-key-base"
  fi
fi

echo "Pulling ${IMAGE}..."
docker pull "${IMAGE}"

echo "Starting Frank Type on http://localhost:${PORT}"
echo "Press Ctrl-C to stop."

exec docker run --rm \
  -p "${PORT}:80" \
  -e RAILS_ENV=production \
  -e "SECRET_KEY_BASE=${SECRET_KEY_BASE}" \
  -e "HOST=${HOST}" \
  -e "FORCE_SSL=${FORCE_SSL}" \
  -e "ASSUME_SSL=${ASSUME_SSL}" \
  "${IMAGE}"
