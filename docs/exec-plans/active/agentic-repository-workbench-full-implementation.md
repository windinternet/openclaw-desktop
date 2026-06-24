# Agentic Repository Workbench Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully implement `docs/design-docs/agentic-repository-workbench.md` as the product source of truth.

**Architecture:** OpenClaw Desktop remains the OpenClaw Gateway desktop UI while adding an Agentic Repository work layer. Desktop owns navigation, repository binding, local filesystem/Git IPC, approval surfaces, previews, and node commands; the Git repository owns knowledge, work, plans, runs, outputs, reviews, schemas, and agent-readable operating rules.

**Tech Stack:** Electron IPC, React 18, TypeScript, Zustand, Semi Design, Vitest, Playwright over existing Electron CDP, Git CLI through Electron main process.

---

## Source Of Truth

- Design: `docs/design-docs/agentic-repository-workbench.md`
- Existing rough plan: `docs/superpowers/plans/2026-06-23-agentic-repository-workbench-remaining-phases.md`
- Verification rule: Electron runtime checks must use the existing CDP server, usually `http://127.0.0.1:9222`, and must not start a duplicate Electron instance.

## Current Progress

- [x] Navigation groups and primary entries: 首页 / 新会话 / 会话 / 工作台 / 知识库 / 协作 / 控制中心.
- [x] OpenClaw Tasks remains under 控制中心, not Workbench matters.
- [x] `desktop-local` Repository Binding and Gate.
- [x] Packaged base `resources/agentic-repo`.
- [x] Knowledge first pass: sources/wiki list, search, `wiki/index.md`, `wiki/log.md`, Markdown preview.
- [x] Workbench first pass: inbox, active work, active plans, runs index, outputs index, reviews list.
- [x] ActionRun is visible as Workbench activity.
- [x] Desktop node repository commands: status/read/write/search/git.status/git.diff.
- [x] Desktop node output commands: create/open/update/append.
- [x] Desktop UI artifact creation mirrors into Repository `outputs/` when a ready desktop-local binding exists.
- [x] Terminal ActionRun summaries mirror into `runs/action-runs/`.
- [x] Session summaries can be written to `runs/session-summaries/` through a narrow Desktop node command.
- [x] Active plan reflects all remaining design-doc gaps and stays updated after each batch.

## Remaining Design Requirements

### A. Repository Template And Bootstrap

- [ ] Template matches the default tree in the design doc:
  - `sources/articles`
  - `sources/files`
  - `sources/clips`
  - `sources/notes`
  - `wiki/topics`
  - `wiki/people`
  - `wiki/projects`
  - `wiki/decisions`
  - `resources/agentic-repo/templates`
- [ ] `BOOTSTRAP.md` explains adaptation for existing non-empty repositories.
- [ ] Desktop exposes structured `desktop.repository.init`.
- [ ] Desktop exposes structured `desktop.repository.git.commit`.
- [ ] Existing non-empty repositories are not silently overwritten.

### B. Knowledge Base

- [x] Knowledge UI shows 最近更新 from file metadata.
- [x] Knowledge UI shows 关系 / backlinks by scanning Markdown links.
- [x] Knowledge UI connects wiki pages to related work and outputs when Markdown links reference those paths.
- [ ] Search results distinguish sources and wiki paths.
- [ ] Empty and error states are localized.

### C. Workbench

- [x] Workbench shows work status view for `work/active`, `work/completed`, and `work/someday`.
- [x] Workbench exposes a Kanban/status view based on Repository `work/`, separate from OpenClaw scheduled tasks.
- [x] Workbench previews selected matter Markdown.
- [x] Workbench shows `plans/active` and `plans/completed`.
- [ ] Workbench shows plan approval/status metadata when present in Markdown.
- [ ] Workbench shows reviews grouped by weekly/project folders.
- [x] ActionRun activity can write or mirror summaries into `runs/action-runs/`.
- [x] Session summaries can be represented under `runs/session-summaries/`.

### D. Outputs And Artifacts

- [x] New artifact creation from the Desktop UI mirrors into Repository `outputs/` when a ready binding exists.
- [x] Legacy `desktop.artifacts.create` internally follows the outputs path when `repoPath` is available.
- [x] Outputs list in Workbench reflects newly mirrored outputs without requiring the user to understand legacy artifact storage.
- [x] Output metadata returns `outputId/path/previewPath` consistently.

### E. Companion And Repository Commands

- [ ] `desktop.repository.init` initializes from the packaged template through a structured command.
- [ ] `desktop.repository.git.commit` commits approved repository changes with a provided message.
- [ ] Commands remain narrow and auditable; no generic shell command is exposed.
- [x] Capability declarations include the full repository/outputs command set.

### F. Gateway-Local Advanced Mode

- [x] `gateway-local` binding is stored separately from `desktop-local` and clearly labeled as advanced.
- [x] `gateway-local` never calls Desktop local filesystem APIs.
- [x] UI shows `repo_remote_unreachable` when Gateway/Companion repository capabilities are unavailable.
- [x] Future Gateway/Companion repository capability checks are isolated behind a small interface.

### G. Control Center

- [x] Repository Protocol card becomes an actual view.
- [x] It can show `AGENTS.md`, `BOOTSTRAP.md`, schemas, and path mappings.
- [x] It distinguishes OpenClaw runtime settings from Repository work-layer protocols.
- [x] Permission overview shows local files, repository read/write, Gateway tools, Companion node commands, network, and execution class capabilities.

### H. Collaboration

- [ ] Collaboration hub keeps Teams and 3D Office as first-class OpenClaw features.
- [ ] Collaboration activity can link to relevant Workbench runs where available.
- [ ] Team/Office pages do not get subsumed by Repository concepts.

## Execution Batches

### Batch 1: Template And Command Foundation

- [x] Write failing tests for full default template directories.
- [x] Add missing template directories and `.gitkeep` files.
- [x] Write failing tests for `desktop.repository.init` and `desktop.repository.git.commit`.
- [x] Implement Electron IPC and Desktop node command support.
- [x] Verify with `npm test -- src/__tests__/agentic-repository.test.ts src/__tests__/desktop-node-commands.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Commit.

### Batch 2: Knowledge Relationships

- [x] Write failing tests for backlink extraction from repository Markdown files.
- [x] Extend `repository-knowledge.ts` snapshot with recent files and backlinks.
- [x] Render 最近更新 and 关系 cards in `KnowledgeRepositoryPanel`.
- [x] Verify with `npm test -- src/__tests__/repository-knowledge.test.ts`.
- [x] Run Electron CDP on existing app to verify `#/knowledge`.
- [ ] Commit.

### Batch 3: Workbench Repository Status Views

- [x] Write failing tests for active/completed/someday work and active/completed plans.
- [x] Extend `repository-workbench.ts` snapshot.
- [x] Render Repository status view without using OpenClaw Tasks.
- [x] Add selected Markdown preview for matters/plans.
- [x] Verify with `npm test -- src/__tests__/repository-workbench.test.ts`.
- [x] Run Electron CDP on existing app to verify `#/workbench`.
- [ ] Commit.

### Batch 4: Runs, Outputs, And Artifacts Migration

- [x] Write failing tests for ActionRun summary Markdown generation.
- [x] Mirror completed ActionRun summaries into `runs/action-runs/` when a ready binding exists.
- [x] Write failing tests for UI-created artifacts mirroring into `outputs/`.
- [x] Route legacy artifact node commands through outputs when repository context is available.
- [x] Verify with repository outputs, session artifacts, desktop node command, and AI action tests.
- [ ] Commit.

### Batch 5: Control Center Repository Protocol

- [x] Write failing tests for route registration and locale coverage.
- [x] Add Repository Protocol view under Control Center.
- [x] Read and preview `AGENTS.md`, `BOOTSTRAP.md`, and schemas from the bound repository.
- [x] Add path mapping overview.
- [x] Commit.

### Batch 6: Gateway-Local Advanced Mode

- [x] Write failing tests proving `gateway-local` does not use local filesystem IPC.
- [x] Add capability-check abstraction.
- [x] Render remote unreachable/setup states.
- [x] Commit.

### Batch 7: Final Design Compliance Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Use existing Electron CDP to verify:
  - `#/knowledge`
  - `#/workbench`
  - `#/control-center`
  - `#/artifacts`
  - `#/taskkanban`
- [ ] Update this plan to mark all implemented requirements.
- [ ] Move completed plan to `docs/exec-plans/completed/`.
