# DriftLedger Agent Contract

Use `dl` for DriftLedger reconciliation workflows. `driftledger` may exist as a compatibility alias, but examples and generated commands must use `dl`.

Rules:
- If `dl` is missing, install it first: `curl -fsSL https://driftledger.fatclaw.com/install.sh | bash`.
- Start with `dl doctor` before calling API-backed commands.
- Verify auth with `dl auth verify` before write operations.
- Keep payloads in JSON files and pass them with `--body-file`.
- Treat stdout as machine-readable JSON.
- Use `skills/driftledger-cli` when available for the full install-to-run workflow.
- Use `skills/driftledger-incident-review` after a run creates incidents or alert deliveries.
- Workspace defaults to `Default`; use `--workspace <spId>` only when the user specifies another workspace.
- Never paste tokens into prompts or committed files.
- Configure alert channels before production runs and check delivery logs after incidents.
- Convert natural-language rule requests into rule DSL from existing metadata, then run `dl rule validate` before saving.
- Use `DRIFTLEDGER_TOKEN`, `DRIFTLEDGER_API_URL`, and `DRIFTLEDGER_WORKSPACE_ID` for hosted or sandboxed agents.

Optional local skill install from a checked-out `dl-agent` repository:

```bash
mkdir -p ~/.codex/skills
cp -R skills/driftledger-cli ~/.codex/skills/
cp -R skills/driftledger-incident-review ~/.codex/skills/
```

Common flow:

```bash
command -v dl >/dev/null || curl -fsSL https://driftledger.fatclaw.com/install.sh | bash
dl doctor
dl auth verify
dl workspace list
dl metadata upsert --body-file examples/body-files/meta.json
dl source-binding upsert --body-file examples/body-files/binding.json
dl dataset create-raw --display-name payment-order --binding-id <bindingId>
dl dataset upload --dataset <datasetId> --file payment_order.csv
dl assembly submit --body-file examples/body-files/assembly.json
dl assembly run --task <assemblyTaskId>
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
