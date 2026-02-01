# rn-logs

Fast CLI to read React Native Metro logs via CDP. Built for agent-friendly output with optional TTY niceties.

## Why

- Lightweight alternative to MCP for log access
- Plain text output for low context usage
- Works with Metro + React Native DevTools

## Install

```bash
bun install
```

## Quickstart

```bash
rn-logs apps
rn-logs logs --app "MyApp"
```

## Usage

```bash
rn-logs apps
rn-logs logs --app "MyApp"
rn-logs logs --app "MyApp" --regex "error|warn"
rn-logs logs --app "MyApp" --max 50
```

## Commands

### apps

List apps connected to Metro.

Options:

- `--host <host>` Metro host (default: localhost)
- `--port <port>` Metro port (default: 8081)

### logs

Stream or snapshot logs from an app.

Options:

- `--app <id|name>` target app id or name
- `--host <host>` Metro host (default: localhost)
- `--port <port>` Metro port (default: 8081)
- `--regex <expr>` filter logs by regex
- `--max <n>` max logs then exit
- `--follow` stream logs (default)

## Notes

- Requires Metro running and app DevTools open.
- When multiple apps connected, use `--app` or select interactively in TTY.
- Non-interactive mode stays plain text.

## Agent Skill

See `skills/rn-logs-usage.md` for the agent usage guide.
