# Contributing

Thanks for improving DriftLedger Agent.

## Development

```bash
npm install
npm test
npm run cli -- doctor
```

## Pull Requests

- Keep CLI command output JSON-first.
- Add or update tests for endpoint mappings and parsing behavior.
- Prefer body-file examples over long inline JSON.
- Do not commit tokens, exported ledgers, or customer data.

## Local CLI Link

```bash
npm install -g ./packages/cli
dl doctor
```
