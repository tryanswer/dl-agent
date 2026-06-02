# Merchant Payment Escrow Reconciliation

This fixture set is fully synthetic. It models merchant acquiring payments,
escrow holds, buyer-confirmed releases, clearing records, and merchant
settlements without using company exports, copied model fields, card numbers,
phone numbers, addresses, or identity documents.

- Demo model ID: `DL_SYNTH_MERCHANT_ESCROW_001`
- Scenario: `merchant-payment-escrow-reconciliation`
- Train records: 48
- Test records: 12
- Controlled anomaly records: 1

## Business Flow

1. A buyer creates a merchant order.
2. The payment order captures the same amount.
3. The acquiring transaction records the captured amount and fee.
4. Escrow holds the paid amount until buyer confirmation.
5. Escrow release pays the seller after confirmation.
6. Clearing calculates merchant net amount.
7. Settlement pays the merchant for the same batch and merchant key.

## Join Keys

- `merchant_order.order_no = payment_order.order_no`
- `payment_order.payment_id = acquiring_transaction.payment_id`
- `payment_order.payment_id = escrow_ledger.payment_id`
- `escrow_ledger.escrow_id = escrow_release.escrow_id`
- `payment_order.payment_id = clearing_record.payment_id`
- `clearing_record.settlement_batch_no = settlement_record.settlement_batch_no`
- `clearing_record.merchant_id = settlement_record.merchant_id`

## Files

- `models/demo_model.jsonl`: synthetic reconciliation model.
- `datasets/train.jsonl`: clean assembled records for rule training.
- `datasets/test.jsonl`: clean assembled records for validation.
- `datasets/test-with-anomaly.jsonl`: validation records with one controlled settlement amount mismatch.
- `manifest.json`: generation metadata, join keys, counts, and privacy notes.

Run `npm run verify:samples` from the repository root before publishing sample updates. The verifier checks privacy patterns, join-key integrity, and the controlled anomaly shape.
