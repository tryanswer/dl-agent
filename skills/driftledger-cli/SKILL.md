---
name: driftledger-cli
description: Use when an agent needs to operate DriftLedger through shell commands, install the dl CLI, manage workspace context, upload CSV or JSONL data, train rules, build RuleForest, configure alerts, run checks, or inspect incidents.
---

# DriftLedger CLI Workflow

## Bootstrap And Install

Always check whether the CLI exists before using DriftLedger:

```bash
command -v dl >/dev/null || npm install -g @driftledger/cli
dl doctor
```

Use local checkout install only when working inside `dl-agent`:

```bash
npm install
npm install -g ./packages/cli
dl config set --api-url http://localhost:8088
dl doctor
```

Use environment variables when the agent cannot write local config:

```bash
export DRIFTLEDGER_API_URL="https://driftledger.fatclaw.com"
export DRIFTLEDGER_TOKEN="<jwt>"
export DRIFTLEDGER_WORKSPACE_ID="Default"
```

Workspace selection defaults to `Default`. Do not ask the user for a workspace
unless they need a non-default workspace. Use `--workspace <spId>` or
`DRIFTLEDGER_WORKSPACE_ID` only for an explicit override.

## Full Workflow

1. Run the bootstrap block and inspect JSON output.
2. Ensure `DRIFTLEDGER_API_URL` and `DRIFTLEDGER_TOKEN` are set through
   environment variables or `~/.driftledger/config.json`.
3. Use the implicit `Default` workspace unless the user specified another
   workspace. If needed, create it with `dl workspace create --name "Default"`.
4. Generate the project instruction file if needed:
   `dl agent init codex|claude|openclaw|generic --out <file>`.
5. For raw CSV exports, create metadata, data source, source binding, then upload
   the raw dataset.
6. For raw CSV exports, submit and run an assembly task after upload.
7. For already assembled data, create an assembled dataset and upload JSONL.
8. Create or select a reconciliation model.
9. Submit rule training with `dl infer-task submit --body-file ...`, then poll
   `dl infer-task progress`.
10. Add reviewed rules and build the workspace RuleForest with
   `dl rule-forest build`.
11. Configure at least one alert channel with `dl alerts upsert`, then verify it
   with `dl alerts test` before production runs.
12. Submit and run a task, then inspect result indexes, incidents, and alert
    deliveries.

## Minimal Command Path

```bash
command -v dl >/dev/null || npm install -g @driftledger/cli
dl doctor
dl config set --api-url https://driftledger.fatclaw.com
dl auth login --email you@example.com --password "<password>"
dl workspace list
dl dataset create-assembled --display-name merchant-payment-escrow
dl dataset upload-assembled --dataset <datasetId> --file samples/merchant-payment-escrow-reconciliation/datasets/train.jsonl
dl check-model create --body-file examples/body-files/check-model.json
dl infer-task submit --body-file examples/body-files/infer-task.json
dl infer-task progress --task <inferTaskId>
dl rule add --body-file examples/body-files/rule.json
dl rule-forest build
dl alerts upsert --body-file examples/body-files/alert-email-channel.json
dl alerts test --channel <channelId>
dl run submit --body-file examples/body-files/run.json
dl run run --task <taskId>
dl incidents task --task <taskId>
dl alerts deliveries --task <taskId>
```

## Command Contract

- Treat stdout as machine-readable JSON.
- Treat stderr JSON with `ok:false` as recoverable unless the error indicates
  missing auth or backend unavailability.
- Put complex payloads in files and pass them with `--body-file`.
- Never write tokens, cookies, raw accounts, or company datasets into generated
  docs or prompts.
- Never write real alert recipients, webhook URLs, or webhook secrets into
  generated docs or committed examples.
- If installation fails, report the failing install command and stderr instead
  of trying unrelated package names.
- If command output contains IDs needed by later steps, save them in a local note
  or payload file before continuing.
