# DriftLedger Agent Pipeline

This is the agent-facing MVP path. Each step produces IDs or artifacts that the
next step consumes. Keep the IDs in a local note or payload file; do not paste
tokens or private data into prompts.

## Pipeline

| Step | Command | Input | Output To Capture |
| --- | --- | --- | --- |
| Install CLI | `curl -fsSL https://driftledger.fatclaw.com/install.sh \| bash` | Node.js 20+ and npm | `dl` command |
| Configure runtime | `dl config set --api-url <url>` | DriftLedger API URL | local config |
| Authenticate | `dl auth login --email <email> --password <password>` | user credentials | saved auth token |
| Select workspace | `dl workspace list` or `dl workspace create --name "Default"` | optional workspace name | workspace id, default is `Default` |
| Download demo | `dl demo pull` | optional `--out <dir>` | sample root paths |
| Register metadata | `dl metadata upsert --body-file meta.json` | table and field metadata | metadata table id |
| Raw CSV path | `dl data-source upsert`, `dl source-binding upsert`, `dl dataset upload` | one CSV per source table | raw dataset id |
| Assembly path | `dl assembly submit`, `dl assembly run` | raw dataset id and model relation config | assembled dataset id |
| Assembled JSONL path | `dl dataset create-assembled`, `dl dataset upload-assembled` | JSONL records already joined by business flow | assembled dataset id |
| Create model | `dl check-model create --body-file check-model.json` | reconciliation model payload | risk model id/code/version |
| Train rules | `dl infer-task submit`, `dl infer-task progress` | clean assembled training dataset | generated rule candidates |
| Create reviewed rule | `dl rule types`, `dl rule validate`, `dl rule add` | rule payload or natural-language draft converted to DSL | rule id |
| Compile rules | `dl rule-forest build`, `dl rule-forest status` | workspace rules | compiled RuleForest status |
| Configure alerts | `dl alerts upsert`, `dl alerts test` | email or webhook channel payload | channel id and test delivery |
| Execute check | `dl run submit`, `dl run run` | assembled test/anomaly dataset | execution task id |
| Review closure | `dl incidents task`, `dl alerts deliveries` | execution task id | readable incidents and delivery logs |

## Choose A Data Path

Use assembled JSONL when the user already has one record per business flow with
related source rows grouped together. This skips assembly and is the fastest MVP
path.

Use raw CSV when the user has source-table exports. Register metadata first,
bind CSV columns to metadata fields, upload each raw dataset, then run assembly
to produce assembled data for training and execution.

## ID Register

Agents should preserve these values between commands:

| Name | Produced By | Used By |
| --- | --- | --- |
| `workspace` / `spId` | `dl workspace list/create` | every workspace-scoped command |
| `metaTableId` | `dl metadata upsert` or `dl metadata tables` | `dl metadata fields`, `dl source-binding upsert` |
| `dataSourceId` | `dl data-source upsert` | `dl source-binding upsert` |
| `bindingId` | `dl source-binding upsert` | `dl dataset create-raw` |
| `rawDatasetId` | `dl dataset create-raw` | `dl dataset upload`, `dl assembly submit` |
| `assembledDatasetId` | `dl dataset create-assembled` or assembly output | training and execution payloads |
| `riskModelId` | `dl check-model create` | training, assembly, and run payloads |
| `inferTaskId` | `dl infer-task submit` | `dl infer-task progress/status` |
| `ruleId` | `dl rule add` or generated rule output | selected-rule execution |
| `channelId` | `dl alerts upsert/list` | `dl alerts test` |
| `executionTaskId` | `dl run submit` | `dl run run`, `dl incidents task`, `dl alerts deliveries` |

## Done Criteria

An MVP run is complete only when all of these are visible in command output:

- the dataset upload or assembly produced an assembled dataset;
- at least one rule was validated, saved, and compiled into RuleForest;
- execution ran against a test or anomaly dataset;
- incidents are readable, including rule, impacted fields, and evidence rows;
- alert delivery was tested or recorded for the execution task.
