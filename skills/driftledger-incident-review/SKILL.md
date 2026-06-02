---
name: driftledger-incident-review
description: Use when an agent needs to inspect DriftLedger incidents, summarize reconciliation failures, group evidence by rule or table, check alert delivery logs, or draft remediation notes from run output.
---

# DriftLedger Incident Review

## Bootstrap And Install

If `dl` is missing, install it before fetching incidents:

```bash
command -v dl >/dev/null || npm install -g @driftledger/cli
dl doctor
```

Workspace selection defaults to `Default`. Only pass `--workspace <spId>` when
the user explicitly chooses another workspace.

```bash
dl workspace list
```

## Workflow

1. Fetch incidents with `dl incidents task --task <taskId>`.
2. Fetch delivery logs with `dl alerts deliveries --task <taskId>`.
3. Fetch individual incident details when the list only includes summaries:
   `dl incidents get --incident <incidentId>`.
4. Group incidents by rule, table, field, and business impact.
5. Check whether at least one enabled alert channel exists with
   `dl alerts list`.
6. Quote only stable identifiers from synthetic, sanitized, or approved data.
7. Produce a concise handoff that includes rule, evidence rows, alert status, likely cause,
   owner, and recommended next action.

## Review Commands

```bash
dl incidents task --task <taskId>
dl incidents get --incident <incidentId>
dl incidents actions --incident <incidentId>
dl alerts list
dl alerts deliveries --task <taskId>
```

## Handoff Shape

```text
Run: <taskId>
Rule: <rule title or ruleId>
Impact: <business consequence>
Evidence: <masked row IDs or stable demo IDs>
Alert: <delivered | failed | no channel | no delivery log>
Likely cause: <data drift | rule gap | expected exception | false positive>
Owner: <business or engineering owner>
Next action: <fix data | update rule | close false positive | add exception>
```

## Safety

- Do not expose account numbers, order numbers, addresses, names, or raw company
  identifiers in summaries.
- Prefer masked or demo identifiers when evidence must be referenced.
- Keep the original JSON artifact available for internal review instead of
  pasting large payloads into chat.
