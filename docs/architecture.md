# Architecture

`dl-agent` is the agent-facing distribution layer for DriftLedger.

## Packages

- `packages/cli`: the npm CLI package published as `@driftledger/cli`.
- `scripts/install.sh`: the hosted install script used by `https://driftledger.fatclaw.com/install.sh`.
- `agents/`: reusable instruction contracts for Codex, Claude Code, OpenClaw, and generic shell agents.
- `examples/`: small payload files agents can copy, edit, and pass through `--body-file`.
- `samples/`: synthetic demo model and dataset assets for public tutorials.
- `skills/`: Codex/Claude/OpenClaw workflow guidance for CLI and incident review.

## Command Contract

The CLI keeps a stable shell contract for agents:

- Commands return JSON on stdout.
- Errors are structured JSON on stderr.
- Authentication uses local config or environment variables.
- Complex request bodies are stored in files instead of prompts.
- Alert recipients, webhook URLs, and webhook secrets stay in environment-managed
  payload files and are never committed as real values.

`dl` is the preferred short command. `driftledger` remains the long-form alias for published docs and compatibility.
