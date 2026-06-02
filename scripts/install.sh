#!/usr/bin/env bash
set -euo pipefail

PACKAGE="${DRIFTLEDGER_CLI_PACKAGE:-@driftledger/cli}"
DEFAULT_API_URL="${DRIFTLEDGER_API_URL:-https://driftledger.fatclaw.com}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required before installing DriftLedger Agent." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "Node.js 20+ is required. Current version: $(node -v)" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required before installing DriftLedger Agent." >&2
  exit 1
fi

npm install -g "${PACKAGE}"

echo "DriftLedger Agent installed."
echo "Next:"
echo "  dl config set --api-url ${DEFAULT_API_URL}"
echo "  dl auth login --email <email> --password <password>"
echo "  dl agent init codex --out AGENTS.md"
