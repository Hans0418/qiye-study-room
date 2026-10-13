#!/bin/zsh
set -eu
set -o pipefail
cd "$(dirname "$0")"
NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then
  NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$NODE" ]]; then
  printf 'Node.js is unavailable. Please install Node.js 22 or newer.\n'
  exit 1
fi
"$NODE" --env-file=.env agent-eval.mjs | tee agent-eval-results.log
