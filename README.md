# rn-logs 🔧

Fast CLI to read React Native Metro logs via CDP. Built for agent-friendly
output with optional TTY niceties.

<img width="600" alt="Terminal Screenshot" src="https://github.com/user-attachments/assets/223020b5-a797-411c-9fcc-7a9e8fd80b37" />

## Why

- Lightweight alternative to MCP for log access
- Plain text output for low context usage
- Works with Metro + React Native DevTools

## Install

```bash
npm install -g rn-logs-cli
```

```bash
bun add -g rn-logs-cli
```

See
[`skills/rn-logs-usage.md`](https://github.com/okwasniewski/react-native-logs-cli/blob/main/skills/rn-logs-usage.md)
for the agent usage guide.

## Package

Published as `rn-logs-cli` on npm.

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
rn-logs logs --app "MyApp" --limit 50
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
- `--limit <n>` capture last n logs then exit
- `--follow` stream logs (default unless --regex or --limit)
- `--verbose` include full stack traces

## Notes

- Requires Metro running and app running on a simulator or device.
- When multiple apps connected, use `--app` or select interactively in TTY.
- Non-interactive mode stays plain text.

## Known Limitations

- CDP attach and React Native DevTools cannot run at the same time; they compete
  for the inspector channel. Use one per session.
