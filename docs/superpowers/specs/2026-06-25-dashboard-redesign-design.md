# Dashboard Redesign Design

## Goal

Redesign the Dashboard from a basic status page into the main OpenClaw Desktop command surface.

The new Dashboard must answer four questions quickly:

1. Is the connected Gateway healthy?
2. How is the Gateway being used?
3. What recent sessions, Repository work, knowledge, outputs, and artifacts matter now?
4. What should the user pay attention to or do next?

The page should feel like a polished desktop AI console: calm, information-dense, and work-oriented. It should not look like a marketing landing page or a decorative analytics dashboard.

## Confirmed Structure

### 1. Gateway Status

The first band presents the current Gateway state.

It should include:

- Connection status, retry state, and health status.
- Gateway version and uptime when available.
- Key counts such as Agents, sessions, nodes, plugins, or other available Gateway capability counts.
- A refresh action.

The status band should be prominent but not consume the whole page. When disconnected, the Dashboard should still render the page shell and show a clear reconnect-focused state instead of replacing the whole page with an empty state.

### 2. Gateway Usage Statistics

The Dashboard should include a usage summary for Gateway activity.

Initial implementation can use currently available data, then leave clear extension points for richer Gateway usage metrics when the Gateway exposes them.

Expected metrics include:

- Request or run count.
- Token or model usage if available.
- Tool call count if available.
- Session activity over 24h / 7d / 30d.
- Runtime or cost-style metrics if available later.

If the real Gateway does not yet expose some metrics, show honest unavailable or limited-data states. Do not fabricate usage numbers.

### 3. Recent Sessions, Repository Work, Knowledge, Outputs, and Artifacts

The Dashboard should become an entry point into the user's active work assets.

This area should combine:

- Recent sessions from Gateway session data.
- Repository work from the Agentic Repository snapshot:
  - inbox
  - active work
  - active plans
  - reviews
  - runs
  - outputs
- Knowledge from the Repository knowledge area:
  - sources
  - wiki/log
  - recent updates
  - relationships or backlinks when available
- Desktop artifacts from the artifact store:
  - recent reports, dashboards, documents, checklists, media, links, apps, and other artifacts.

Outputs and artifacts are first-class content. They should not be hidden behind only "recent activity."

### 4. Intelligent Situation and Recommendations

The Dashboard should include a small "what deserves attention" area.

This section can derive simple, honest recommendations from existing local state, for example:

- Continue sessions with recent assistant completions.
- Review failed or awaiting-approval ActionRuns.
- Open active Repository plans.
- Review recent outputs or artifacts.
- Connect Gateway or initialize Repository when prerequisites are missing.

This area should not pretend to be a full AI analysis engine unless backed by real data. It can start as deterministic summaries.

## Quick Start Composer

The Dashboard includes a bottom-centered floating quick start composer.

The composer must visually follow the existing New Session page's `AIChatInput` layout logic:

- A centered max-width input surface.
- A full message input area.
- Configure controls integrated with the input footer.
- Upload and send actions integrated with the input footer.
- Calm floating container with restrained shadow and subtle background treatment.

The composer must not be a separate simplified implementation.

It must inherit the New Session capabilities:

- Select Agent.
- Select model.
- Select thinking level.
- Upload attachments.
- Support page/file drop behavior where practical.
- Send the first message.
- Create a Gateway session through the same `sessions.create` path.
- Navigate to the new chat session with the initial message state, matching New Session behavior.

Implementation should extract a shared composer component from `NewSessionPage` rather than duplicate the creation logic.

## Layout Behavior

The Dashboard is vertically scrollable.

The bottom composer should remain available while scrolling without obscuring important content:

- Main content needs bottom padding equal to or greater than the floating composer height.
- The composer should be centered, not right-aligned.
- On small widths, it should shrink responsively and keep text/buttons from overflowing.

Cards should stay relatively compact. Use full-width bands and grids rather than card-in-card nesting.

## Data Sources

Use existing state and helpers where possible:

- Gateway status: `connectionStatus`, `connectionRetry`, `health`.
- Agents, models, sessions: Zustand store data.
- New session creation: existing `NewSessionPage` logic and helpers from `src/lib/new-session.ts` and `src/lib/model-selection.ts`.
- Repository work: `loadWorkbenchSnapshot`.
- Knowledge: existing Repository knowledge helpers used by `KnowledgeRepositoryPanel`.
- Artifacts: artifact store and existing `ArtifactsPage` data model.
- ActionRun activity: `loadAiActionRuns`.

When Repository binding or Gateway capabilities are unavailable, the Dashboard should show scoped unavailable states for the affected section rather than hiding the whole page.

## Component Boundaries

Recommended implementation boundaries:

- `NewSessionComposer`
  - Shared by `NewSessionPage` and `DashboardPage`.
  - Owns Agent/model/thinking configuration, attachments, message send, and session creation.
  - Accepts layout props for centered full-page mode versus floating Dashboard mode.

- `DashboardPage`
  - Owns page composition and Dashboard data aggregation.
  - Should not duplicate `sessions.create` logic.

- Small local Dashboard section components may be introduced if they keep `DashboardPage` readable:
  - Gateway status section.
  - Usage statistics section.
  - Recent assets section.
  - Outputs/artifacts section.
  - Recommendations section.

Avoid creating a generic dashboard framework.

## Empty and Degraded States

The Dashboard should handle:

- Gateway disconnected or reconnecting.
- No sessions.
- No artifacts.
- Repository not initialized or unavailable.
- Knowledge unavailable.
- Usage metrics unavailable.

Empty states should be scoped to their section and include a direct action when useful.

## Testing

Add focused tests that verify:

- Dashboard keeps rendering the main shell when disconnected.
- Quick start composer uses the shared New Session logic/component.
- Dashboard includes sections for Gateway status, usage, recent work/knowledge, and outputs/artifacts.
- New Session page and Dashboard composer share Agent/model/thinking configuration behavior.
- Session creation still navigates with initial message state.

Run at minimum:

- Relevant Vitest files for Dashboard and New Session behavior.
- `npm run typecheck`.

If layout implementation changes are substantial, verify visually in the running Electron/Vite app with CDP/Playwright as required by `AGENTS.md`.

## Out of Scope

- Inventing fake Gateway usage data.
- Building full charting infrastructure.
- Replacing the Repository workbench.
- Replacing the Artifacts page.
- Changing Gateway protocol.
- Redesigning the whole navigation shell.
