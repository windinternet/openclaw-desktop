# Companion Plugin Inventory Design

## Goal

OpenClaw Desktop needs a real plugin inventory comparable to:

```bash
openclaw plugins list --json
```

Desktop cannot depend on running the OpenClaw CLI locally because it may be
connected to a remote Gateway. The first shippable path is to use the existing
OpenClaw Desktop Companion plugin as a Gateway-side control-plane bridge. The
plugin runs inside the Gateway host context, so it can execute the Gateway
host's `openclaw` CLI and return a structured, read-only plugin list through a
Gateway RPC.

## Non-Goals

- Do not add plugin install, update, enable, disable, or uninstall actions.
- Do not expose arbitrary shell execution.
- Do not require changes in upstream OpenClaw Gateway.
- Do not make Desktop read Gateway host files or assume Gateway and Desktop are
  on the same machine.
- Do not replace `tools.catalog`; it remains the runtime tool catalog view.

## Architecture

Add a new Companion plugin Gateway RPC:

```text
desktopCompanion.plugins.list
```

The RPC is implemented by `openclaw-desktop-companion`, not by Desktop. Desktop
connects to Gateway normally, completes the existing device challenge handshake,
and calls this RPC through the existing `GatewayClient.request()` path.

The plugin executes only this fixed command:

```bash
openclaw plugins list --json
```

If the caller passes `enabled: true`, the plugin adds the fixed `--enabled`
argument:

```bash
openclaw plugins list --json --enabled
```

The plugin parses stdout as JSON and returns the same top-level data shape that
the CLI returns, wrapped in a Companion response envelope.

## RPC Contract

Request:

```ts
interface DesktopCompanionPluginsListRequest {
  enabled?: boolean;
  timeoutMs?: number;
}
```

Response:

```ts
interface DesktopCompanionPluginsListSuccess {
  ok: true;
  source: "cli";
  argv: ["openclaw", "plugins", "list", "--json"] | ["openclaw", "plugins", "list", "--json", "--enabled"];
  enabledOnly: boolean;
  capturedAt: number;
  durationMs: number;
  registry?: {
    source?: string;
    diagnostics?: unknown[];
  };
  plugins: OpenClawPluginInfo[];
  diagnostics: unknown[];
}

interface DesktopCompanionPluginsListFailure {
  ok: false;
  source: "cli";
  error:
    | "cli-not-found"
    | "cli-timeout"
    | "cli-exit-nonzero"
    | "cli-json-invalid"
    | "cli-output-too-large"
    | "unknown";
  message: string;
  durationMs: number;
  stderr?: string;
}
```

The plugin should pass through plugin records conservatively. Desktop may type
the common fields it needs for UI, but it should keep the raw record available
for diagnostics because OpenClaw plugin metadata can evolve independently of
Desktop.

Common plugin fields expected from current OpenClaw CLI output:

- `id`
- `name`
- `version`
- `description`
- `format`
- `source`
- `rootDir`
- `origin`
- `enabled`
- `status`
- capability id arrays such as `providerIds`, `toolNames`, `commands`
- `dependencyStatus`

## Timeout and Output Limits

The default timeout is 30 seconds. The request may override `timeoutMs`, but the
plugin clamps it to a safe range:

```text
5 seconds <= timeoutMs <= 120 seconds
```

The output size limit should be large enough for the bundled plugin registry but
bounded to protect the Gateway process. First implementation target:

```text
stdout <= 4 MiB
stderr <= 32 KiB returned to Desktop
```

If stdout exceeds the limit, the RPC returns `cli-output-too-large`.

## Desktop Behavior

Desktop adds a first-class plugin inventory state separate from the existing
tool catalog state:

```ts
plugins: OpenClawPluginInfo[]
pluginInventoryStatus: "idle" | "loading" | "ready" | "degraded" | "unavailable"
pluginInventoryError?: string
```

Fetch order:

1. Call `desktopCompanion.plugins.list`.
2. If it succeeds, render the returned plugin inventory.
3. If the RPC is unknown, unavailable, or returns `ok: false`, keep the current
   `tools.catalog` behavior as a fallback and label it as plugin tools rather
   than the complete plugin inventory.

This keeps old Gateways and missing Companion installations usable while making
the distinction visible in the Extensions UI.

## UI Scope

First UI pass should show a dense table of plugin inventory:

- Name / ID
- Status: enabled, disabled, error, loaded
- Origin: bundled, config, workspace, global
- Version
- Description
- Capability summary: providers, commands, tools, services
- Dependency status: installed / missing required dependencies

Rows can expand to show source paths, root directory, diagnostics, and raw
dependency details. The UI must avoid implying that Desktop can manage plugins
until write actions are explicitly designed.

## Security Boundaries

- The RPC is read-only.
- The plugin never accepts a command string from Desktop.
- Boolean `enabled` maps only to the fixed `--enabled` argument.
- `timeoutMs` is clamped.
- stderr is truncated before returning to Desktop.
- The response may include Gateway host paths because the CLI output includes
  them. Desktop should display paths as diagnostic information and avoid copying
  them into prompts or user-facing instructions unless the user explicitly opens
  diagnostics.

## Error Handling

- `cli-not-found`: `openclaw` is not available in the Gateway process PATH.
- `cli-timeout`: the child process did not exit before the clamped timeout.
- `cli-exit-nonzero`: the CLI exited with an error; include truncated stderr.
- `cli-json-invalid`: stdout was not valid JSON.
- `cli-output-too-large`: stdout exceeded the configured limit.
- `unknown`: unexpected exception, with a sanitized message.

Desktop should not show a hard failure page for these errors. It should show a
degraded inventory notice and keep the existing skills/tools tabs functional.

## Verification

Plugin-side tests:

- Builds `openclaw plugins list --json` args without accepting arbitrary input.
- Adds `--enabled` only when `enabled === true`.
- Clamps timeout to 5-120 seconds, defaulting to 30 seconds.
- Maps spawn errors and invalid JSON into structured failure responses.
- Truncates stderr and enforces stdout size.

Desktop-side tests:

- `fetchPlugins()` stores a successful Companion plugin inventory response.
- Unknown RPC falls back without clearing existing tool catalog data.
- Failure response marks inventory degraded and preserves the error message.
- Extensions UI distinguishes complete plugin inventory from plugin tool
  fallback.

Manual verification:

1. With Companion installed, call `desktopCompanion.plugins.list` from a
   connected Desktop instance and compare plugin count with
   `openclaw plugins list --json` on the Gateway host.
2. Confirm `enabled: true` matches `openclaw plugins list --enabled --json`.
3. Temporarily hide `openclaw` from PATH in a controlled plugin test and confirm
   Desktop degrades gracefully.
