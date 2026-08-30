#!/bin/bash
set -euo pipefail

# Install workspace dependencies for Claude Code on the web sessions only.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# pnpm monorepo (workspace:* deps). Plain install is idempotent and reuses the
# container's cached store on subsequent runs.
pnpm install --prefer-offline
