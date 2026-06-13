# DriftLedger Agent Contract for OpenClaw

Use `dl` for DriftLedger reconciliation workflows. `driftledger` may exist as a compatibility alias, but examples and generated commands must use `dl`.

Rules:
- If `dl` is missing, install it first: `curl -fsSL https://driftledger-global.fatclaw.com/install.sh | bash`.
- Run `dl doctor` and inspect JSON before making changes.
- Verify auth with `dl auth verify` before write operations.
- Prefer `--body-file` for metadata, source bindings, reconciliation models, rules, assembly tasks, and execution tasks.
- Upload raw table exports as CSV and assembled reconciliation records as JSONL.
- Use `skills/driftledger-cli` when available for the full install-to-run workflow.
- Use `skills/driftledger-incident-review` after a run creates incidents or alert deliveries.
- Workspace defaults to `Default`; use `--workspace <spId>` only when the user specifies another workspace.
- Configure alert channels before production runs and check delivery logs after incidents.
- For Slack alerts, read the incoming webhook from `SLACK_WEBHOOK_URL` and use `dl alerts slack --webhook-url "$SLACK_WEBHOOK_URL" --min-severity HIGH`.
- Convert natural-language rule requests into rule DSL from existing metadata, then run `dl rule validate` before saving.
- Never put tokens, accounts, or raw company data in prompts or repository files.
- Use environment variables when the runtime cannot write `~/.driftledger/config.json`.

Environment:

```bash
export DRIFTLEDGER_API_URL="https://driftledger-global.fatclaw.com"
export DRIFTLEDGER_TOKEN="<jwt>"
export DRIFTLEDGER_WORKSPACE_ID="Default"
```

Short path:

```bash
command -v dl >/dev/null || curl -fsSL https://driftledger-global.fatclaw.com/install.sh | bash
dl doctor
dl auth verify
dl dataset create-assembled --display-name merchant-payment-escrow
dl dataset upload-assembled --dataset <datasetId> --file samples/merchant-payment-escrow-reconciliation/datasets/test-with-anomaly.jsonl
dl check-model create --body-file examples/body-files/check-model.json
dl infer-task submit --body-file examples/body-files/infer-task.json
dl infer-task progress --task <inferTaskId>
dl rule validate --body-file examples/body-files/rule.json
dl rule add --body-file examples/body-files/rule.json
dl rule-forest build
dl alerts types
dl alerts upsert --body-file examples/body-files/alert-email-channel.json
dl alerts slack --webhook-url "$SLACK_WEBHOOK_URL" --min-severity HIGH
dl alerts test --channel <channelId>
dl run submit --body-file examples/body-files/run.json
dl run run --task <taskId>
dl incidents task --task <taskId>
dl alerts deliveries --task <taskId>
```
