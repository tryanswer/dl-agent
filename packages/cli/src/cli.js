const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {
  CONFIG_PATH,
  DEFAULT_API_URL,
  DriftLedgerCliError,
  HELP,
  agentInstruction,
  buildDemoPullPlan,
  buildEndpoint,
  buildWebLoginPlan,
  extractAuthToken,
  loadStoredConfig,
  parseArgv,
  parseJsonOption,
  resolveRuntimeConfig,
  saveStoredConfig,
} = require('./core');

async function main(argv = process.argv.slice(2), io = process) {
  const {positionals, flags} = parseArgv(argv);
  const stored = loadStoredConfig();
  const runtime = resolveRuntimeConfig({flags, stored, env: io.env});

  try {
    const [scope, action] = positionals;

    if (!scope || scope === 'help' || flags.help) {
      io.stdout.write(`${HELP}\n`);
      return 0;
    }

    if (scope === 'version' || flags.version) {
      return writeJson(io, {ok: true, version: require('../package.json').version});
    }

    if (scope === 'doctor') {
      return writeJson(io, {
        ok: true,
        apiUrl: runtime.apiUrl,
        hasToken: Boolean(runtime.token),
        workspace: runtime.workspace || null,
        configPath: CONFIG_PATH,
      });
    }

    if (scope === 'config') {
      return handleConfig(action, flags, stored, runtime, io);
    }

    if (scope === 'demo' && (action === 'pull' || action === 'download')) {
      return handleDemoPull(flags, io);
    }

    if (scope === 'auth' && action === 'login' && flags.web) {
      return handleWebLogin(flags, runtime, io);
    }

    if (scope === 'agent' && action === 'init') {
      const agent = positionals[2] || flags.agent || 'generic';
      const markdown = agentInstruction(agent, runtime);
      if (flags.out) {
        fs.writeFileSync(String(flags.out), `${markdown}\n`);
        return writeJson(io, {ok: true, agent, path: path.resolve(String(flags.out))});
      }
      io.stdout.write(`${markdown}\n`);
      return 0;
    }

    const endpoint = buildEndpoint(positionals, flags, runtime);
    if (endpoint.kind === 'help') {
      io.stdout.write(`${HELP}\n`);
      return 0;
    }

    const response = endpoint.upload
      ? await requestMultipart(runtime, endpoint, flags)
      : endpoint.download
        ? await requestDownload(runtime, endpoint, flags)
        : await requestJson(runtime, endpoint, flags);

    if (endpoint.captureToken) {
      const token = extractAuthToken(response.setCookie);
      if (token && flags.save !== false) {
        saveStoredConfig({...stored, apiUrl: runtime.apiUrl, token, workspace: runtime.workspace});
      }
      response.authTokenCaptured = Boolean(token);
    }
    delete response.setCookie;

    return writeJson(io, response);
  } catch (error) {
    return handleError(error, io);
  }
}

function handleConfig(action, flags, stored, runtime, io) {
  if (action === 'get' || !action) {
    return writeJson(io, {
      ok: true,
      apiUrl: runtime.apiUrl,
      hasToken: Boolean(runtime.token),
      workspace: runtime.workspace || null,
      configPath: CONFIG_PATH,
    });
  }

  if (action === 'set') {
    const next = {
      ...stored,
      ...(flags.apiUrl ? {apiUrl: String(flags.apiUrl).replace(/\/+$/, '')} : {}),
      ...(flags.token ? {token: String(flags.token)} : {}),
      ...(flags.workspace || flags.workspaceId ? {workspace: String(flags.workspace || flags.workspaceId)} : {}),
    };
    saveStoredConfig(next);
    return writeJson(io, {
      ok: true,
      apiUrl: next.apiUrl || DEFAULT_API_URL,
      hasToken: Boolean(next.token),
      workspace: next.workspace || null,
      configPath: CONFIG_PATH,
    });
  }

  throw new DriftLedgerCliError(`Unknown config action: ${action}`);
}

async function handleDemoPull(flags, io) {
  const plan = buildDemoPullPlan({flags, env: io.env});
  const files = [];

  for (const file of plan.files) {
    if (fs.existsSync(file.outputPath) && !flags.force) {
      files.push({
        path: file.outputPath,
        relativePath: file.relativePath,
        status: 'skipped',
        bytes: fs.statSync(file.outputPath).size,
      });
      continue;
    }

    const response = await fetch(file.url);
    if (!response.ok) {
      throw new DriftLedgerCliError(`Failed to download demo asset: ${file.relativePath}`, {
        status: response.status,
        url: file.url,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(file.outputPath), {recursive: true});
    fs.writeFileSync(file.outputPath, buffer);
    files.push({
      path: file.outputPath,
      relativePath: file.relativePath,
      status: 'downloaded',
      bytes: buffer.length,
    });
  }

  return writeJson(io, {
    ok: true,
    scenario: plan.scenario,
    sourceBase: plan.sourceBase,
    root: plan.root,
    files,
    commands: plan.commands,
  });
}

function handleWebLogin(flags, runtime, io) {
  const plan = buildWebLoginPlan({flags, env: io.env, runtime});
  let opened = false;

  if (plan.open) {
    opened = openBrowser(plan.loginUrl);
  }

  return writeJson(io, {...plan, opened});
}

function openBrowser(url) {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  try {
    const child = spawn(command, args, {stdio: 'ignore', detached: true});
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function requestJson(runtime, endpoint, flags) {
  const body = await resolveBody(flags, endpoint.body);
  const headers = buildHeaders(runtime, flags, Boolean(body));
  const response = await fetch(buildUrl(runtime, endpoint.path), {
    method: endpoint.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return normalizeFetchResponse(response, {allowAppError: Boolean(flags.allowAppError)});
}

async function requestMultipart(runtime, endpoint, flags) {
  const filePath = flags.file;
  if (!filePath) {
    throw new DriftLedgerCliError('Missing required option: --file');
  }
  const form = new FormData();
  const buffer = fs.readFileSync(String(filePath));
  const blob = new Blob([buffer]);
  form.append('file', blob, path.basename(String(filePath)));
  const response = await fetch(buildUrl(runtime, endpoint.path), {
    method: endpoint.method,
    headers: buildHeaders(runtime, flags, false),
    body: form,
  });
  return normalizeFetchResponse(response, {allowAppError: Boolean(flags.allowAppError)});
}

async function requestDownload(runtime, endpoint, flags) {
  const response = await fetch(buildUrl(runtime, endpoint.path), {
    method: endpoint.method,
    headers: buildHeaders(runtime, flags, false),
  });
  if (!response.ok) {
    throw new DriftLedgerCliError(`HTTP ${response.status}`, {status: response.status, body: await response.text()});
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const out = flags.out || flags.output;
  if (out) {
    fs.writeFileSync(String(out), buffer);
  }
  return {
    ok: true,
    httpStatus: response.status,
    bytes: buffer.length,
    output: out ? path.resolve(String(out)) : null,
  };
}

async function resolveBody(flags, defaultBody) {
  if (flags.bodyFile) {
    return JSON.parse(fs.readFileSync(String(flags.bodyFile), 'utf8'));
  }
  if (flags.body) {
    const body = String(flags.body);
    if (body.startsWith('@')) {
      return JSON.parse(fs.readFileSync(body.slice(1), 'utf8'));
    }
    return parseJsonOption(body, 'body');
  }
  return defaultBody;
}

function buildHeaders(runtime, flags, hasJsonBody) {
  const headers = {
    Accept: 'application/json',
    ...(hasJsonBody ? {'Content-Type': 'application/json'} : {}),
  };
  const token = flags.token || runtime.token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function buildUrl(runtime, apiPath) {
  if (/^https?:\/\//i.test(apiPath)) {
    return apiPath;
  }
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${runtime.apiUrl}${normalizedPath}`;
}

async function normalizeFetchResponse(response, options = {}) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const data = contentType.includes('application/json') && text ? JSON.parse(text) : text;
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  if (!response.ok) {
    throw new DriftLedgerCliError(`HTTP ${response.status}`, {status: response.status, data});
  }
  if (!options.allowAppError && data && typeof data === 'object' && data.status && Number(data.status) >= 400) {
    throw new DriftLedgerCliError(data.message || data.error || `Application status ${data.status}`, {data});
  }

  return {
    ok: true,
    httpStatus: response.status,
    status: data?.status,
    message: data?.message,
    data: data?.data ?? data,
    raw: flagsIncludeRaw(data) ? data : undefined,
    setCookie,
  };
}

function flagsIncludeRaw() {
  return false;
}

function writeJson(io, payload) {
  io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  return 0;
}

function handleError(error, io) {
  if (error instanceof DriftLedgerCliError) {
    io.stderr.write(`${JSON.stringify({ok: false, error: error.message, details: error.details}, null, 2)}\n`);
    return 1;
  }
  io.stderr.write(`${JSON.stringify({ok: false, error: error.message || String(error)}, null, 2)}\n`);
  return 1;
}

module.exports = {main};
