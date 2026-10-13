#!/bin/zsh
set -eu
cd "$(dirname "$0")"
NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$NODE" ]]; then
  printf 'Node.js is unavailable. Please install Node.js 22 or newer.\n'
  exit 1
fi
export PORT="${PORT:-8769}"
printf 'Keep this terminal open. Open http://127.0.0.1:%s/ after the Inook message appears.\n' "$PORT"
exec "$NODE" --env-file=.env server.mjs
