# Publishing

## npm

The publishable package lives in `packages/cli`.

```bash
npm --workspace @driftledger/cli test
npm run verify:samples
npm --workspace @driftledger/cli pack --dry-run
npm publish --workspace @driftledger/cli --access public
```

## Install Script

The install script lives at `scripts/install.sh` and should be deployed to:

```text
https://driftledger.fatclaw.com/install.sh
```

Smoke test:

```bash
DRIFTLEDGER_CLI_PACKAGE=./packages/cli npm run cli -- doctor
curl -fsSL https://driftledger.fatclaw.com/install.sh | bash
```

## GitHub

The public repository is intended to be:

```text
https://github.com/tryanswer/dl-agent
```
