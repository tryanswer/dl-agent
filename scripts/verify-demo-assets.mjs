#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sampleRoot = path.resolve(process.argv[2] || path.join(repoRoot, 'samples/merchant-payment-escrow-reconciliation'));
const findings = [];

const DEMO_TOKEN_PATTERN = /^(acct|identity|name|net|ref|tok|txn)_demo_[a-f0-9]{12}$/;
const SYNTHETIC_BUSINESS_ID_PATTERN =
  /^(MCH|ORD|PAY|ACQ|ESC|REL|CLR|SET|REC)-2026-\d{2}-\d{2}-\d{3,4}(-ANOMALY)?$|^(BUYER|SELLER)-ACCT-2026-\d{4}$|^PLAT-ACCT-ESCROW-CNY$|^SET-2026-\d{2}-\d{2}-\d{3}-MCH-2026-\d{2}-\d{2}-\d{3}$/;
const DEMO_EMAIL_PATTERN = /^user_[a-f0-9]{12}@example\.test$/;
const RAW_BRAND_PATTERN = /支付宝|蚂蚁|alipay|paycore|\b(INSTPAY|BANKCARD|DEBIT_EXPRESS|ICBC|ABC|BOC|CMB|COMM|PSBC)\b/i;
const RAW_SOURCE_PATTERN = /SRC_MODEL_|source\.refund|source\.revoke|source\.payment|source\.fund|internal-source/i;
const LONG_DIGIT_PATTERN = /\d{10,}/;
const LOW_RISK_PATH_PATTERN = /fingerprint|hash|checksum|digest/i;
const HIGH_RISK_KEY_PATTERN =
  /(^|[_\-.])(account|acct|card|cert|address|addr|phone|mobile|email|name)([_\-.]|$)|账号|账户|卡号|证件|地址|手机|姓名|户名/i;

const CONTROLLED_ANOMALIES = {
  ACQUIRING_CAPTURE_AMOUNT_MISMATCH: {
    pairId: 'payment_capture_amount',
    diffCents: 200,
  },
  ESCROW_RELEASE_AMOUNT_MISMATCH: {
    pairId: 'escrow_release_amount',
    diffCents: -300,
  },
  CLEARING_FEE_AMOUNT_MISMATCH: {
    pairId: 'payment_clearing_fee',
    diffCents: 50,
  },
  SETTLEMENT_AMOUNT_MISMATCH: {
    pairId: 'clearing_settlement_amount',
    diffCents: 100,
  },
};

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    if (/\.(json|jsonl)$/i.test(entry.name)) return [fullPath];
    return [];
  });
}

function addFinding(file, line, jsonPath, reason, value) {
  findings.push({
    file: path.relative(repoRoot, file),
    line,
    path: jsonPath,
    reason,
    value: String(value).slice(0, 120),
  });
}

function isAllowedHighRiskValue(value) {
  const stringValue = String(value);
  return (
    stringValue === '' ||
    DEMO_TOKEN_PATTERN.test(stringValue) ||
    SYNTHETIC_BUSINESS_ID_PATTERN.test(stringValue) ||
    DEMO_EMAIL_PATTERN.test(stringValue)
  );
}

function inspectValue({ file, line, key, jsonPath, value }) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectValue({ file, line, key, jsonPath: `${jsonPath}[${index}]`, value: item }));
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      const childPath = jsonPath ? `${jsonPath}.${childKey}` : childKey;
      inspectValue({ file, line, key: childKey, jsonPath: childPath, value: childValue });
    });
    return;
  }

  if (typeof value !== 'string' && typeof value !== 'number') return;
  const stringValue = String(value);
  if (!stringValue) return;

  if (RAW_BRAND_PATTERN.test(stringValue)) {
    addFinding(file, line, jsonPath, 'raw brand/internal marker', value);
  }
  if (RAW_SOURCE_PATTERN.test(stringValue)) {
    addFinding(file, line, jsonPath, 'raw source model/table marker', value);
  }
  if (
    !LOW_RISK_PATH_PATTERN.test(jsonPath) &&
    !isAllowedHighRiskValue(stringValue) &&
    LONG_DIGIT_PATTERN.test(stringValue)
  ) {
    addFinding(file, line, jsonPath, 'long digit sequence', value);
  }
  if (HIGH_RISK_KEY_PATTERN.test(String(key || '')) && !isAllowedHighRiskValue(stringValue)) {
    addFinding(file, line, jsonPath, 'high-risk field is not demo-tokenized', value);
  }
}

function inspectJsonFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  inspectValue({ file, line: 1, key: path.basename(file), jsonPath: '$', value: JSON.parse(content) });
}

function inspectJsonlFile(file) {
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((lineContent, index) => {
      if (!lineContent.trim()) return;
      const parsed = JSON.parse(lineContent);
      inspectValue({
        file,
        line: index + 1,
        key: path.basename(file),
        jsonPath: '$',
        value: parsed,
      });
      inspectAssembledRecord(file, index + 1, parsed);
    });
}

function inspectAssembledRecord(file, line, record) {
  if (!record || typeof record !== 'object' || !record.tableDataMap) return;
  const tableDataMap = record.tableDataMap;
  const value = (table, field) => {
    const rows = tableDataMap[table];
    if (!Array.isArray(rows) || rows.length === 0) return undefined;
    return rows[0]?.dataMap?.[field];
  };
  const merchantOrder = 'driftledger.merchant_order';
  const paymentOrder = 'driftledger.payment_order';
  const acquiringTransaction = 'driftledger.acquiring_transaction';
  const escrowLedger = 'driftledger.escrow_ledger';
  const escrowRelease = 'driftledger.escrow_release';
  const clearingRecord = 'driftledger.clearing_record';
  const settlementRecord = 'driftledger.settlement_record';

  const equalPairs = [
    [`${merchantOrder}#order_no`, value(merchantOrder, 'order_no'), `${paymentOrder}#order_no`, value(paymentOrder, 'order_no')],
    [`${paymentOrder}#payment_id`, value(paymentOrder, 'payment_id'), `${acquiringTransaction}#payment_id`, value(acquiringTransaction, 'payment_id')],
    [`${paymentOrder}#payment_id`, value(paymentOrder, 'payment_id'), `${escrowLedger}#payment_id`, value(escrowLedger, 'payment_id')],
    [`${escrowLedger}#escrow_id`, value(escrowLedger, 'escrow_id'), `${escrowRelease}#escrow_id`, value(escrowRelease, 'escrow_id')],
    [`${paymentOrder}#payment_id`, value(paymentOrder, 'payment_id'), `${clearingRecord}#payment_id`, value(clearingRecord, 'payment_id')],
    [`${clearingRecord}#settlement_batch_no`, value(clearingRecord, 'settlement_batch_no'), `${settlementRecord}#settlement_batch_no`, value(settlementRecord, 'settlement_batch_no')],
    [`${clearingRecord}#merchant_id`, value(clearingRecord, 'merchant_id'), `${settlementRecord}#merchant_id`, value(settlementRecord, 'merchant_id')],
  ];

  equalPairs.forEach(([leftPath, leftValue, rightPath, rightValue]) => {
    if (leftValue !== rightValue) {
      addFinding(file, line, `${leftPath} = ${rightPath}`, 'join key mismatch', `${leftValue} != ${rightValue}`);
    }
  });

  const isAnomalyFile = path.basename(file) === 'test-with-anomaly.jsonl';
  const anomalyType = record.anomaly?.type;
  const anomaly = isAnomalyFile && anomalyType ? CONTROLLED_ANOMALIES[anomalyType] : null;
  if (isAnomalyFile && anomalyType && !anomaly) {
    addFinding(file, line, 'anomaly.type', 'unknown controlled anomaly type', anomalyType);
  }
  if (!isAnomalyFile && anomalyType) {
    addFinding(file, line, 'anomaly.type', 'anomaly marker outside anomaly file', anomalyType);
  }

  const paymentPaid = value(paymentOrder, 'payment_status') === 'PAID';
  const acquiringCaptured = value(acquiringTransaction, 'acquiring_status') === 'CAPTURED';
  const escrowHeld = value(escrowLedger, 'escrow_status') === 'HELD';
  const releaseReleased = value(escrowRelease, 'release_status') === 'RELEASED';
  const clearingCleared = value(clearingRecord, 'clearing_status') === 'CLEARED';
  const settlementSettled = value(settlementRecord, 'settlement_status') === 'SETTLED';

  const amountPairs = [
    {
      pairId: 'payment_capture_amount',
      leftPath: `${paymentOrder}#payment_amount`,
      leftValue: value(paymentOrder, 'payment_amount'),
      rightPath: `${acquiringTransaction}#capture_amount`,
      rightValue: value(acquiringTransaction, 'capture_amount'),
      active: paymentPaid && acquiringCaptured,
    },
    {
      pairId: 'payment_escrow_amount',
      leftPath: `${paymentOrder}#payment_amount`,
      leftValue: value(paymentOrder, 'payment_amount'),
      rightPath: `${escrowLedger}#escrow_amount`,
      rightValue: value(escrowLedger, 'escrow_amount'),
      active: paymentPaid && escrowHeld,
    },
    {
      pairId: 'escrow_release_amount',
      leftPath: `${escrowLedger}#escrow_amount`,
      leftValue: value(escrowLedger, 'escrow_amount'),
      rightPath: `${escrowRelease}#release_amount`,
      rightValue: value(escrowRelease, 'release_amount'),
      active: escrowHeld && releaseReleased,
    },
    {
      pairId: 'payment_clearing_net',
      leftPath: `${paymentOrder}#net_amount`,
      leftValue: value(paymentOrder, 'net_amount'),
      rightPath: `${clearingRecord}#net_amount`,
      rightValue: value(clearingRecord, 'net_amount'),
      active: paymentPaid && clearingCleared,
    },
    {
      pairId: 'payment_clearing_fee',
      leftPath: `${paymentOrder}#fee_amount`,
      leftValue: value(paymentOrder, 'fee_amount'),
      rightPath: `${clearingRecord}#fee_amount`,
      rightValue: value(clearingRecord, 'fee_amount'),
      active: paymentPaid && clearingCleared,
    },
    {
      pairId: 'clearing_settlement_amount',
      leftPath: `${clearingRecord}#net_amount`,
      leftValue: value(clearingRecord, 'net_amount'),
      rightPath: `${settlementRecord}#settlement_amount`,
      rightValue: value(settlementRecord, 'settlement_amount'),
      active: clearingCleared && settlementSettled,
    },
  ];

  amountPairs.forEach((pair) => {
    if (!pair.active) return;
    const diffCents = Math.round(Number(pair.rightValue) * 100) - Math.round(Number(pair.leftValue) * 100);
    if (anomaly?.pairId === pair.pairId) {
      if (diffCents !== anomaly.diffCents) {
        addFinding(file, line, `${pair.leftPath} = ${pair.rightPath}`,
          'controlled anomaly has unexpected amount delta', `${pair.leftValue} != ${pair.rightValue}`);
      }
      return;
    }
    if (pair.leftValue !== pair.rightValue) {
      addFinding(file, line, `${pair.leftPath} = ${pair.rightPath}`,
        'unexpected amount mismatch for active success-condition rule', `${pair.leftValue} != ${pair.rightValue}`);
    }
  });
}

if (!fs.existsSync(sampleRoot)) {
  console.error(`Sample root does not exist: ${sampleRoot}`);
  process.exit(1);
}

const files = walkFiles(sampleRoot);
files.forEach((file) => {
  if (file.endsWith('.jsonl')) inspectJsonlFile(file);
  else inspectJsonFile(file);
});

if (findings.length > 0) {
  console.error('Demo asset privacy verification failed:');
  findings.slice(0, 30).forEach((finding) => {
    console.error(
      `- ${finding.file}:${finding.line} ${finding.path} ${finding.reason}: ${finding.value}`,
    );
  });
  if (findings.length > 30) {
    console.error(`... ${findings.length - 30} more findings omitted`);
  }
  process.exit(1);
}

console.log(`Verified ${files.length} demo asset files under ${path.relative(repoRoot, sampleRoot)}`);
