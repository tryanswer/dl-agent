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
const trainRecordCount = 160;
const testRecordCount = 24;
const testRecordOffset = 240;

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

const scenarioProfiles = [
  {
    code: 'CARD_GOODS_ESCROW_RELEASED',
    description: 'Card acquiring payment for physical goods after delivery confirmation',
    paymentMethod: 'CARD',
    orderStatus: 'PAID',
    paymentStatus: 'PAID',
    acquiringStatus: 'CAPTURED',
    escrowStatus: 'HELD',
    releaseStatus: 'RELEASED',
    clearingStatus: 'CLEARED',
    settlementStatus: 'SETTLED',
    captured: true,
    held: true,
    released: true,
    cleared: true,
    settled: true,
  },
  {
    code: 'WALLET_DIGITAL_SERVICE_RELEASED',
    description: 'Wallet payment for digital service with instant buyer confirmation',
    paymentMethod: 'WALLET',
    orderStatus: 'PAID',
    paymentStatus: 'PAID',
    acquiringStatus: 'CAPTURED',
    escrowStatus: 'HELD',
    releaseStatus: 'RELEASED',
    clearingStatus: 'CLEARED',
    settlementStatus: 'SETTLED',
    captured: true,
    held: true,
    released: true,
    cleared: true,
    settled: true,
  },
  {
    code: 'BANK_TRANSFER_B2B_ESCROW_RELEASED',
    description: 'Bank transfer payment for B2B order released after acceptance',
    paymentMethod: 'BANK_TRANSFER',
    orderStatus: 'PAID',
    paymentStatus: 'PAID',
    acquiringStatus: 'CAPTURED',
    escrowStatus: 'HELD',
    releaseStatus: 'RELEASED',
    clearingStatus: 'CLEARED',
    settlementStatus: 'SETTLED',
    captured: true,
    held: true,
    released: true,
    cleared: true,
    settled: true,
  },
  {
    code: 'CARD_AUTHORIZATION_FAILED',
    description: 'Card acquiring payment rejected before capture',
    paymentMethod: 'CARD',
    orderStatus: 'PAYMENT_FAILED',
    paymentStatus: 'FAILED',
    acquiringStatus: 'DECLINED',
    escrowStatus: 'NOT_HELD',
    releaseStatus: 'NOT_RELEASED',
    clearingStatus: 'NOT_CLEARED',
    settlementStatus: 'NOT_SETTLED',
    captured: false,
    held: false,
    released: false,
    cleared: false,
    settled: false,
  },
  {
    code: 'BUYER_CANCELLED_BEFORE_CAPTURE',
    description: 'Buyer cancels order before payment capture',
    paymentMethod: 'WALLET',
    orderStatus: 'CANCELED',
    paymentStatus: 'CANCELED',
    acquiringStatus: 'CANCELED',
    escrowStatus: 'NOT_HELD',
    releaseStatus: 'NOT_RELEASED',
    clearingStatus: 'NOT_CLEARED',
    settlementStatus: 'NOT_SETTLED',
    captured: false,
    held: false,
    released: false,
    cleared: false,
    settled: false,
  },
  {
    code: 'ESCROW_AWAITING_BUYER_CONFIRMATION',
    description: 'Payment captured and held in escrow before buyer confirmation',
    paymentMethod: 'CARD',
    orderStatus: 'AWAITING_CONFIRMATION',
    paymentStatus: 'PAID',
    acquiringStatus: 'CAPTURED',
    escrowStatus: 'HELD',
    releaseStatus: 'PENDING_CONFIRMATION',
    clearingStatus: 'PENDING',
    settlementStatus: 'PENDING',
    captured: true,
    held: true,
    released: false,
    cleared: false,
    settled: false,
  },
  {
    code: 'CLEARING_DELAYED_AFTER_RELEASE',
    description: 'Escrow released but clearing and merchant settlement are delayed',
    paymentMethod: 'BANK_TRANSFER',
    orderStatus: 'RELEASED',
    paymentStatus: 'PAID',
    acquiringStatus: 'CAPTURED',
    escrowStatus: 'HELD',
    releaseStatus: 'RELEASED',
    clearingStatus: 'PENDING',
    settlementStatus: 'PENDING',
    captured: true,
    held: true,
    released: true,
    cleared: false,
    settled: false,
  },
];

const profilePlan = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 0, 5];

function pad(value, size = 4) {
  return String(value).padStart(size, '0');
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

function minutesAt(day, index, offsetMinutes = 0) {
  const localIndex = index % 24;
  const hour = 9 + Math.floor(localIndex / 4);
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

function scenarioProfile(index) {
  return scenarioProfiles[profilePlan[index % profilePlan.length]];
}

function buildRecord(index, split, splitIndex = index) {
  const day = split === 'train' ? 2 + Math.floor(splitIndex / 12) : 12 + Math.floor(splitIndex / 6);
  const merchant = merchants[index % merchants.length];
  const profile = scenarioProfile(splitIndex);
  const amountCents = orderAmounts[index % orderAmounts.length] + Math.floor(index / orderAmounts.length) * 310;
  const fee = feeCents(amountCents, merchant.feeBps);
  const net = amountCents - fee;
  const capturedAmountCents = profile.captured ? amountCents : 0;
  const capturedFeeCents = profile.captured ? fee : 0;
  const capturedNetCents = profile.captured ? net : 0;
  const escrowAmountCents = profile.held ? amountCents : 0;
  const releaseAmountCents = profile.released ? amountCents : 0;
  const clearingAmountCents = profile.cleared ? amountCents : 0;
  const clearingFeeCents = profile.cleared ? fee : 0;
  const clearingNetCents = profile.cleared ? net : 0;
  const settlementGrossCents = profile.settled ? amountCents : 0;
  const settlementFeeCents = profile.settled ? fee : 0;
  const settlementCents = profile.settled ? net : 0;
  const suffix = pad(index + 1);
  const orderNo = `ORD-2026-06-${pad(day, 2)}-${suffix}`;
  const paymentId = `PAY-2026-06-${pad(day, 2)}-${suffix}`;
  const acquiringId = `ACQ-2026-06-${pad(day, 2)}-${suffix}`;
  const escrowId = `ESC-2026-06-${pad(day, 2)}-${suffix}`;
  const releaseId = `REL-2026-06-${pad(day, 2)}-${suffix}`;
  const clearingRefNo = `CLR-2026-06-${pad(day, 2)}-${suffix}`;
  const settlementBatchNo = `SET-2026-06-${pad(day, 2)}-${pad(Math.floor(splitIndex / 6) + 1, 3)}`;
  const buyerAccountId = `BUYER-ACCT-2026-${pad((index % 30) + 1)}`;
  const sellerAccountId = `SELLER-ACCT-2026-${pad((index % 12) + 1)}`;
  const platformEscrowAccountId = 'PLAT-ACCT-ESCROW-CNY';
  const createdAt = minutesAt(day, splitIndex);
  const paidAt = minutesAt(day, splitIndex, 3);
  const confirmedAt = minutesAt(day + 1, splitIndex, 11);
  const clearedAt = minutesAt(day + 1, splitIndex, 17);
  const settledAt = minutesAt(day + 2, splitIndex, 23);

  return {
    empty: false,
    modelId,
    recordId: `REC-2026-06-${pad(day, 2)}-${suffix}`,
    scenario: profile.code,
    scenarioDescription: profile.description,
    records: [],
    tableDataMap: {
      [tables.merchantOrder]: [
        row(tables.merchantOrder, orderNo, {
          order_no: orderNo,
          business_scene: profile.code,
          scenario_description: profile.description,
          merchant_id: merchant.id,
          merchant_label: merchant.label,
          buyer_account_id: buyerAccountId,
          seller_account_id: sellerAccountId,
          order_amount: money(amountCents),
          currency: 'CNY',
          order_status: profile.orderStatus,
          created_at: createdAt,
        }),
      ],
      [tables.paymentOrder]: [
        row(tables.paymentOrder, paymentId, {
          payment_id: paymentId,
          order_no: orderNo,
          business_scene: profile.code,
          scenario_description: profile.description,
          merchant_id: merchant.id,
          buyer_account_id: buyerAccountId,
          payment_amount: money(amountCents),
          fee_amount: money(capturedFeeCents),
          net_amount: money(capturedNetCents),
          currency: 'CNY',
          payment_method: profile.paymentMethod,
          payment_status: profile.paymentStatus,
          paid_at: paidAt,
        }),
      ],
      [tables.acquiringTransaction]: [
        row(tables.acquiringTransaction, acquiringId, {
          acquiring_id: acquiringId,
          payment_id: paymentId,
          business_scene: profile.code,
          merchant_id: merchant.id,
          capture_amount: money(capturedAmountCents),
          fee_amount: money(capturedFeeCents),
          net_amount: money(capturedNetCents),
          currency: 'CNY',
          acquiring_status: profile.acquiringStatus,
          captured_at: paidAt,
        }),
      ],
      [tables.escrowLedger]: [
        row(tables.escrowLedger, escrowId, {
          escrow_id: escrowId,
          payment_id: paymentId,
          order_no: orderNo,
          business_scene: profile.code,
          buyer_account_id: buyerAccountId,
          seller_account_id: sellerAccountId,
          platform_escrow_account_id: platformEscrowAccountId,
          escrow_amount: money(escrowAmountCents),
          currency: 'CNY',
          escrow_status: profile.escrowStatus,
          held_at: paidAt,
        }),
      ],
      [tables.escrowRelease]: [
        row(tables.escrowRelease, releaseId, {
          release_id: releaseId,
          escrow_id: escrowId,
          order_no: orderNo,
          business_scene: profile.code,
          seller_account_id: sellerAccountId,
          release_amount: money(releaseAmountCents),
          currency: 'CNY',
          release_status: profile.releaseStatus,
          confirmed_at: confirmedAt,
        }),
      ],
      [tables.clearingRecord]: [
        row(tables.clearingRecord, clearingRefNo, {
          clearing_ref_no: clearingRefNo,
          payment_id: paymentId,
          acquiring_id: acquiringId,
          settlement_batch_no: settlementBatchNo,
          business_scene: profile.code,
          merchant_id: merchant.id,
          clearing_amount: money(clearingAmountCents),
          fee_amount: money(clearingFeeCents),
          net_amount: money(clearingNetCents),
          currency: 'CNY',
          clearing_status: profile.clearingStatus,
          cleared_at: clearedAt,
        }),
      ],
      [tables.settlementRecord]: [
        row(tables.settlementRecord, `${settlementBatchNo}-${merchant.id}`, {
          settlement_batch_no: settlementBatchNo,
          merchant_id: merchant.id,
          business_scene: profile.code,
          seller_account_id: sellerAccountId,
          gross_amount: money(settlementGrossCents),
          fee_amount: money(settlementFeeCents),
          settlement_amount: money(settlementCents),
          currency: 'CNY',
          settlement_status: profile.settlementStatus,
          settled_at: settledAt,
        }),
      ],
    },
  };
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

function withAnomaly(record, type) {
  const anomaly = cloneRecord(record);
  anomaly.recordId = `${record.recordId}-ANOMALY`;
  const preservedJoinKeys = [
    `${tables.merchantOrder}#order_no`,
    `${tables.paymentOrder}#order_no`,
    `${tables.paymentOrder}#payment_id`,
    `${tables.acquiringTransaction}#payment_id`,
    `${tables.escrowLedger}#payment_id`,
    `${tables.escrowLedger}#escrow_id`,
    `${tables.escrowRelease}#escrow_id`,
    `${tables.clearingRecord}#payment_id`,
    `${tables.clearingRecord}#settlement_batch_no`,
    `${tables.settlementRecord}#settlement_batch_no`,
    `${tables.settlementRecord}#merchant_id`,
  ];

  if (type === 'ACQUIRING_CAPTURE_AMOUNT_MISMATCH') {
    const rowData = anomaly.tableDataMap[tables.acquiringTransaction][0].dataMap;
    rowData.capture_amount = money(Math.round(Number(rowData.capture_amount) * 100) + 200);
    anomaly.anomaly = {
      type,
      reason: 'captured amount is 2.00 CNY higher than the paid amount',
      changedField: `${tables.acquiringTransaction}#capture_amount`,
      preservedJoinKeys,
    };
    return anomaly;
  }

  if (type === 'ESCROW_RELEASE_AMOUNT_MISMATCH') {
    const rowData = anomaly.tableDataMap[tables.escrowRelease][0].dataMap;
    rowData.release_amount = money(Math.round(Number(rowData.release_amount) * 100) - 300);
    anomaly.anomaly = {
      type,
      reason: 'released escrow amount is 3.00 CNY lower than the held amount',
      changedField: `${tables.escrowRelease}#release_amount`,
      preservedJoinKeys,
    };
    return anomaly;
  }

  if (type === 'CLEARING_FEE_AMOUNT_MISMATCH') {
    const rowData = anomaly.tableDataMap[tables.clearingRecord][0].dataMap;
    rowData.fee_amount = money(Math.round(Number(rowData.fee_amount) * 100) + 50);
    anomaly.anomaly = {
      type,
      reason: 'clearing fee is 0.50 CNY higher than payment fee',
      changedField: `${tables.clearingRecord}#fee_amount`,
      preservedJoinKeys,
    };
    return anomaly;
  }

  const settlementRow = anomaly.tableDataMap[tables.settlementRecord][0].dataMap;
  settlementRow.settlement_amount = money(Math.round(Number(settlementRow.settlement_amount) * 100) + 100);
  anomaly.anomaly = {
    type: 'SETTLEMENT_AMOUNT_MISMATCH',
    reason: 'settlement amount is 1.00 CNY higher than clearing net amount',
    changedField: `${tables.settlementRecord}#settlement_amount`,
    preservedJoinKeys,
  };
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

const trainRecords = Array.from({ length: trainRecordCount }, (_, index) => buildRecord(index, 'train', index));
const testRecords = Array.from({ length: testRecordCount }, (_, index) => (
  buildRecord(index + testRecordOffset, 'test', index)
));
const anomalyByIndex = new Map([
  [0, 'ACQUIRING_CAPTURE_AMOUNT_MISMATCH'],
  [1, 'ESCROW_RELEASE_AMOUNT_MISMATCH'],
  [2, 'CLEARING_FEE_AMOUNT_MISMATCH'],
  [7, 'SETTLEMENT_AMOUNT_MISMATCH'],
]);
const anomalyRecords = Array.from(anomalyByIndex.entries()).map(([index, anomalyType]) => (
  withAnomaly(testRecords[index], anomalyType)
));

const manifest = {
  product: 'driftledger',
  scenario: sampleName,
  syntheticData: true,
  sourceCompanyDataIncluded: false,
  demoModelId: modelId,
  modelVersion,
  recordCount: trainRecords.length + testRecords.length + anomalyRecords.length,
  trainCount: trainRecords.length,
  testCount: testRecords.length,
  anomalyCount: anomalyRecords.length,
  generatedAt,
  businessFlows: [
    'Merchant acquiring payment',
    'Payment failure and buyer cancellation',
    'Escrow hold after successful payment',
    'Escrow release after buyer confirmation',
    'Escrow pending confirmation',
    'Clearing delayed after release',
    'Clearing and merchant settlement',
  ],
  scenarioProfiles: scenarioProfiles.map((profile) => ({
    code: profile.code,
    description: profile.description,
    orderStatus: profile.orderStatus,
    paymentStatus: profile.paymentStatus,
    acquiringStatus: profile.acquiringStatus,
    escrowStatus: profile.escrowStatus,
    releaseStatus: profile.releaseStatus,
    clearingStatus: profile.clearingStatus,
    settlementStatus: profile.settlementStatus,
  })),
  controlledAnomalies: Array.from(anomalyByIndex.entries()).map(([index, type], anomalyRecordIndex) => ({
    sourceTestRecordIndex: index,
    anomalyRecordIndex,
    type,
  })),
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
2. The payment order can succeed, fail, be canceled, or wait for confirmation.
3. Successful payments are captured by the acquiring transaction.
4. Captured payments are held in escrow until buyer confirmation.
5. Released escrow funds move into clearing and merchant settlement.
6. Failed, canceled, pending-confirmation, and delayed-clearing rows keep the same join keys but should not satisfy success-only amount rules.

## Scenario Profiles

- \`CARD_GOODS_ESCROW_RELEASED\`: successful card payment, escrow release, clearing, and settlement.
- \`WALLET_DIGITAL_SERVICE_RELEASED\`: successful wallet payment with instant confirmation.
- \`BANK_TRANSFER_B2B_ESCROW_RELEASED\`: successful B2B transfer released after acceptance.
- \`CARD_AUTHORIZATION_FAILED\`: card payment rejected before capture.
- \`BUYER_CANCELLED_BEFORE_CAPTURE\`: buyer cancels before capture.
- \`ESCROW_AWAITING_BUYER_CONFIRMATION\`: paid and held in escrow, but not released.
- \`CLEARING_DELAYED_AFTER_RELEASE\`: escrow released, but clearing and settlement remain pending.

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
- \`datasets/test-with-anomaly.jsonl\`: four anomaly-only records for incident verification.
- \`manifest.json\`: generation metadata, join keys, counts, and privacy notes.

## Controlled Anomalies

\`datasets/test-with-anomaly.jsonl\` contains only four success-chain records
with injected field mismatches. It keeps all join keys intact:

- \`ACQUIRING_CAPTURE_AMOUNT_MISMATCH\`: acquiring captured amount differs from payment amount.
- \`ESCROW_RELEASE_AMOUNT_MISMATCH\`: release amount differs from held escrow amount.
- \`CLEARING_FEE_AMOUNT_MISMATCH\`: clearing fee differs from payment fee.
- \`SETTLEMENT_AMOUNT_MISMATCH\`: merchant settlement differs from clearing net amount.

Run \`npm run verify:samples\` from the repository root before publishing sample updates. The verifier checks privacy patterns, join-key integrity, success-only amount rules, status-driven preconditions, and controlled anomaly shape.
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
