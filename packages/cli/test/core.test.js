const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  agentInstruction,
  buildDemoPullPlan,
  buildEndpoint,
  buildWebLoginPlan,
  DEFAULT_DEMO_SCENARIO,
  extractAuthToken,
  HELP,
  parseArgv,
  resolveRuntimeConfig,
} = require('../src/core');

test('parseArgv keeps command path and typed flags stable for agent calls', () => {
  const parsed = parseArgv([
    'dataset',
    'upload',
    '--workspace',
    'sp_001',
    '--dataset',
    'ds_001',
    '--file=orders.csv',
    '--json',
  ]);

  assert.deepEqual(parsed.positionals, ['dataset', 'upload']);
  assert.equal(parsed.flags.workspace, 'sp_001');
  assert.equal(parsed.flags.dataset, 'ds_001');
  assert.equal(parsed.flags.file, 'orders.csv');
  assert.equal(parsed.flags.json, true);
});

test('resolveRuntimeConfig prefers explicit flags over env and stored config', () => {
  const config = resolveRuntimeConfig({
    flags: {apiUrl: 'https://flag.example', token: 'flag-token', workspace: 'sp_flag'},
    env: {
      DRIFTLEDGER_API_URL: 'https://env.example',
      DRIFTLEDGER_TOKEN: 'env-token',
      DRIFTLEDGER_WORKSPACE_ID: 'sp_env',
    },
    stored: {
      apiUrl: 'https://stored.example',
      token: 'stored-token',
      workspace: 'sp_stored',
    },
  });

  assert.deepEqual(config, {
    apiUrl: 'https://flag.example',
    token: 'flag-token',
    workspace: 'sp_flag',
  });
});

test('workspace defaults to Default when no workspace is specified', () => {
  const config = resolveRuntimeConfig({
    flags: {},
    env: {},
    stored: {},
  });

  assert.equal(config.workspace, 'Default');
  assert.equal(
    buildEndpoint(['incidents', 'list']).path,
    '/api/v1/incidents/Default',
  );
});

test('buildEndpoint maps high-level CLI commands to backend atoms', () => {
  assert.equal(
    buildEndpoint(['dataset', 'upload-assembled'], {workspace: 'sp_001', dataset: 'assembled_001'}).path,
    '/api/v1/datasets/upload-assembled-artifact/sp_001/assembled_001',
  );
  assert.equal(
    buildEndpoint(['check-model', 'detail'], {workspace: 'sp_001', id: '42'}).path,
    '/api/v1/model/detail/sp_001/42',
  );
  assert.equal(
    buildEndpoint(['incidents', 'list'], {workspace: 'sp_001'}).path,
    '/api/v1/incidents/sp_001',
  );
  assert.deepEqual(buildEndpoint(['metadata', 'col-types'], {workspace: 'sp_001'}), {
    method: 'GET',
    path: '/api/v1/meta/field/col-types',
  });
  assert.deepEqual(buildEndpoint(['rule', 'types'], {workspace: 'sp_001'}), {
    method: 'GET',
    path: '/api/v1/rule/types',
  });
  assert.deepEqual(buildEndpoint(['rule', 'validate'], {workspace: 'sp_001'}), {
    method: 'POST',
    path: '/api/v1/rule/validate/sp_001',
  });
});

test('buildEndpoint exposes rule training and RuleForest atoms without raw api request', () => {
  assert.deepEqual(buildEndpoint(['infer-task', 'submit'], {workspace: 'sp_001'}), {
    method: 'POST',
    path: '/api/v1/infer-task/submit/sp_001',
  });
  assert.deepEqual(buildEndpoint(['infer-task', 'progress'], {workspace: 'sp_001', task: '77'}), {
    method: 'GET',
    path: '/api/v1/infer-task/get/progress/sp_001/77',
  });
  assert.deepEqual(buildEndpoint(['rule-forest', 'build'], {workspace: 'sp_001'}), {
    method: 'POST',
    path: '/api/v1/rule-forest/build/sp_001',
    body: {},
  });
  assert.deepEqual(buildEndpoint(['rule-forest', 'status'], {workspace: 'sp_001'}), {
    method: 'GET',
    path: '/api/v1/rule-forest/status/sp_001',
  });
});

test('buildEndpoint exposes alert channel and delivery atoms without raw api request', () => {
  assert.deepEqual(
    buildEndpoint(['alerts', 'upsert'], {
      workspace: 'sp_001',
      displayName: 'Finance inbox',
      channelType: 'EMAIL',
      recipient: 'finance@example.com,ops@example.com',
      minSeverity: 'HIGH',
    }),
    {
      method: 'POST',
      path: '/api/v1/alerts/channel/upsert/sp_001',
      body: {
        displayName: 'Finance inbox',
        channelType: 'EMAIL',
        minSeverity: 'HIGH',
        recipients: ['finance@example.com', 'ops@example.com'],
      },
    },
  );
  assert.deepEqual(buildEndpoint(['alerts', 'list'], {workspace: 'sp_001'}), {
    method: 'GET',
    path: '/api/v1/alerts/channel/list/sp_001',
  });
  assert.deepEqual(buildEndpoint(['alerts', 'disable'], {workspace: 'sp_001', channel: 'ch_001'}), {
    method: 'POST',
    path: '/api/v1/alerts/channel/enable/sp_001/ch_001/false',
    body: {},
  });
  assert.deepEqual(buildEndpoint(['alerts', 'test'], {workspace: 'sp_001', channel: 'ch_001'}), {
    method: 'POST',
    path: '/api/v1/alerts/channel/test/sp_001/ch_001',
    body: {},
  });
  assert.deepEqual(buildEndpoint(['alerts', 'deliveries'], {workspace: 'sp_001', task: 'task_77'}), {
    method: 'GET',
    path: '/api/v1/alerts/delivery/list/sp_001?executionTaskId=task_77',
  });
});

test('buildDemoPullPlan prepares downloadable demo assets for installed CLI users', () => {
  const plan = buildDemoPullPlan({
    flags: {out: 'tmp/driftledger-demo', sourceBase: 'https://assets.example/driftledger-demo'},
  });

  assert.equal(plan.scenario, DEFAULT_DEMO_SCENARIO);
  assert.equal(plan.root, path.resolve('tmp/driftledger-demo'));
  assert.deepEqual(
    plan.files.map((file) => file.relativePath),
    [
      'README.md',
      'manifest.json',
      'datasets/train.jsonl',
      'datasets/test.jsonl',
      'datasets/test-with-anomaly.jsonl',
      'models/demo_model.jsonl',
    ],
  );
  assert.equal(plan.files[0].url, 'https://assets.example/driftledger-demo/README.md');
  assert.equal(plan.files.at(-1).outputPath, path.resolve('tmp/driftledger-demo/models/demo_model.jsonl'));
  assert.match(plan.commands.uploadTrain, /dl dataset upload-assembled/);
  assert.match(plan.commands.uploadTrain, /tmp\/driftledger-demo\/datasets\/train\.jsonl/);
  assert.match(plan.commands.uploadAnomalyTest, /test-with-anomaly\.jsonl/);
});

test('buildWebLoginPlan prepares browser login without token capture', () => {
  const plan = buildWebLoginPlan({
    flags: {webUrl: 'https://driftledger-global.fatclaw.com', open: false},
    env: {},
    runtime: {apiUrl: 'https://api.example'},
  });

  assert.equal(plan.loginUrl, 'https://driftledger-global.fatclaw.com/login?source=dl-agent');
  assert.equal(plan.open, false);
  assert.equal(plan.tokenCapture, false);
  assert.match(plan.next.join('\n'), /DRIFTLEDGER_TOKEN/);
});

test('help surfaces the CLI demo download entrypoint', () => {
  assert.match(HELP, /dl demo pull/);
  assert.match(HELP, /rule validate/);
  assert.match(HELP, /auth login --web/);
  assert.doesNotMatch(HELP, /^  driftledger /m);
  assert.doesNotMatch(HELP, /Long-form command/);
});

test('extractAuthToken reads AUTH_TOKEN from set-cookie headers', () => {
  const token = extractAuthToken([
    'LANG=en; Path=/',
    'AUTH_TOKEN=eyJhbGciOiJIUzI1NiJ9.jwt; Max-Age=86400; Path=/; HttpOnly',
  ]);

  assert.equal(token, 'eyJhbGciOiJIUzI1NiJ9.jwt');
});

test('agentInstruction covers Codex, Claude, OpenClaw, and generic agent installs', () => {
  for (const agent of ['codex', 'claude', 'openclaw', 'generic']) {
    const instruction = agentInstruction(agent, {
      apiUrl: 'https://driftledger-global.fatclaw.com',
      workspace: 'sp_demo',
    });

    assert.match(instruction, /dl doctor/);
    assert.match(instruction, /driftledger/);
    assert.match(instruction, /DRIFTLEDGER_API_URL/);
    assert.match(instruction, /DRIFTLEDGER_TOKEN/);
    assert.match(instruction, /command -v dl/);
    assert.match(instruction, /curl -fsSL https:\/\/driftledger-global\.fatclaw\.com\/install\.sh \| bash/);
    assert.match(instruction, /dl config set --workspace sp_demo/);
    assert.doesNotMatch(instruction, /^driftledger /m);
    assert.match(instruction, /skills\/driftledger-cli/);
    assert.match(instruction, /dl metadata col-types/);
    assert.match(instruction, /dl rule types/);
    assert.match(instruction, /dl rule validate/);
    assert.match(instruction, /rule-forest build/);
    assert.match(instruction, /alerts test/);
  }

  const defaultInstruction = agentInstruction('codex', {
    apiUrl: 'https://driftledger-global.fatclaw.com',
  });
  assert.match(defaultInstruction, /dl config set --api-url https:\/\/driftledger-global\.fatclaw\.com/);
  assert.doesNotMatch(defaultInstruction, /--workspace Default/);
  assert.match(defaultInstruction, /DRIFTLEDGER_WORKSPACE_ID="Default"/);
  assert.match(defaultInstruction, /workspace is specified, `dl` uses `Default`/);
});

test('default runtime points to global hosted DriftLedger', () => {
  const config = resolveRuntimeConfig({flags: {}, env: {}, stored: {}});

  assert.equal(config.apiUrl, 'https://driftledger-global.fatclaw.com');
});
