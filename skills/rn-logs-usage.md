---
name: rn-logs-usage
description: >
  Use rn-logs to read React Native Metro logs via CDP without MCP overhead.
  Default output is plain text and safe for non-interactive agent runs.
---

# rn-logs Agent Skill

Use `rn-logs` to read React Native Metro logs via CDP without MCP overhead. Default output is plain text and safe for non-interactive agent runs.

## When to use

- You need live Metro logs from a running RN app
- You want low-context, plain text log output
- You need to filter logs quickly with a regex

## Requirements

- Metro is running
- App is connected to DevTools (Dev Menu -> Open DevTools)

## Core workflow

1) List connected apps

```bash
rn-logs apps
```

2) Stream logs

```bash
rn-logs logs --app "<id|name>"
```

3) Snapshot logs

```bash
rn-logs logs --app "<id|name>" --max 50
```

4) Filter logs

```bash
rn-logs logs --app "<id|name>" --regex "error|warn"
```

## Non-interactive mode

- When multiple apps are connected, you must pass `--app`.
- Output is plain text for agent-friendly consumption.

## Common failures

- `metro not reachable` -> start Metro or fix host/port
- `no apps connected` -> run app on simulator or device
- `multiple apps connected` -> pass `--app`

## Examples

```bash
rn-logs logs --app "com.example.app" --regex "Network" --max 20
```
