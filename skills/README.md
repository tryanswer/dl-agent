# DriftLedger Skills

This directory holds reusable agent workflow packages for DriftLedger. The
runtime surface is still the `dl` CLI; skills teach agents when to call it, which
payload files to generate, and how to interpret JSON responses.

## Install

Install for Codex:

```bash
mkdir -p ~/.codex/skills
cp -R skills/driftledger-cli ~/.codex/skills/
cp -R skills/driftledger-incident-review ~/.codex/skills/
```

Install for Claude Code:

```bash
mkdir -p ~/.claude/skills
cp -R skills/driftledger-cli ~/.claude/skills/
cp -R skills/driftledger-incident-review ~/.claude/skills/
```

For OpenClaw or generic shell agents, keep this directory in the repository and
generate a project instruction file with the CLI:

```bash
dl agent init openclaw --out OPENCLAW.md
dl agent init generic --out AGENT.md
```

## Use

1. Use `driftledger-cli` when the agent needs to install `dl`, authenticate,
   choose a workspace, upload CSV or JSONL data, train or add rules, build
   RuleForest, configure alerts, execute checks, or fetch incidents.
2. Use `driftledger-incident-review` after a run creates incidents or alert
   deliveries and the agent needs to summarize evidence and next actions.
3. Keep generated payloads in `examples/body-files/*.json` or another reviewed
   local file, then pass them to the CLI with `--body-file`.
4. Let workspace default to `Default` unless the user explicitly chooses another
   workspace. Use `--workspace <spId>` only for that override.
5. Keep secrets in environment variables or local config, never in skill files,
   prompts, or committed examples.

## Layout

```text
skills/
  README.md
  driftledger-cli/
    SKILL.md
    examples/
    scripts/
  driftledger-incident-review/
    SKILL.md
    templates/
```

## Skill Boundaries

| Skill | Scope |
| --- | --- |
| `driftledger-cli` | Install CLI, authenticate, select workspace, create metadata, upload CSV/JSONL, train rules, build RuleForest, configure alerts, run checks. |
| `driftledger-incident-review` | Read incident JSON, summarize business drift, identify evidence rows, check alert deliveries, and draft remediation handoff notes. |

Keep secrets out of skill files. Skills may reference environment variables such
as `DRIFTLEDGER_TOKEN`, but must never contain real tokens, accounts, or raw
company data. Alert examples must also avoid real recipients, webhook URLs, and
webhook secrets.
