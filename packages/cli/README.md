# DriftLedger Agent CLI

Agent-friendly command line access to DriftLedger.

## Install

```bash
command -v dl >/dev/null || npm install -g @driftledger/cli
dl doctor
dl config set --api-url https://driftledger.fatclaw.com
dl auth login --email you@example.com --password '<password>'
```

Manual npm install:

```bash
npm install -g @driftledger/cli
dl config set --api-url https://driftledger.fatclaw.com
dl auth login --email you@example.com --password '<password>'
```

For local development from this repository:

```bash
npm install -g ./packages/cli
dl doctor
```

## Demo Assets

The npm package does not bundle sample data. Download the public synthetic
merchant-payment-escrow scenario with the CLI:

```bash
dl demo pull
# Default root:
# ~/.driftledger/samples/merchant-payment-escrow-reconciliation

# Optional project-local copy:
dl demo pull --out ./driftledger-demo
```

`dl demo pull` prints JSON with `root`, file statuses, and upload command
templates. Use `--force` to refresh existing files, and `--source-base <url>` or
`DRIFTLEDGER_DEMO_BASE_URL` when an agent needs a mirror.

## Agent Setup

Generate a short instruction block for the agent you use:

```bash
dl agent init codex --out AGENTS.md
dl agent init claude --out CLAUDE.md
dl agent init openclaw --out OPENCLAW.md
dl agent init generic
```

Hosted or sandboxed agents can avoid local config files by using environment
variables:

```bash
export DRIFTLEDGER_API_URL="https://driftledger.fatclaw.com"
export DRIFTLEDGER_TOKEN="<jwt>"
export DRIFTLEDGER_WORKSPACE_ID="Default"
```

Workspace defaults to `Default` when `--workspace`, `DRIFTLEDGER_WORKSPACE_ID`,
and local config are all omitted. Pass `--workspace <spId>` only when you need a
non-default workspace.

## Use After Install

Follow this sequence for a complete MVP run:

1. Verify runtime and auth.

```bash
dl doctor
dl auth verify
dl workspace list
```

2. Generate the agent instruction file.

```bash
dl agent init codex --out AGENTS.md
dl agent init claude --out CLAUDE.md
dl agent init openclaw --out OPENCLAW.md
dl agent init generic --out AGENT.md
```

3. Upload data. Use assembled JSONL when data is already joined:

```bash
dl demo pull
DEMO_ROOT="${DRIFTLEDGER_DEMO_DIR:-$HOME/.driftledger/samples/merchant-payment-escrow-reconciliation}"
dl dataset create-assembled --display-name merchant-payment-escrow
dl dataset upload-assembled --dataset <datasetId> --file "$DEMO_ROOT/datasets/train.jsonl"
```

Use raw CSV when DriftLedger should assemble related tables:

```bash
dl metadata col-types
dl metadata upsert --body-file meta.json
dl data-source upsert --display-name "Payment Order CSV" --type CSV_UPLOAD
dl source-binding upsert --body-file binding.json
dl dataset create-raw --display-name payment-order --binding-id <bindingId>
dl dataset upload --dataset <datasetId> --file payment_order.csv
dl assembly submit --body-file assembly.json
dl assembly run --task <assemblyTaskId>
```

Field `types` in metadata are optional. If an agent provides them, use only
values returned by `dl metadata col-types`, not SQL or file-parser types such as
`STRING`, `DECIMAL`, or `DATETIME`.

4. Create a reconciliation model, train or add rules, build RuleForest, configure
   alerts, run checks, and inspect incidents:

```bash
dl check-model create --body-file check-model.json
dl infer-task submit --body-file infer-task.json
dl infer-task progress --task <inferTaskId>
dl rule types
dl rule add --body-file rule.json
dl rule-forest build
dl alerts upsert --body-file alert-email-channel.json
dl alerts test --channel <channelId>
dl run submit --body-file run.json
dl run run --task <taskId>
dl incidents task --task <taskId>
dl alerts deliveries --task <taskId>
```

Manual rule payloads must use a `ruleType` returned by `dl rule types`.

## Minimum Flow

```bash
dl workspace list
dl demo pull
DEMO_ROOT="${DRIFTLEDGER_DEMO_DIR:-$HOME/.driftledger/samples/merchant-payment-escrow-reconciliation}"
dl metadata col-types
dl metadata upsert --body-file meta.json
dl data-source upsert --display-name "Payment Order CSV" --type CSV_UPLOAD
dl source-binding upsert --body-file binding.json
dl dataset create-raw --display-name payment-order --binding-id <bindingId>
dl dataset upload --dataset <datasetId> --file payment_order.csv
dl assembly submit --body-file assembly.json
dl assembly run --task <assemblyTaskId>
dl dataset create-assembled --display-name assembled-ledger
dl dataset upload-assembled --dataset <datasetId> --file "$DEMO_ROOT/datasets/train.jsonl"
dl check-model create --body-file check-model.json
dl infer-task submit --body-file infer-task.json
dl infer-task progress --task <inferTaskId>
dl rule types
dl rule add --body-file rule.json
dl rule-forest build
dl alerts upsert --body-file alert-email-channel.json
dl alerts test --channel <channelId>
dl run submit --body-file run.json
dl run run --task <taskId>
dl incidents list
dl alerts deliveries --task <taskId>
```

All command responses are JSON so Codex, Claude Code, OpenClaw, and other
agents can parse the output without screen scraping. Raw table uploads use CSV;
assembled reconciliation data uses JSONL. Alert channels currently support email
and webhook delivery, with delivery logs available for both test sends and
incident notifications.

`driftledger` remains available as the long command alias.
