# Agentic Repository Workbench Remaining Phases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Agentic Repository Workbench phases after the navigation restructure.

**Architecture:** Treat the Repository as a per-OpenClaw-instance binding stored in Desktop instance data. The renderer owns UI state and product flows; Electron main/preload provide structured local filesystem and Git capabilities; Gateway/Companion support is added later through narrow node commands rather than generic shell access.

**Tech Stack:** Electron IPC, React 18, TypeScript, Zustand store, Semi Design, Vitest, Git CLI through Electron main process for desktop-local repositories.

---

## Scope

This plan continues from `docs/design-docs/agentic-repository-workbench.md` after Phase 1 navigation.

It implements:

- Repository Binding and Gate for `desktop-local`.
- Packaged `resources/agentic-repo` bootstrap template.
- Knowledge base first version for `sources/`, `wiki/index.md`, `wiki/log.md`, Markdown preview, search, and backlinks.
- Workbench first version for `work/`, `plans/`, `runs/`, `outputs/`, and `reviews/`.
- ActionRun presentation as infrastructure inside workbench activity.
- Artifacts compatibility migration toward Repository `outputs/`.
- Companion/Desktop node commands for repository and outputs operations.
- `gateway-local` binding as an explicit advanced mode with remote capability checks.

It does not provide a generic shell, arbitrary filesystem browser, or automatic mutation of non-empty repositories without user-visible bootstrap guidance.

## Phase 2: Repository Binding, Gate, And Template

**Files:**
- Create: `src/lib/agentic-repository.ts`
- Create: `src/lib/agentic-repository-store.ts`
- Create: `src/components/RepositoryGate.tsx`
- Create: `src/__tests__/agentic-repository.test.ts`
- Create: `resources/agentic-repo/README.md`
- Create: `resources/agentic-repo/AGENTS.md`
- Create: `resources/agentic-repo/BOOTSTRAP.md`
- Create: `resources/agentic-repo/schemas/*.schema.md`
- Modify: `electron/local-storage.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/pages/KnowledgeBasePage.tsx`
- Modify: `src/pages/WorkbenchPage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

**Deliverable:** Entering Workbench or Knowledge shows a real repository state: ready, unbound, git missing, path missing, not git, empty, or needs bootstrap. Empty desktop-local repos can be bootstrapped from packaged Markdown templates.

**Verification:**
- `npm test -- src/__tests__/agentic-repository.test.ts src/__tests__/navigation-restructure.test.ts`
- `npm run typecheck`
- Electron CDP: open `#/knowledge` and `#/workbench`, confirm `window.electronAPI.repository` exists and gate state renders in the real Electron app.

## Phase 3: Knowledge Base First Version

**Files:**
- Create: `src/lib/repository-knowledge.ts`
- Create: `src/__tests__/repository-knowledge.test.ts`
- Modify: `src/pages/KnowledgeBasePage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

**Deliverable:** A ready repository shows sources and wiki sections, renders `wiki/index.md` and `wiki/log.md`, supports simple filename/content search, and surfaces backlinks by scanning Markdown links.

**Verification:**
- `npm test -- src/__tests__/repository-knowledge.test.ts src/__tests__/agentic-repository.test.ts`
- `npm run typecheck`
- Electron CDP: bind/initialize a temp desktop-local repo and confirm Knowledge page lists template files and previews Markdown.

## Phase 4: Workbench First Version

**Files:**
- Create: `src/lib/repository-workbench.ts`
- Create: `src/__tests__/repository-workbench.test.ts`
- Modify: `src/pages/WorkbenchPage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

**Deliverable:** Workbench reads `work/inbox.md`, `work/active/`, `plans/active/`, `runs/index.md`, `outputs/index.md`, and `reviews/`, displaying matters, plans, activity, outputs, and reviews without calling OpenClaw Tasks “workbench tasks”.

**Verification:**
- `npm test -- src/__tests__/repository-workbench.test.ts src/__tests__/agentic-repository.test.ts`
- `npm run typecheck`
- Electron CDP: `#/workbench` shows repository-backed matters and still leaves `/taskkanban` under Control Center.

## Phase 5: ActionRun As Infrastructure

**Files:**
- Modify: `src/pages/ActionCenterPage.tsx`
- Modify: `src/pages/WorkbenchPage.tsx`
- Modify: `src/lib/ai-action-run-store.ts`
- Modify: `src/__tests__/ai-action-run-store.test.ts`

**Deliverable:** ActionRun remains available but is framed as activity/execution records feeding `runs/`, not as the user's primary work object.

**Verification:**
- `npm test -- src/__tests__/ai-action-run-store.test.ts src/__tests__/ai-action-center.test.ts`
- `npm run typecheck`

## Phase 6: Outputs And Artifacts Compatibility

**Files:**
- Create: `src/lib/repository-outputs.ts`
- Create: `src/__tests__/repository-outputs.test.ts`
- Modify: `src/lib/artifact-service.ts`
- Modify: `src/lib/desktop-node-commands.ts`
- Modify: `src/pages/ArtifactsPage.tsx`
- Modify: `src/pages/ArtifactDetailPage.tsx`

**Deliverable:** New outputs are mirrored into Repository `outputs/` when a ready binding exists. Legacy artifact IDs, routes, and node commands continue to work.

**Verification:**
- `npm test -- src/__tests__/repository-outputs.test.ts src/__tests__/session-artifacts.test.ts src/__tests__/desktop-node-commands.test.ts`
- `npm run typecheck`
- Electron CDP: create/open an artifact and confirm Workbench outputs reflect it.

## Phase 7: Companion Repository And Outputs Commands

**Files:**
- Modify: `src/lib/desktop-bridge.ts`
- Modify: `src/lib/desktop-node-commands.ts`
- Modify: `src/__tests__/desktop-node-commands.test.ts`
- Modify: `src/__tests__/desktop-companion.test.ts`

**Deliverable:** Desktop node supports structured commands: `desktop.repository.status`, `desktop.repository.read`, `desktop.repository.write`, `desktop.repository.search`, `desktop.repository.git.status`, `desktop.repository.git.diff`, `desktop.outputs.create`, `desktop.outputs.open`, `desktop.outputs.update`, and `desktop.outputs.append`.

**Verification:**
- `npm test -- src/__tests__/desktop-node-commands.test.ts src/__tests__/desktop-companion.test.ts`
- `npm run typecheck`

## Phase 8: Gateway-Local Advanced Mode

**Files:**
- Modify: `src/lib/agentic-repository.ts`
- Modify: `src/lib/agentic-repository-store.ts`
- Modify: `src/components/RepositoryGate.tsx`
- Modify: `src/__tests__/agentic-repository.test.ts`

**Deliverable:** `gateway-local` bindings are stored and displayed, but file operations require Companion capability checks. If the Gateway cannot expose repository capabilities, the UI shows `repo_remote_unreachable` or a clear setup state.

**Verification:**
- `npm test -- src/__tests__/agentic-repository.test.ts src/__tests__/desktop-companion.test.ts`
- `npm run typecheck`
- Electron CDP: switch binding location and confirm the advanced mode does not try to use local filesystem APIs.

## Phase 9: Final Runtime Verification

**Verification:**
- `npm test -- src/__tests__/agentic-repository.test.ts src/__tests__/repository-knowledge.test.ts src/__tests__/repository-workbench.test.ts src/__tests__/repository-outputs.test.ts src/__tests__/desktop-node-commands.test.ts`
- `npm run typecheck`
- `npm run build`
- Electron CDP through `http://127.0.0.1:9222`, not a plain browser:
  - `#/knowledge` ready/unbound/bootstrap states
  - `#/workbench` repository-backed sections
  - `#/artifacts` legacy compatibility
  - `#/control-center` still owns OpenClaw scheduled tasks

