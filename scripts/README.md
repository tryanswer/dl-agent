# Scripts

- `install.sh`: hosted installer for `@driftledger/cli`.
- `sync-demo-assets.mjs`: deterministic synthetic sample generator for
  `samples/merchant-payment-escrow-reconciliation`; it does not read company
  fixtures or sibling repositories.
- `verify-demo-assets.mjs`: privacy and data-shape guard for sample assets,
  including join-key integrity checks for assembled JSONL records.

Deploy target:

```text
https://driftledger.fatclaw.com/install.sh
```
