---
name: rn-logs-usage
description: >
  Use rn-logs to read React Native Metro logs via CDP without MCP overhead.
  Default output is plain text and safe for non-interactive agent runs.
---

# rn-logs Agent Skill

Use `rn-logs` to read React Native Metro logs via CDP without MCP overhead.
Default output is plain text and safe for non-interactive agent runs.

## When to use

- You need live Metro logs from a running RN app
- You want low-context, plain text log output

## Requirements

- Metro is running
- App is running on a simulator or device

## Core workflow

1. List connected apps

```bash
rn-logs apps
```

2. Stream logs

```bash
rn-logs logs --app "<id|name>"
```

3. Snapshot logs

```bash
rn-logs logs --app "<id|name>" --limit 50
```

## Non-interactive mode

- When multiple apps are connected, you must pass `--app`.
- Output is plain text for agent-friendly consumption.

## Common failures

- `metro not reachable` -> start Metro or fix host/port
- `no apps connected` -> run app on simulator or device
- `multiple apps connected` -> pass `--app`
