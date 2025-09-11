#!/usr/bin/env bash
set -euo pipefail

# Portable wrapper for Docker Compose v2 ("docker compose") or legacy v1 ("docker-compose").

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  # Use Compose V2 plugin
  exec docker compose "$@"
elif command -v docker-compose >/dev/null 2>&1; then
  # Fallback to legacy docker-compose
  exec docker-compose "$@"
else
  echo "Error: Neither 'docker compose' nor 'docker-compose' is available on this system." >&2
  echo "Install Docker Engine + Compose plugin, or install docker-compose v1." >&2
  exit 127
fi
