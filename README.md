# rn-logs

Simple CLI to read React Native Metro logs via CDP.

## Install

```bash
bun install
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
