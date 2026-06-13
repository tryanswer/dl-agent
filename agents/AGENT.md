# DriftLedger Agent Contract

Use `dl` for DriftLedger reconciliation workflows. `driftledger` may exist as a compatibility alias, but examples and generated commands must use `dl`.

Rules:
- If `dl` is missing, install it first: `curl -fsSL https://driftledger-global.fatclaw.com/install.sh | bash`.
- Start with `dl doctor`.
- Verify auth with `dl auth verify` before write operations.
- Keep complex request bodies in files and pass them with `--body-file`.
- Parse JSON from stdout. Treat JSON on stderr with `ok:false` as a recoverable command failure.
- Use CSV for raw table uploads and JSONL for assembled reconciliation data.
- Use `skills/driftledger-cli` when available for the full install-to-run workflow.
- Use `skills/driftledger-incident-review` after a run creates incidents or alert deliveries.
- Workspace defaults to `Default`; use `--workspace <spId>` only when the user specifies another workspace.
- Configure alert channels before production runs and check delivery logs after incidents.
- Convert natural-language rule requests into rule DSL from existing metadata, then run `dl rule validate` before saving.
- Keep secrets in `DRIFTLEDGER_TOKEN` or `~/.driftledger/config.json`, not in prompts or committed files.

Minimum flow:

```bash
command -v dl >/dev/null || curl -fsSL https://driftledger-global.fatclaw.com/install.sh | bash
dl doctor
dl auth verify
dl workspace list
dl dataset create-assembled --display-name merchant-payment-escrow
dl dataset upload-assembled --dataset <datasetId> --file samples/merchant-payment-escrow-reconciliation/datasets/train.jsonl
dl check-model create --body-file examples/body-files/check-model.json
dl infer-task submit --body-file examples/body-files/infer-task.json
dl infer-task progress --task <inferTaskId>
dl rule validate --body-file examples/body-files/rule.json
dl rule add --body-file examples/body-files/rule.json
dl rule-forest build
dl alerts upsert --body-file examples/body-files/alert-email-channel.json
dl alerts test --channel <channelId>
dl run submit --body-file examples/body-files/run.json
dl run run --task <taskId>
dl incidents task --task <taskId>
dl alerts deliveries --task <taskId>
```
