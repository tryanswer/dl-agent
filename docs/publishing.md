# Publishing

## CLI Package

The installable CLI package lives in `packages/cli`. The hosted installer can
pack and install it from the public GitHub archive even before npm publication.

```bash
npm --workspace @driftledger/cli test
npm run verify:samples
npm --workspace @driftledger/cli pack --dry-run
```

Optional npm publication, after package ownership is ready:

```bash
npm publish --workspace @driftledger/cli --access public
```

## Install Script

The install script lives at `scripts/install.sh` and should be deployed to:

```text
https://driftledger-global.fatclaw.com/install.sh
```

Smoke test:

```bash
DRIFTLEDGER_CLI_PACKAGE=./packages/cli bash scripts/install.sh
dl doctor
curl -fsSL https://driftledger-global.fatclaw.com/install.sh | bash
```

## GitHub

The public repository is intended to be:

```text
https://github.com/tryanswer/dl-agent
```
