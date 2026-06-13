# DriftLedger CLI Commands

All normal responses are JSON on stdout. Errors are JSON on stderr with `ok:false`.
Use `docs/pipeline.md` for command order and `docs/input-data.md` for accepted
input file formats.

## Runtime Context

```bash
dl doctor
dl version
dl config get
dl config set --api-url <url> --token <jwt> --workspace <spId>
dl auth login --email <email> --password <password>
dl auth login --web --web-url https://driftledger.fatclaw.com
dl auth verify
dl auth refresh
```

Configuration precedence:

```text
CLI flags > environment variables > ~/.driftledger/config.json > default
```

## Workspace

```bash
dl workspace list
dl workspace create --name "Demo workspace"
dl workspace get --workspace <spId>
dl workspace activate --workspace <spId>
dl workspace close --workspace <spId>
```

## Metadata And Data

```bash
dl metadata upsert --workspace <spId> --body-file examples/body-files/meta.json
dl metadata tables --workspace <spId>
dl metadata fields --workspace <spId> --table <metaTableId>
dl data-source upsert --workspace <spId> --display-name "Payment Order CSV" --type CSV_UPLOAD
dl source-binding upsert --workspace <spId> --body-file examples/body-files/binding.json
dl dataset create-raw --workspace <spId> --display-name payment-order --binding-id <bindingId>
dl dataset upload --workspace <spId> --dataset <datasetId> --file payment_order.csv
dl dataset create-assembled --workspace <spId> --display-name merchant-payment-escrow
dl dataset upload-assembled --workspace <spId> --dataset <datasetId> --file assembled.jsonl
dl dataset detail --workspace <spId> --dataset <datasetId>
```

## Assembly

Use assembly when the user uploads raw table data and DriftLedger needs to produce assembled records.

```bash
dl assembly submit --workspace <spId> --body-file examples/body-files/assembly.json
dl assembly run --workspace <spId> --task <assemblyTaskId>
```

## Models And Rules

The product term is "reconciliation model"; the CLI command group remains `check-model` for backend compatibility.

```bash
dl check-model create --workspace <spId> --body-file examples/body-files/check-model.json
dl check-model update --workspace <spId> --body-file examples/body-files/check-model.json
dl check-model deploy --workspace <spId> --id <riskModelId>
dl check-model enable --workspace <spId> --id <riskModelId>
dl check-model list --workspace <spId> --code <modelCode>
dl infer-task submit --workspace <spId> --body-file examples/body-files/infer-task.json
dl infer-task list --workspace <spId>
dl infer-task status --workspace <spId> --task <inferTaskId>
dl infer-task progress --workspace <spId> --task <inferTaskId>
dl infer-task cancel --workspace <spId> --task <inferTaskId>
dl infer-task reset --workspace <spId> --task <inferTaskId>
dl rule types
dl rule validate --workspace <spId> --body-file examples/body-files/rule.json
dl rule add --workspace <spId> --body-file examples/body-files/rule.json
dl rule list --workspace <spId>
dl rule get --workspace <spId> --id <ruleId>
dl rule enable --workspace <spId> --id <ruleId>
dl rule disable --workspace <spId> --id <ruleId>
```

For natural-language rule creation, first inspect metadata tables and fields,
then convert the request into rule DSL with exact `table#field` references.
Validate the draft before saving it.

## RuleForest, Runs, Incidents

```bash
dl rule-forest build --workspace <spId>
dl rule-forest status --workspace <spId>
dl run submit --workspace <spId> --body-file examples/body-files/run.json
dl run run --workspace <spId> --task <taskId>
dl run indexes --workspace <spId> --task <taskId>
dl incidents list --workspace <spId>
dl incidents task --workspace <spId> --task <taskId>
dl incidents get --workspace <spId> --incident <incidentId>
dl incidents actions --workspace <spId> --incident <incidentId>
```

## Alerts

Alert channels notify users when execution opens incidents. Use email for the
default MVP path and webhook for ChatOps, workflow automation, or internal
incident routers.

```bash
dl alerts upsert --workspace <spId> --body-file examples/body-files/alert-email-channel.json
dl alerts upsert --workspace <spId> --body-file examples/body-files/alert-webhook-channel.json
dl alerts list --workspace <spId>
dl alerts enable --workspace <spId> --channel <channelId>
dl alerts disable --workspace <spId> --channel <channelId>
dl alerts test --workspace <spId> --channel <channelId>
dl alerts deliveries --workspace <spId>
dl alerts deliveries --workspace <spId> --task <taskId>
```
