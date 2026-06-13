# Architecture

`dl-agent` is the agent-facing distribution layer for DriftLedger.

## Packages

- `packages/cli`: the CLI package installed by the hosted installer or from a local checkout.
- `scripts/install.sh`: the hosted install script used by `https://driftledger-global.fatclaw.com/install.sh`.
- `agents/`: reusable instruction contracts for Codex, Claude Code, OpenClaw, and generic shell agents.
- `examples/`: small payload files agents can copy, edit, and pass through `--body-file`.
- `samples/`: synthetic demo model and dataset assets for public tutorials.
- `docs/pipeline.md`: command order, branch points, and ID handoff.
- `docs/input-data.md`: accepted assembled JSONL, raw CSV, body-file, and rule inputs.
- `skills/`: Codex/Claude/OpenClaw workflow guidance for CLI and incident review.

## Command Contract

The CLI keeps a stable shell contract for agents:

- Commands return JSON on stdout.
- Errors are structured JSON on stderr.
- Authentication uses local config or environment variables.
- Complex request bodies are stored in files instead of prompts.
- Alert recipients, webhook URLs, and webhook secrets stay in environment-managed
  payload files and are never committed as real values.

`dl` is the canonical command for published docs, generated agent instructions,
and examples. `driftledger` remains a compatibility alias for older installs.
