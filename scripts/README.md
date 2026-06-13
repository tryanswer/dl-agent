# Scripts

- `install.sh`: hosted installer for the `dl` CLI. By default it downloads the
  public `dl-agent` GitHub archive, packs `packages/cli`, and installs the
  tarball globally. Set `DRIFTLEDGER_CLI_PACKAGE=./packages/cli` for local
  development.
- `sync-demo-assets.mjs`: deterministic synthetic sample generator for
  `samples/merchant-payment-escrow-reconciliation`; it does not read company
  fixtures or sibling repositories.
- `verify-demo-assets.mjs`: privacy and data-shape guard for sample assets,
  including join-key integrity checks for assembled JSONL records.

Deploy target:

```text
https://driftledger.fatclaw.com/install.sh
```
