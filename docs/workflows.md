# DriftLedger Agent Workflows

## Assembled-Data Path

Use this when another process already joined related source rows into reconciliation records.

```bash
dl doctor
dl workspace list
dl dataset create-assembled --workspace <spId> --display-name merchant-payment-escrow
dl dataset upload-assembled --workspace <spId> --dataset <datasetId> --file samples/merchant-payment-escrow-reconciliation/datasets/train.jsonl
dl dataset create-assembled --workspace <spId> --display-name merchant-payment-escrow-anomaly
dl dataset upload-assembled --workspace <spId> --dataset <anomalyDatasetId> --file samples/merchant-payment-escrow-reconciliation/datasets/test-with-anomaly.jsonl
dl check-model create --workspace <spId> --body-file examples/body-files/check-model.json
dl infer-task submit --workspace <spId> --body-file examples/body-files/infer-task.json
dl infer-task progress --workspace <spId> --task <inferTaskId>
dl rule add --workspace <spId> --body-file examples/body-files/rule.json
dl rule-forest build --workspace <spId>
dl rule-forest status --workspace <spId>
dl alerts upsert --workspace <spId> --body-file examples/body-files/alert-email-channel.json
dl alerts test --workspace <spId> --channel <channelId>
dl run submit --workspace <spId> --body-file examples/body-files/run.json
dl run run --workspace <spId> --task <taskId>
dl incidents task --workspace <spId> --task <taskId>
dl alerts deliveries --workspace <spId> --task <taskId>
```

## Raw-Table Path

Use this when the user uploads one or more source-table CSV files and DriftLedger should preserve table identity before assembly.

```bash
dl metadata upsert --workspace <spId> --body-file examples/body-files/meta.json
dl data-source upsert --workspace <spId> --display-name "Payment Order CSV" --type CSV_UPLOAD
dl source-binding upsert --workspace <spId> --body-file examples/body-files/binding.json
dl dataset create-raw --workspace <spId> --display-name payment-order --binding-id <bindingId>
dl dataset upload --workspace <spId> --dataset <datasetId> --file payment_order.csv
dl assembly submit --workspace <spId> --body-file examples/body-files/assembly.json
dl assembly run --workspace <spId> --task <assemblyTaskId>
```

The assembly result is an assembled dataset. Use that dataset ID for rule training and execution.

## Privacy Guard

Before publishing sample assets, run:

```bash
npm run verify:samples
```

The guard should fail if account numbers, long raw identifiers, emails, or private source names appear in public samples.
