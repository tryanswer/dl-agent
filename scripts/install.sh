#!/usr/bin/env bash
set -euo pipefail

DEFAULT_API_URL="${DRIFTLEDGER_API_URL:-https://driftledger.fatclaw.com}"
ARCHIVE_URL="${DRIFTLEDGER_AGENT_ARCHIVE_URL:-https://github.com/tryanswer/dl-agent/archive/refs/heads/main.tar.gz}"

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

if [ -z "${DRIFTLEDGER_CLI_PACKAGE:-}" ]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required before installing DriftLedger Agent." >&2
    exit 1
  fi
  if ! command -v tar >/dev/null 2>&1; then
    echo "tar is required before installing DriftLedger Agent." >&2
    exit 1
  fi
fi

if [ -n "${DRIFTLEDGER_CLI_PACKAGE:-}" ]; then
  npm install -g "${DRIFTLEDGER_CLI_PACKAGE}"
else
  TMP_DIR="$(mktemp -d)"
  cleanup() {
    rm -rf "${TMP_DIR}"
  }
  trap cleanup EXIT

  curl -fsSL "${ARCHIVE_URL}" -o "${TMP_DIR}/dl-agent.tar.gz"
  mkdir -p "${TMP_DIR}/src"
  tar -xzf "${TMP_DIR}/dl-agent.tar.gz" -C "${TMP_DIR}/src" --strip-components=1
  TARBALL="$(cd "${TMP_DIR}/src/packages/cli" && npm pack --silent --pack-destination "${TMP_DIR}")"
  npm install -g "${TMP_DIR}/${TARBALL}"
fi

echo "DriftLedger Agent installed."
echo "Next:"
echo "  dl config set --api-url ${DEFAULT_API_URL}"
echo "  dl auth login --email <email> --password <password>"
echo "  dl agent init codex --out AGENTS.md"
