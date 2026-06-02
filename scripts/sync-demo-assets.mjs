#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sampleName = 'merchant-payment-escrow-reconciliation';
const targetRoot = path.resolve(repoRoot, 'samples', sampleName);
const modelId = 'DL_SYNTH_MERCHANT_ESCROW_001';
const modelVersion = 'synthetic-v1';
const generatedAt = '2026-06-02T00:00:00.000Z';

const tables = {
  merchantOrder: 'driftledger.merchant_order',
  paymentOrder: 'driftledger.payment_order',
  acquiringTransaction: 'driftledger.acquiring_transaction',
  escrowLedger: 'driftledger.escrow_ledger',
  escrowRelease: 'driftledger.escrow_release',
  clearingRecord: 'driftledger.clearing_record',
  settlementRecord: 'driftledger.settlement_record',
};

const merchants = [
  { id: 'MCH-2026-06-02-001', label: 'Harbor Books Online', feeBps: 60 },
  { id: 'MCH-2026-06-02-002', label: 'Northstar Home Goods', feeBps: 75 },
  { id: 'MCH-2026-06-02-003', label: 'Summit Outdoor Supply', feeBps: 90 },
  { id: 'MCH-2026-06-02-004', label: 'Cedar Market Digital', feeBps: 55 },
];

const orderAmounts = [
  12900, 4999, 25880, 7600, 18999, 4200, 31550, 9800, 15675, 6400,
  22880, 11200, 5300, 17420, 8600, 29990, 13850, 7200, 24600, 9350,
];

function pad(value, size = 4) {
  return String(value).padStart(size, '0');
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

function minutesAt(day, index, offsetMinutes = 0) {
  const hour = 9 + Math.floor(index / 4);
  const minute = (index * 7 + offsetMinutes) % 60;
  const second = (index * 13 + offsetMinutes) % 60;
  return `2026-06-${pad(day, 2)} ${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}`;
}

function feeCents(amountCents, feeBps) {
  return Math.round((amountCents * feeBps) / 10000);
}

function row(table, pk, dataMap) {
  return {
    dbTable: table,
    pk,
    dataMap,
  };
}

function buildRecord(index, split) {
  const day = split === 'train' ? 2 + Math.floor(index / 12) : 8 + Math.floor(index / 6);
  const merchant = merchants[index % merchants.length];
  const amountCents = orderAmounts[index % orderAmounts.length] + Math.floor(index / orderAmounts.length) * 310;
  const fee = feeCents(amountCents, merchant.feeBps);
  const net = amountCents - fee;
  const suffix = pad(index + 1);
  const orderNo = `ORD-2026-06-${pad(day, 2)}-${suffix}`;
  const paymentId = `PAY-2026-06-${pad(day, 2)}-${suffix}`;
  const acquiringId = `ACQ-2026-06-${pad(day, 2)}-${suffix}`;
  const escrowId = `ESC-2026-06-${pad(day, 2)}-${suffix}`;
  const releaseId = `REL-2026-06-${pad(day, 2)}-${suffix}`;
  const clearingRefNo = `CLR-2026-06-${pad(day, 2)}-${suffix}`;
  const settlementBatchNo = `SET-2026-06-${pad(day, 2)}-${pad(Math.floor(index / 6) + 1, 3)}`;
  const buyerAccountId = `BUYER-ACCT-2026-${pad((index % 30) + 1)}`;
  const sellerAccountId = `SELLER-ACCT-2026-${pad((index % 12) + 1)}`;
  const platformEscrowAccountId = 'PLAT-ACCT-ESCROW-CNY';
  const createdAt = minutesAt(day, index);
  const paidAt = minutesAt(day, index, 3);
  const confirmedAt = minutesAt(day + 1, index, 11);
  const clearedAt = minutesAt(day + 1, index, 17);
  const settledAt = minutesAt(day + 2, index, 23);

  return {
    empty: false,
    modelId,
    recordId: `REC-2026-06-${pad(day, 2)}-${suffix}`,
    scenario: index % 2 === 0 ? 'ACQUIRING_PAYMENT' : 'ESCROW_TRADE_RELEASE',
    records: [],
    tableDataMap: {
      [tables.merchantOrder]: [
        row(tables.merchantOrder, orderNo, {
          order_no: orderNo,
          merchant_id: merchant.id,
          merchant_label: merchant.label,
          buyer_account_id: buyerAccountId,
          seller_account_id: sellerAccountId,
          order_amount: money(amountCents),
          currency: 'CNY',
          order_status: 'PAID',
          created_at: createdAt,
        }),
      ],
      [tables.paymentOrder]: [
        row(tables.paymentOrder, paymentId, {
          payment_id: paymentId,
          order_no: orderNo,
          merchant_id: merchant.id,
          buyer_account_id: buyerAccountId,
          payment_amount: money(amountCents),
          fee_amount: money(fee),
          net_amount: money(net),
          currency: 'CNY',
          payment_method: index % 3 === 0 ? 'CARD' : index % 3 === 1 ? 'WALLET' : 'BANK_TRANSFER',
          payment_status: 'PAID',
          paid_at: paidAt,
        }),
      ],
      [tables.acquiringTransaction]: [
        row(tables.acquiringTransaction, acquiringId, {
          acquiring_id: acquiringId,
          payment_id: paymentId,
          merchant_id: merchant.id,
          capture_amount: money(amountCents),
          fee_amount: money(fee),
          net_amount: money(net),
          currency: 'CNY',
          acquiring_status: 'CAPTURED',
          captured_at: paidAt,
        }),
      ],
      [tables.escrowLedger]: [
        row(tables.escrowLedger, escrowId, {
          escrow_id: escrowId,
          payment_id: paymentId,
          order_no: orderNo,
          buyer_account_id: buyerAccountId,
          seller_account_id: sellerAccountId,
          platform_escrow_account_id: platformEscrowAccountId,
          escrow_amount: money(amountCents),
          currency: 'CNY',
          escrow_status: 'HELD',
          held_at: paidAt,
        }),
      ],
      [tables.escrowRelease]: [
        row(tables.escrowRelease, releaseId, {
          release_id: releaseId,
          escrow_id: escrowId,
          order_no: orderNo,
          seller_account_id: sellerAccountId,
          release_amount: money(amountCents),
          currency: 'CNY',
          release_status: 'RELEASED',
          confirmed_at: confirmedAt,
        }),
      ],
      [tables.clearingRecord]: [
        row(tables.clearingRecord, clearingRefNo, {
          clearing_ref_no: clearingRefNo,
          payment_id: paymentId,
          acquiring_id: acquiringId,
          settlement_batch_no: settlementBatchNo,
          merchant_id: merchant.id,
          clearing_amount: money(amountCents),
          fee_amount: money(fee),
          net_amount: money(net),
          currency: 'CNY',
          clearing_status: 'CLEARED',
          cleared_at: clearedAt,
        }),
      ],
      [tables.settlementRecord]: [
        row(tables.settlementRecord, `${settlementBatchNo}-${merchant.id}`, {
          settlement_batch_no: settlementBatchNo,
          merchant_id: merchant.id,
          seller_account_id: sellerAccountId,
          gross_amount: money(amountCents),
          fee_amount: money(fee),
          settlement_amount: money(net),
          currency: 'CNY',
          settlement_status: 'SETTLED',
          settled_at: settledAt,
        }),
      ],
    },
  };
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

function withAnomaly(record) {
  const anomaly = cloneRecord(record);
  anomaly.recordId = `${record.recordId}-ANOMALY`;
  anomaly.anomaly = {
    type: 'SETTLEMENT_AMOUNT_MISMATCH',
    reason: 'settlement amount is 1.00 CNY higher than clearing net amount',
    changedField: `${tables.settlementRecord}#settlement_amount`,
    preservedJoinKeys: [
      `${tables.paymentOrder}#payment_id`,
      `${tables.clearingRecord}#payment_id`,
      `${tables.clearingRecord}#settlement_batch_no`,
      `${tables.settlementRecord}#settlement_batch_no`,
      `${tables.settlementRecord}#merchant_id`,
    ],
  };
  const settlementRow = anomaly.tableDataMap[tables.settlementRecord][0].dataMap;
  settlementRow.settlement_amount = money(Math.round(Number(settlementRow.settlement_amount) * 100) + 100);
  return anomaly;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
}

function writeText(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const trainRecords = Array.from({ length: 48 }, (_, index) => buildRecord(index, 'train'));
const testRecords = Array.from({ length: 12 }, (_, index) => buildRecord(index + 48, 'test'));
const anomalyRecords = testRecords.map((record, index) => (index === 3 ? withAnomaly(record) : cloneRecord(record)));

const manifest = {
  product: 'driftledger',
  scenario: sampleName,
  syntheticData: true,
  sourceCompanyDataIncluded: false,
  demoModelId: modelId,
  modelVersion,
  recordCount: trainRecords.length + testRecords.length,
  trainCount: trainRecords.length,
  testCount: testRecords.length,
  anomalyCount: anomalyRecords.filter((record) => record.anomaly).length,
  generatedAt,
  businessFlows: [
    'Merchant acquiring payment',
    'Escrow hold after successful payment',
    'Escrow release after buyer confirmation',
    'Clearing and merchant settlement',
  ],
  demoTables: Object.values(tables),
  joinIntegrity: {
    anchor: `${tables.paymentOrder}#payment_id`,
    preservedKeys: [
      `${tables.merchantOrder}#order_no = ${tables.paymentOrder}#order_no`,
      `${tables.paymentOrder}#payment_id = ${tables.acquiringTransaction}#payment_id`,
      `${tables.paymentOrder}#payment_id = ${tables.escrowLedger}#payment_id`,
      `${tables.escrowLedger}#escrow_id = ${tables.escrowRelease}#escrow_id`,
      `${tables.paymentOrder}#payment_id = ${tables.clearingRecord}#payment_id`,
      `${tables.clearingRecord}#settlement_batch_no = ${tables.settlementRecord}#settlement_batch_no`,
      `${tables.clearingRecord}#merchant_id = ${tables.settlementRecord}#merchant_id`,
    ],
  },
  privacy: {
    rawCompanyDataIncluded: false,
    notes: [
      'All records are generated from deterministic synthetic business scenarios.',
      'Identifiers use realistic merchant, order, payment, escrow, clearing, settlement, buyer, and seller formats.',
      'No bank card numbers, phone numbers, personal addresses, identity numbers, or company source table names are included.',
    ],
  },
};

const model = {
  modelId,
  modelVersion,
  source: sampleName,
  triggerTable: tables.paymentOrder,
  triggerJoinCol: { joinCols: ['payment_id'] },
  modelFilter: `${tables.paymentOrder}.payment_status == 'PAID'`,
  selfJoin: false,
  singleJoinModel: false,
  joinTables: Object.values(tables),
  joins: [
    {
      idx: 0,
      leftTable: tables.merchantOrder,
      leftCol: { joinCols: ['order_no'] },
      rightTable: tables.paymentOrder,
      rightCol: { joinCols: ['order_no'] },
      joinTableSet: [tables.merchantOrder, tables.paymentOrder],
      selfLoop: false,
      singleJoin: false,
    },
    {
      idx: 1,
      leftTable: tables.paymentOrder,
      leftCol: { joinCols: ['payment_id'] },
      rightTable: tables.acquiringTransaction,
      rightCol: { joinCols: ['payment_id'] },
      joinTableSet: [tables.paymentOrder, tables.acquiringTransaction],
      selfLoop: false,
      singleJoin: false,
    },
    {
      idx: 2,
      leftTable: tables.paymentOrder,
      leftCol: { joinCols: ['payment_id'] },
      rightTable: tables.escrowLedger,
      rightCol: { joinCols: ['payment_id'] },
      joinTableSet: [tables.paymentOrder, tables.escrowLedger],
      selfLoop: false,
      singleJoin: false,
    },
    {
      idx: 3,
      leftTable: tables.escrowLedger,
      leftCol: { joinCols: ['escrow_id'] },
      rightTable: tables.escrowRelease,
      rightCol: { joinCols: ['escrow_id'] },
      joinTableSet: [tables.escrowLedger, tables.escrowRelease],
      selfLoop: false,
      singleJoin: false,
    },
    {
      idx: 4,
      leftTable: tables.paymentOrder,
      leftCol: { joinCols: ['payment_id'] },
      rightTable: tables.clearingRecord,
      rightCol: { joinCols: ['payment_id'] },
      joinTableSet: [tables.paymentOrder, tables.clearingRecord],
      selfLoop: false,
      singleJoin: false,
    },
    {
      idx: 5,
      leftTable: tables.clearingRecord,
      leftCol: { joinCols: ['settlement_batch_no', 'merchant_id'] },
      rightTable: tables.settlementRecord,
      rightCol: { joinCols: ['settlement_batch_no', 'merchant_id'] },
      joinTableSet: [tables.clearingRecord, tables.settlementRecord],
      selfLoop: false,
      singleJoin: false,
    },
  ],
};

fs.rmSync(targetRoot, { recursive: true, force: true });
writeJson(path.join(targetRoot, 'manifest.json'), manifest);
writeText(path.join(targetRoot, 'README.md'), `# Merchant Payment Escrow Reconciliation

This fixture set is fully synthetic. It models merchant acquiring payments,
escrow holds, buyer-confirmed releases, clearing records, and merchant
settlements without using company exports, copied model fields, card numbers,
phone numbers, addresses, or identity documents.

- Demo model ID: \`${modelId}\`
- Scenario: \`${sampleName}\`
- Train records: ${trainRecords.length}
- Test records: ${testRecords.length}
- Controlled anomaly records: ${manifest.anomalyCount}

## Business Flow

1. A buyer creates a merchant order.
2. The payment order captures the same amount.
3. The acquiring transaction records the captured amount and fee.
4. Escrow holds the paid amount until buyer confirmation.
5. Escrow release pays the seller after confirmation.
6. Clearing calculates merchant net amount.
7. Settlement pays the merchant for the same batch and merchant key.

## Join Keys

- \`merchant_order.order_no = payment_order.order_no\`
- \`payment_order.payment_id = acquiring_transaction.payment_id\`
- \`payment_order.payment_id = escrow_ledger.payment_id\`
- \`escrow_ledger.escrow_id = escrow_release.escrow_id\`
- \`payment_order.payment_id = clearing_record.payment_id\`
- \`clearing_record.settlement_batch_no = settlement_record.settlement_batch_no\`
- \`clearing_record.merchant_id = settlement_record.merchant_id\`

## Files

- \`models/demo_model.jsonl\`: synthetic reconciliation model.
- \`datasets/train.jsonl\`: clean assembled records for rule training.
- \`datasets/test.jsonl\`: clean assembled records for validation.
- \`datasets/test-with-anomaly.jsonl\`: validation records with one controlled settlement amount mismatch.
- \`manifest.json\`: generation metadata, join keys, counts, and privacy notes.

Run \`npm run verify:samples\` from the repository root before publishing sample updates. The verifier checks privacy patterns, join-key integrity, and the controlled anomaly shape.
`);
writeJsonl(path.join(targetRoot, 'datasets/train.jsonl'), trainRecords);
writeJsonl(path.join(targetRoot, 'datasets/test.jsonl'), testRecords);
writeJsonl(path.join(targetRoot, 'datasets/test-with-anomaly.jsonl'), anomalyRecords);
writeJsonl(path.join(targetRoot, 'models/demo_model.jsonl'), [model]);

const verification = spawnSync(process.execPath, [path.join(scriptDir, 'verify-demo-assets.mjs'), targetRoot], {
  stdio: 'inherit',
});

if (verification.status !== 0) {
  process.exit(verification.status || 1);
}

console.log(`Generated synthetic DriftLedger demo assets at ${path.relative(repoRoot, targetRoot)}`);
