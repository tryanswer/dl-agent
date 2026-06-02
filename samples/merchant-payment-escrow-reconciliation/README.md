# Merchant Payment Escrow Reconciliation

This fixture set is fully synthetic. It models merchant acquiring payments,
escrow holds, buyer-confirmed releases, clearing records, and merchant
settlements without using company exports, copied model fields, card numbers,
phone numbers, addresses, or identity documents.

- Demo model ID: `DL_SYNTH_MERCHANT_ESCROW_001`
- Scenario: `merchant-payment-escrow-reconciliation`
- Train records: 80
- Test records: 24
- Controlled anomaly records: 4

## Business Flow

1. A buyer creates a merchant order.
2. The payment order can succeed, fail, be canceled, or wait for confirmation.
3. Successful payments are captured by the acquiring transaction.
4. Captured payments are held in escrow until buyer confirmation.
5. Released escrow funds move into clearing and merchant settlement.
6. Failed, canceled, pending-confirmation, and delayed-clearing rows keep the same join keys but should not satisfy success-only amount rules.

## Scenario Profiles

- `CARD_GOODS_ESCROW_RELEASED`: successful card payment, escrow release, clearing, and settlement.
- `WALLET_DIGITAL_SERVICE_RELEASED`: successful wallet payment with instant confirmation.
- `BANK_TRANSFER_B2B_ESCROW_RELEASED`: successful B2B transfer released after acceptance.
- `CARD_AUTHORIZATION_FAILED`: card payment rejected before capture.
- `BUYER_CANCELLED_BEFORE_CAPTURE`: buyer cancels before capture.
- `ESCROW_AWAITING_BUYER_CONFIRMATION`: paid and held in escrow, but not released.
- `CLEARING_DELAYED_AFTER_RELEASE`: escrow released, but clearing and settlement remain pending.

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
- `datasets/test-with-anomaly.jsonl`: validation records with four controlled amount mismatches.
- `manifest.json`: generation metadata, join keys, counts, and privacy notes.

## Controlled Anomalies

`datasets/test-with-anomaly.jsonl` keeps all join keys intact and injects four
success-chain field mismatches:

- `ACQUIRING_CAPTURE_AMOUNT_MISMATCH`: acquiring captured amount differs from payment amount.
- `ESCROW_RELEASE_AMOUNT_MISMATCH`: release amount differs from held escrow amount.
- `CLEARING_FEE_AMOUNT_MISMATCH`: clearing fee differs from payment fee.
- `SETTLEMENT_AMOUNT_MISMATCH`: merchant settlement differs from clearing net amount.

Run `npm run verify:samples` from the repository root before publishing sample updates. The verifier checks privacy patterns, join-key integrity, success-only amount rules, status-driven preconditions, and controlled anomaly shape.
