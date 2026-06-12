# OpenClaw Desktop Companion Plugin Design

## Goal

OpenClaw Desktop needs a native OpenClaw extension point for capabilities that
the Gateway does not ship by default. The first concrete capability is rich
artifacts, but the design must support many future Desktop-owned capabilities
without assuming that Desktop and Gateway run on the same machine.

The plugin is a Gateway-side native OpenClaw plugin. Desktop remains a local
Electron application that connects to one or more Gateway instances over the
official Gateway protocol.

## Principles

- Desktop must not assume it can read or write files on the Gateway host.
- Desktop must not rely on CLI except for quick local-instance discovery.
- Remote Gateway support is a first-class requirement.
- Plugin RPC is the control plane.
- Official `node.invoke` is the execution plane.
- Skills can teach behavior, but they are not a substitute for real Gateway
  tools.
- Missing plugin support must degrade gracefully to session parsing and local
  Desktop UX.

## Repositories

The companion plugin lives in its own public GitHub repository:

```text
https://github.com/windinternet/openclaw-desktop-companion.git
```

For local development, the repository is cloned inside the Desktop workspace:

```text
plugins/openclaw-desktop-companion/
```

It remains an independent Git repository. The Desktop repository ignores this
folder so plugin commits and Desktop commits stay separate.

## Distribution

The first supported installation path is direct git installation:

```bash
openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main
openclaw plugins enable openclaw-desktop-companion
openclaw gateway restart
openclaw plugins inspect openclaw-desktop-companion --runtime --json
```

Desktop should not run these commands for remote instances. Instead, when a
remote Gateway is missing the plugin, Desktop can start or prepare an OpenClaw
session that asks the Gateway-side agent to install, enable, restart, and
verify the plugin on the Gateway host. This keeps authority and filesystem
access on the Gateway side.

For local quick-scan flows only, Desktop may use CLI probes to discover local
Gateway installs or versions.

## Plugin Shape

Plugin id:

```text
openclaw-desktop-companion
```

The plugin is a native OpenClaw plugin with:

- `openclaw.plugin.json`
- package metadata with `openclaw.extensions`
- a TypeScript entry point compiled to JavaScript
- registered agent tools for Desktop-backed capabilities
- registered Gateway RPC methods for status and control-plane discovery
- bundled skills that teach agents when to use the companion tools

The first capability group is `artifacts`.

## Control Plane

The plugin registers Gateway RPC methods under a plugin-owned namespace:

```text
desktopCompanion.status
desktopCompanion.capabilities
desktopCompanion.tasks.list
desktopCompanion.tasks.get
desktopCompanion.tasks.submitResult
```

The control plane is used for:

- plugin installation and version detection
- compatibility checks between Gateway plugin and Desktop app
- listing supported capability groups
- discovering online Desktop nodes
- exposing pending Desktop-bound tasks when event delivery is unavailable
- version negotiation for task payload schemas

The Desktop app uses these RPCs after connecting to a Gateway. If the methods
are absent, Desktop treats the plugin as not installed or not loaded.

## Execution Plane

Desktop connects to Gateway as a node and advertises Desktop-owned capabilities
and commands. The plugin does not call Desktop localhost and does not assume
same-host networking.

The initial Desktop node command set is:

```text
desktop.artifacts.create
desktop.artifacts.open
desktop.artifacts.update
desktop.artifacts.append
desktop.notify
```

The plugin's agent tools call Gateway node invoke APIs to forward execution to
an online Desktop node. The Gateway remains the rendezvous point between the
Gateway-side plugin and the local Desktop app.

When no compatible Desktop node is online, tools fail with a structured
recoverable error so the agent can explain that Desktop must be connected.

## Artifact Capability

Artifacts are the first end-to-end capability.

The plugin registers agent tools such as:

```text
desktop_artifact_create
desktop_artifact_update
desktop_artifact_append
desktop_artifact_open
```

The tool names use stable snake_case names for model-facing tools. The node
commands use dotted names to match OpenClaw node command conventions.

Flow:

1. Agent decides a rich HTML artifact is appropriate.
2. Agent calls `desktop_artifact_create` with title, type, metadata, and HTML.
3. Plugin validates and resolves the target Desktop node.
4. Plugin forwards to `node.invoke` command `desktop.artifacts.create`.
5. Desktop saves the artifact locally and opens or indexes it according to user
   preferences.
6. Plugin returns a structured result to the agent with artifact id, title, and
   display status.
7. Desktop session detail page also continues to parse transcript artifact
   blocks as a fallback.

Fallback:

- If plugin is missing, Desktop can still parse `<artifact>` blocks from chat
  history and save them locally.
- If plugin is present but Desktop node is offline, the agent receives a clear
  recoverable error.
- If node invocation fails after task creation, Desktop can reconcile from the
  control-plane task list when it reconnects.

## Desktop UX

After connecting to a Gateway, Desktop evaluates companion readiness:

```text
missing        plugin RPC methods absent
disabled       plugin known in config but not runtime-loaded
incompatible   plugin version or schema too old/new
ready          plugin RPC reachable and Desktop node accepted
degraded       plugin ready but a capability group is unavailable
```

Desktop surfaces:

- concise status in the instance connection area
- an installation action that opens an OpenClaw session with the git install
  instructions
- enable/restart guidance when installed but inactive
- per-capability status in settings or diagnostics

Desktop must not silently install or enable plugins. Plugin installation is a
supply-chain action and requires explicit user confirmation.

## Installation Recovery

When plugin setup is missing, Desktop can generate an installation task for an
OpenClaw session:

```text
Install and enable the OpenClaw Desktop Companion plugin from
git:github.com/windinternet/openclaw-desktop-companion@main, restart the
Gateway if required, then verify with runtime inspect.
```

The session should report:

- install command run
- enablement result
- restart result or manual restart requirement
- runtime inspect evidence
- final plugin version and registered tool list

Desktop should not mark the plugin ready until Gateway RPC confirms it.

## Security

- Desktop node commands should be explicit and narrow.
- Plugin tools should validate payload size and schema before node invoke.
- Destructive or filesystem-touching future capabilities require explicit
  permission design before being added.
- The plugin must not expose generic shell execution.
- Desktop should show which Gateway instance requested a local action.
- Sensitive data should stay out of task logs unless deliberately included by
  the user.

## Testing

Plugin tests:

- manifest validates
- runtime inspect shows registered tools and RPC methods
- artifact tool validates required inputs
- missing Desktop node returns a recoverable error
- node invoke success returns artifact metadata

Desktop tests:

- plugin missing detection from absent RPC methods
- ready detection from `desktopCompanion.status`
- fallback artifact parsing still works without plugin
- node command dispatch saves an artifact locally
- remote install prompt does not run local CLI

Integration proof:

- install plugin from git into a test Gateway
- connect Desktop as node
- send a session request that creates an artifact
- verify Desktop saves and displays the artifact
- verify session detail recognizes the artifact

