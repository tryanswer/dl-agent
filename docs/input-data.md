# Input Data Formats

DriftLedger MVP supports two user data shapes: assembled JSONL and raw CSV.
Both paths require metadata that names tables and fields before rules are
created.

## Assembled JSONL

Use assembled JSONL when each line already contains all related rows for one
business flow instance.

Rules:

- UTF-8 JSON Lines: one JSON object per line, no surrounding array.
- `tableDataMap` keys must exactly match metadata `table.nodeName`.
- `dataMap` keys must exactly match metadata `fields[].fieldName`.
- Join-key values must be present and equal across related tables according to
  the reconciliation model.
- Status fields used in rule preconditions should be included in the same line.
- Amounts should use one stable representation across a file, preferably
  decimal strings such as `"128.23"` for money.
- Do not include real account numbers, card numbers, addresses, phone numbers,
  identity numbers, or company-internal source names.

Minimal shape:

```json
{
  "empty": false,
  "modelId": "DL_SYNTH_MERCHANT_ESCROW_001",
  "recordId": "REC-2026-06-02-0001",
  "scenario": "CARD_GOODS_ESCROW_RELEASED",
  "scenarioDescription": "Card acquiring payment after delivery confirmation",
  "records": [],
  "tableDataMap": {
    "driftledger.payment_order": [
      {
        "dbTable": "driftledger.payment_order",
        "pk": "PAY-2026-06-02-0001",
        "dataMap": {
          "payment_id": "PAY-2026-06-02-0001",
          "order_no": "ORD-2026-06-02-0001",
          "payment_status": "PAID",
          "payment_amount": "129.00",
          "fee_amount": "0.77",
          "net_amount": "128.23"
        }
      }
    ]
  }
}
```

The public sample uses one row per table per line. If a business flow can have
multiple rows for a table, keep them in the table array and validate the
expected rule behavior with a small fixture first.

## Raw CSV

Use raw CSV when the user has source-table exports and wants DriftLedger to
assemble related rows.

Rules:

- One CSV file represents one source table.
- The first row must be headers.
- Headers are mapped through `source-binding.fieldMappings`.
- `primaryKeyFields` must uniquely identify rows within that source table.
- Join-key columns must be present and must match the metadata fields marked as
  join keys.
- Keep status, amount, and timestamp formats stable across the file.
- Upload source tables separately; do not combine unrelated tables into one CSV.

Raw CSV path:

```bash
dl metadata upsert --body-file examples/body-files/meta.json
dl data-source upsert --display-name "Payment Order CSV" --type CSV_UPLOAD
dl source-binding upsert --body-file examples/body-files/binding.json
dl dataset create-raw --display-name payment-order --binding-id <bindingId>
dl dataset upload --dataset <rawDatasetId> --file payment_order.csv
dl assembly submit --body-file examples/body-files/assembly.json
dl assembly run --task <assemblyTaskId>
```

## Body Files

Payload files live under `examples/body-files/`. Copy them, replace
placeholders, and pass them with `--body-file`.

| File | Purpose | Important Fields |
| --- | --- | --- |
| `meta.json` | table and field metadata | `table.nodeName`, `table.riskLevel`, `fields[].fieldName`, `primaryKey`, `joinKey`, `riskLevel` |
| `binding.json` | maps raw CSV columns to metadata fields | `metaTableId`, `dataSourceId`, `sourceName`, `fieldMappings`, `primaryKeyFields` |
| `assembly.json` | turns raw datasets into assembled data | `inputDatasetIds`, `riskModelId`, `assemblyOptions.anchor` |
| `check-model.json` | creates the reconciliation model | `title`, `version`, `riskLevel`, `description` |
| `infer-task.json` | trains rule candidates | `riskModelId`, `dataSetId`, `modelConfig.limitBizScenes`, `algoConfig` |
| `rule.json` | saves a reviewed executable rule | `modelId`, `modelVersion`, `ruleType`, `ruleContent` |
| `run.json` | executes checks | `datasetId`, `riskModelId`, `ruleScope`, `selectedRuleIds` |
| `alert-email-channel.json` | email notification channel | `channelType`, `recipients`, `minSeverity` |
| `alert-webhook-channel.json` | webhook notification channel | `channelType`, `webhookUrl`, `webhookSecret`, `minSeverity` |

## Reconciliation Model Relation Fixture

The demo model relation file, `models/demo_model.jsonl`, describes how raw
tables are connected before they become assembled data. It is useful when an
agent needs to understand or recreate the business-flow graph.

Important fields:

| Field | Meaning |
| --- | --- |
| `modelId` / `modelVersion` | stable synthetic model identity |
| `triggerTable` | anchor table for the business flow |
| `triggerJoinCol.joinCols` | join columns on the anchor table |
| `modelFilter` | coarse flow filter before rule-specific preconditions |
| `joinTables` | tables included in the assembled record |
| `joins[]` | pairwise table relationships |
| `joins[].leftTable` / `rightTable` | related source tables |
| `joins[].leftCol.joinCols` / `rightCol.joinCols` | one-column or composite join keys |

The assembled JSONL must satisfy these relationships: rows grouped into one
line should carry matching join-key values for every active relationship.

## Rule Input

Natural language is accepted only as a drafting input for an agent. The saved
rule must be legal DSL:

1. inspect metadata with `dl metadata tables` and `dl metadata fields`;
2. inspect allowed types with `dl rule types`;
3. convert the user request to `ruleContent` using exact `table#field`
   references;
4. run `dl rule validate --body-file <rule.json>`;
5. save with `dl rule add --body-file <rule.json>` only after validation passes.

Example equality rule:

```text
driftledger.clearing_record#net_amount = driftledger.settlement_record#settlement_amount
WHERE driftledger.payment_order#payment_status = 'PAID'
AND driftledger.clearing_record#clearing_status = 'CLEARED'
AND driftledger.settlement_record#settlement_status = 'SETTLED'
```

## Demo Files

`dl demo pull` downloads:

| File | Use |
| --- | --- |
| `datasets/train.jsonl` | clean assembled training data |
| `datasets/test.jsonl` | clean assembled validation data |
| `datasets/test-with-anomaly.jsonl` | controlled mismatch data for incident verification |
| `models/demo_model.jsonl` | synthetic model relation fixture |
| `manifest.json` | counts, scenario profiles, join keys, and privacy notes |

Before publishing changed samples, run `npm run verify:samples`.
