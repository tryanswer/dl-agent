const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_API_URL = 'http://localhost:8088';
const DEFAULT_WORKSPACE = 'Default';
const AUTH_COOKIE = 'AUTH_TOKEN';
const CONFIG_DIR = path.join(os.homedir(), '.driftledger');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

class DriftLedgerCliError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DriftLedgerCliError';
    this.details = details;
  }
}

function parseArgv(argv) {
  const positionals = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    if (token.startsWith('--no-')) {
      setFlag(flags, toCamelCase(token.slice(5)), false);
      continue;
    }

    const raw = token.slice(2);
    const equalsIndex = raw.indexOf('=');
    if (equalsIndex >= 0) {
      setFlag(flags, toCamelCase(raw.slice(0, equalsIndex)), parseScalar(raw.slice(equalsIndex + 1)));
      continue;
    }

    const key = toCamelCase(raw);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      setFlag(flags, key, parseScalar(next));
      index += 1;
    } else {
      setFlag(flags, key, true);
    }
  }

  return {positionals, flags};
}

function setFlag(flags, key, value) {
  if (Object.hasOwn(flags, key)) {
    flags[key] = Array.isArray(flags[key]) ? [...flags[key], value] : [flags[key], value];
    return;
  }
  flags[key] = value;
}

function toCamelCase(input) {
  return input.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function parseScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value;
}

function loadStoredConfig(configPath = CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveStoredConfig(nextConfig, configPath = CONFIG_PATH) {
  fs.mkdirSync(path.dirname(configPath), {recursive: true});
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, {mode: 0o600});
}

function resolveRuntimeConfig({flags = {}, env = process.env, stored = {}} = {}) {
  const apiUrl = stripTrailingSlash(
    firstPresent(flags.apiUrl, env.DRIFTLEDGER_API_URL, stored.apiUrl, DEFAULT_API_URL),
  );
  const token = firstPresent(flags.token, env.DRIFTLEDGER_TOKEN, stored.token);
  const workspace = firstPresent(
    flags.workspace,
    flags.workspaceId,
    env.DRIFTLEDGER_WORKSPACE_ID,
    stored.workspace,
    stored.workspaceId,
    DEFAULT_WORKSPACE,
  );

  return {apiUrl, token, workspace};
}

function stripTrailingSlash(value) {
  return String(value || DEFAULT_API_URL).replace(/\/+$/, '');
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function requireValue(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new DriftLedgerCliError(`Missing required option: --${name}`);
  }
  return value;
}

function requireWorkspace(flags, runtime = {}) {
  return requireValue(firstPresent(flags.workspace, flags.workspaceId, runtime.workspace, DEFAULT_WORKSPACE), 'workspace');
}

function encodePath(value) {
  return encodeURIComponent(String(value));
}

function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function parseJsonOption(value, optionName) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new DriftLedgerCliError(`--${optionName} must be valid JSON`, {cause: error.message});
  }
}

function numberOption(value, optionName) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new DriftLedgerCliError(`--${optionName} must be a number`);
  }
  return numeric;
}

function bodyFromKnownFlags(flags, keys) {
  const body = {};
  for (const key of keys) {
    if (flags[key] !== undefined) {
      body[key] = flags[key];
    }
  }
  return Object.keys(body).length ? body : undefined;
}

function buildEndpoint(positionals, flags = {}, runtime = {}) {
  const [scope, action = 'list'] = positionals;
  const workspace = () => encodePath(requireWorkspace(flags, runtime));
  const page = () => encodePath(firstPresent(flags.page, 0));
  const pageSize = () => encodePath(firstPresent(flags.pageSize, 20));
  const id = (name = 'id') => encodePath(requireValue(flags[name], name));
  const datasetId = () => encodePath(requireValue(flags.dataset || flags.datasetId, 'dataset'));
  const taskId = () => encodePath(requireValue(flags.task || flags.taskId, 'task'));
  const channelId = () => encodePath(requireValue(firstPresent(flags.channel, flags.channelId, flags.id), 'channel'));

  if (!scope || scope === 'help') {
    return {kind: 'help'};
  }

  if (scope === 'auth') {
    if (action === 'login') {
      return {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: bodyFromKnownFlags(flags, ['email', 'password', 'captcha', 'captchaId']),
        captureToken: true,
      };
    }
    if (action === 'verify') return {method: 'GET', path: '/api/v1/token/verify'};
    if (action === 'refresh') return {method: 'GET', path: '/api/v1/token/refresh', captureToken: true};
  }

  if (scope === 'workspace' || scope === 'ws') {
    if (action === 'create' || action === 'add') {
      return {method: 'POST', path: '/api/v1/ws/add', body: bodyFromKnownFlags(flags, ['name', 'demo'])};
    }
    if (action === 'list') return {method: 'POST', path: '/api/v1/ws/list', body: {}};
    if (action === 'get') return {method: 'GET', path: `/api/v1/ws/get/${workspace()}`};
    if (action === 'activate') {
      return {method: 'POST', path: `/api/v1/ws/active/${workspace()}/true`, body: {}};
    }
    if (action === 'close') return {method: 'POST', path: `/api/v1/ws/active/${workspace()}/false`, body: {}};
  }

  if (scope === 'metadata' || scope === 'meta') {
    if (action === 'upsert' || action === 'add') return {method: 'POST', path: `/api/v1/meta/add/${workspace()}`};
    if (action === 'tables' || action === 'list') {
      return {method: 'POST', path: `/api/v1/meta/list/table/${workspace()}/${page()}/${pageSize()}`, body: {}};
    }
    if (action === 'table') return {method: 'GET', path: `/api/v1/meta/info/table/${workspace()}/${id('table')}`};
    if (action === 'fields') return {method: 'POST', path: `/api/v1/meta/list/field/${workspace()}/${id('table')}`, body: {}};
  }

  if (scope === 'data-source' || scope === 'source') {
    if (action === 'upsert') {
      return {
        method: 'POST',
        path: `/api/v1/data-source/upsert/${workspace()}`,
        body: {
          ...bodyFromKnownFlags(flags, ['id', 'displayName', 'type', 'connectionRef']),
          ...(flags.config ? {config: parseJsonOption(flags.config, 'config')} : {}),
        },
      };
    }
    if (action === 'list') return {method: 'GET', path: `/api/v1/data-source/list/${workspace()}`};
  }

  if (scope === 'source-binding' || scope === 'binding') {
    if (action === 'upsert') {
      return {
        method: 'POST',
        path: `/api/v1/source-binding/upsert/${workspace()}`,
        body: buildSourceBindingBody(flags),
      };
    }
    if (action === 'list') return {method: 'GET', path: `/api/v1/source-binding/list/${workspace()}`};
  }

  if (scope === 'dataset' || scope === 'datasets') {
    if (action === 'create-raw' || action === 'raw-draft') {
      return {
        method: 'POST',
        path: `/api/v1/datasets/raw-draft/${workspace()}`,
        body: {
          displayName: requireValue(firstPresent(flags.displayName, flags.name), 'display-name'),
          bindingIds: asArray(firstPresent(flags.bindingId, flags.bindingIds)),
        },
      };
    }
    if (action === 'create-assembled' || action === 'assembled-draft') {
      return {
        method: 'POST',
        path: `/api/v1/datasets/assembled-draft/${workspace()}`,
        body: {displayName: requireValue(firstPresent(flags.displayName, flags.name), 'display-name')},
      };
    }
    if (action === 'list') {
      return {method: 'POST', path: `/api/v1/datasets/list/${workspace()}/${page()}/${pageSize()}`, body: {}};
    }
    if (action === 'detail') return {method: 'GET', path: `/api/v1/datasets/detail/${workspace()}/${datasetId()}`};
    if (action === 'upload') {
      return {
        method: 'POST',
        path: `/api/v1/datasets/upload-artifact/${workspace()}/${datasetId()}`,
        upload: true,
      };
    }
    if (action === 'upload-assembled') {
      return {
        method: 'POST',
        path: `/api/v1/datasets/upload-assembled-artifact/${workspace()}/${datasetId()}`,
        upload: true,
      };
    }
    if (action === 'download') {
      return {
        method: 'GET',
        path: `/api/v1/datasets/artifact/${workspace()}/${datasetId()}/${id('artifact')}`,
        download: true,
      };
    }
  }

  if (scope === 'check-model' || scope === 'model') {
    if (action === 'create' || action === 'add') return {method: 'POST', path: `/api/v1/model/add/${workspace()}`};
    if (action === 'update') return {method: 'PUT', path: `/api/v1/model/update/${workspace()}`};
    if (action === 'deploy') return {method: 'POST', path: `/api/v1/model/deploy/${workspace()}/${id()}`, body: {}};
    if (action === 'enable') return {method: 'POST', path: `/api/v1/model/enable/${workspace()}/${id()}`, body: {}};
    if (action === 'offline') return {method: 'POST', path: `/api/v1/model/offline/${workspace()}/${id()}`, body: {}};
    if (action === 'list') {
      return {method: 'GET', path: `/api/v1/model/list/${workspace()}/${encodePath(requireValue(flags.code || flags.modelCode, 'code'))}`};
    }
    if (action === 'detail' && flags.code) {
      return {method: 'GET', path: `/api/v1/model/detail/code/${workspace()}/${encodePath(flags.code)}`};
    }
    if (action === 'detail') return {method: 'GET', path: `/api/v1/model/detail/${workspace()}/${id()}`};
  }

  if (scope === 'rule' || scope === 'rules') {
    if (action === 'add' || action === 'create') return {method: 'POST', path: `/api/v1/rule/add/${workspace()}`};
    if (action === 'update') return {method: 'PUT', path: `/api/v1/rule/update/${workspace()}`};
    if (action === 'list') {
      return {method: 'POST', path: `/api/v1/rule/list/${workspace()}/${page()}/${pageSize()}`, body: {}};
    }
    if (action === 'get') return {method: 'GET', path: `/api/v1/rule/get/${workspace()}/${id()}`};
    if (action === 'enable') {
      return {method: 'POST', path: `/api/v1/rule/enable/${workspace()}/${id()}/true`, body: {}};
    }
    if (action === 'disable') {
      return {method: 'POST', path: `/api/v1/rule/enable/${workspace()}/${id()}/false`, body: {}};
    }
    if (action === 'delete') return {method: 'DELETE', path: `/api/v1/rule/delete/${workspace()}/${id()}`};
  }

  if (scope === 'assembly') {
    if (action === 'submit') return {method: 'POST', path: `/api/v1/assembly/submit/${workspace()}`};
    if (action === 'run') return {method: 'POST', path: `/api/v1/assembly/run/${workspace()}/${taskId()}`, body: {}};
  }

  if (scope === 'infer-task' || scope === 'training' || scope === 'rule-training') {
    if (action === 'submit' || action === 'create') {
      return {method: 'POST', path: `/api/v1/infer-task/submit/${workspace()}`};
    }
    if (action === 'update') return {method: 'PUT', path: `/api/v1/infer-task/update/${workspace()}`};
    if (action === 'list') {
      return {method: 'POST', path: `/api/v1/infer-task/list/${workspace()}/${page()}/${pageSize()}`, body: {}};
    }
    if (action === 'status' || action === 'get-status') {
      return {method: 'GET', path: `/api/v1/infer-task/get/status/${workspace()}/${taskId()}`};
    }
    if (action === 'progress' || action === 'get-progress') {
      return {method: 'GET', path: `/api/v1/infer-task/get/progress/${workspace()}/${taskId()}`};
    }
    if (action === 'cancel') return {method: 'POST', path: `/api/v1/infer-task/cancel/${workspace()}/${taskId()}`, body: {}};
    if (action === 'reset') return {method: 'POST', path: `/api/v1/infer-task/reset/${workspace()}/${taskId()}`, body: {}};
    if (action === 'pause') return {method: 'POST', path: `/api/v1/infer-task/pause/${workspace()}/${taskId()}`, body: {}};
    if (action === 'resume') return {method: 'POST', path: `/api/v1/infer-task/resume/${workspace()}/${taskId()}`, body: {}};
    if (action === 'delete') return {method: 'DELETE', path: `/api/v1/infer-task/delete/${workspace()}/${taskId()}`};
  }

  if (scope === 'rule-forest' || scope === 'ruleforest') {
    if (action === 'build' || action === 'rebuild') {
      return {method: 'POST', path: `/api/v1/rule-forest/build/${workspace()}`, body: {}};
    }
    if (action === 'status') return {method: 'GET', path: `/api/v1/rule-forest/status/${workspace()}`};
  }

  if (scope === 'run' || scope === 'execution') {
    if (action === 'submit') return {method: 'POST', path: `/api/v1/execution/submit/${workspace()}`};
    if (action === 'run') return {method: 'POST', path: `/api/v1/execution/run/${workspace()}/${taskId()}`, body: {}};
    if (action === 'indexes') {
      return {method: 'GET', path: `/api/v1/execution/results/${workspace()}/${taskId()}/indexes`};
    }
  }

  if (scope === 'incidents' || scope === 'incident') {
    if (action === 'list') return {method: 'GET', path: `/api/v1/incidents/${workspace()}`};
    if (action === 'task') return {method: 'GET', path: `/api/v1/incidents/${workspace()}/tasks/${taskId()}`};
    if (action === 'get') return {method: 'GET', path: `/api/v1/incidents/${workspace()}/${id('incident')}`};
    if (action === 'actions') {
      return {method: 'GET', path: `/api/v1/incidents/${workspace()}/${id('incident')}/actions`};
    }
  }

  if (scope === 'alerts' || scope === 'alert') {
    if (action === 'upsert' || action === 'create' || action === 'update') {
      return {
        method: 'POST',
        path: `/api/v1/alerts/channel/upsert/${workspace()}`,
        body: buildAlertChannelBody(flags),
      };
    }
    if (action === 'list' || action === 'channels') {
      return {method: 'GET', path: `/api/v1/alerts/channel/list/${workspace()}`};
    }
    if (action === 'enable' || action === 'disable') {
      const enabled = action === 'disable' ? false : firstPresent(flags.enabled, flags.enable, true);
      return {
        method: 'POST',
        path: `/api/v1/alerts/channel/enable/${workspace()}/${channelId()}/${encodePath(enabled)}`,
        body: {},
      };
    }
    if (action === 'test') {
      return {method: 'POST', path: `/api/v1/alerts/channel/test/${workspace()}/${channelId()}`, body: {}};
    }
    if (action === 'deliveries' || action === 'delivery' || action === 'logs') {
      const executionTaskId = firstPresent(flags.executionTaskId, flags.task, flags.taskId);
      const query = executionTaskId ? `?executionTaskId=${encodePath(executionTaskId)}` : '';
      return {method: 'GET', path: `/api/v1/alerts/delivery/list/${workspace()}${query}`};
    }
  }

  if (scope === 'api' && action === 'request') {
    return {
      method: String(requireValue(flags.method || positionals[2], 'method')).toUpperCase(),
      path: requireValue(flags.path || positionals[3], 'path'),
    };
  }

  throw new DriftLedgerCliError(`Unknown command: ${positionals.join(' ')}`);
}

function buildSourceBindingBody(flags) {
  if (!flags.metaTableId && !flags.table) return undefined;
  return {
    id: flags.id,
    metaTableId: numberOption(firstPresent(flags.metaTableId, flags.table), 'meta-table-id'),
    dataSourceId: requireValue(firstPresent(flags.dataSourceId, flags.source), 'data-source-id'),
    sourceName: requireValue(firstPresent(flags.sourceName, flags.name), 'source-name'),
    fieldMappings: parseJsonOption(flags.fieldMappings || '{}', 'field-mappings'),
    primaryKeyFields: asArray(firstPresent(flags.primaryKeyField, flags.primaryKeyFields)),
  };
}

function buildAlertChannelBody(flags) {
  const body = bodyFromKnownFlags(flags, [
    'id',
    'displayName',
    'channelType',
    'enabled',
    'minSeverity',
    'webhookUrl',
    'webhookSecret',
  ]) || {};
  const recipients = firstPresent(flags.recipients, flags.recipient);
  if (recipients !== undefined) {
    body.recipients = asArray(recipients);
  }
  return Object.keys(body).length ? body : undefined;
}

function extractAuthToken(setCookieHeaders) {
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders].filter(Boolean);
  for (const header of headers) {
    const match = String(header).match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return undefined;
}

function agentInstruction(agent, config = {}) {
  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  const workspace = config.workspace || DEFAULT_WORKSPACE;
  const workspaceConfigCommand = workspace === DEFAULT_WORKSPACE ? [] : [`dl config set --workspace ${workspace}`];
  const agentName = String(agent || 'generic').toLowerCase();
  const heading = {
    codex: 'Codex',
    claude: 'Claude Code',
    openclaw: 'OpenClaw',
    generic: 'Generic agent',
  }[agentName] || agent;

  const instructionFile = {
    codex: 'AGENTS.md',
    claude: 'CLAUDE.md',
    openclaw: 'OPENCLAW.md',
    generic: 'AGENT.md',
  }[agentName] || 'AGENT.md';

  return [
    `# DriftLedger CLI for ${heading}`,
    '',
    'Install:',
    '```bash',
    'command -v dl >/dev/null || npm install -g @driftledger/cli',
    `dl config set --api-url ${apiUrl}`,
    ...workspaceConfigCommand,
    'dl auth login --email <email> --password <password>',
    'dl doctor',
    '```',
    '',
    'Environment contract for hosted or sandboxed agents:',
    '```bash',
    `export DRIFTLEDGER_API_URL="${apiUrl}"`,
    'export DRIFTLEDGER_TOKEN="<jwt-from-driftledger-auth-login>"',
    `export DRIFTLEDGER_WORKSPACE_ID="${workspace}"`,
    '```',
    '',
    'Workspace defaults to `Default` when neither `--workspace`, `DRIFTLEDGER_WORKSPACE_ID`, nor local config provides one.',
    '',
    'Optional local skill install from a checked-out dl-agent repository:',
    '```bash',
    'mkdir -p ~/.codex/skills ~/.claude/skills',
    'cp -R skills/driftledger-cli ~/.codex/skills/ 2>/dev/null || true',
    'cp -R skills/driftledger-incident-review ~/.codex/skills/ 2>/dev/null || true',
    'cp -R skills/driftledger-cli ~/.claude/skills/ 2>/dev/null || true',
    'cp -R skills/driftledger-incident-review ~/.claude/skills/ 2>/dev/null || true',
    '```',
    '',
    `Recommended ${instructionFile} block:`,
    '```md',
    '## DriftLedger',
    'Use `dl` for reconciliation workflows. `driftledger` is the equivalent long command.',
    'If `dl` is missing, install it with `npm install -g @driftledger/cli` before DriftLedger commands.',
    'If the runtime supports skills and `skills/driftledger-cli` is installed, use it for the full install-to-run workflow.',
    'If `skills/driftledger-incident-review` is installed, use it after a run creates incidents or alert deliveries.',
    'Prefer JSON output and pass data through files instead of long inline payloads.',
    'Start with `dl doctor`, `dl auth verify`, and `dl workspace list`. If no workspace is specified, `dl` uses `Default`.',
    'For raw exports, upload CSV with `dl dataset upload`, then run `dl assembly submit` and `dl assembly run`.',
    'For preassembled data, upload JSONL with `dl dataset upload-assembled`.',
    'Create or select a reconciliation model with `dl check-model`, then train or add reviewed rules.',
    'Build RuleForest with `dl rule-forest build` before execution.',
    'Before production runs, configure an alert channel with `dl alerts upsert` and verify it with `dl alerts test`.',
    'After a run, inspect both incidents and alert deliveries with `dl incidents task` and `dl alerts deliveries`.',
    'Never paste secrets into prompts; read `DRIFTLEDGER_TOKEN` from the environment.',
    '```',
  ].join('\n');
}

const HELP = `DriftLedger Agent CLI

Usage:
  dl doctor
  dl agent init codex|claude|openclaw|generic
  dl dataset upload --dataset <datasetId> --file payment_order.csv
  dl incidents list

Long-form command:
  driftledger config set --api-url <url> --token <jwt>
  driftledger config set --workspace <spId>
  driftledger auth login --email <email> --password <password>
  driftledger workspace create --name "Default"
  driftledger metadata upsert --body-file meta.json
  driftledger data-source upsert --display-name "Payment Order CSV" --type CSV_UPLOAD
  driftledger source-binding upsert --body-file binding.json
  driftledger dataset create-raw --display-name payment-order --binding-id <bindingId>
  driftledger dataset upload --dataset <datasetId> --file payment_order.csv
  driftledger assembly submit --body-file assembly.json
  driftledger assembly run --task <assemblyTaskId>
  driftledger dataset create-assembled --display-name assembled
  driftledger dataset upload-assembled --dataset <datasetId> --file assembled.jsonl
  driftledger check-model create --body-file check-model.json
  driftledger infer-task submit --body-file infer-task.json
  driftledger infer-task progress --task <inferTaskId>
  driftledger rule add --body-file rule.json
  driftledger rule-forest build
  driftledger rule-forest status
  driftledger run submit --body-file run.json
  driftledger run run --task <taskId>
  driftledger incidents list
  driftledger alerts upsert --body-file alert-email-channel.json
  driftledger alerts list
  driftledger alerts test --channel <channelId>
  driftledger alerts deliveries --task <taskId>
  driftledger agent init codex|claude|openclaw|generic
  driftledger api request GET /api/v1/token/verify
`;

module.exports = {
  AUTH_COOKIE,
  CONFIG_PATH,
  DEFAULT_API_URL,
  DriftLedgerCliError,
  HELP,
  agentInstruction,
  asArray,
  buildEndpoint,
  extractAuthToken,
  loadStoredConfig,
  parseArgv,
  parseJsonOption,
  resolveRuntimeConfig,
  saveStoredConfig,
};
