# Onboarding Workspace Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move workspace setup out of Dashboard and into Setup as the fourth onboarding step.

**Architecture:** Reuse the existing `WorkSystemWorkspaceChoice` and `RepositoryGate` flow inside `SetupPage`. Connection success advances the existing appearance/language/connection wizard to a fourth workspace step. Keep Dashboard focused on observation by removing onboarding-only state and rendering.

**Tech Stack:** React, React Router hash routes, Semi UI, Vitest static source checks.

---

### Task 1: Lock The Route Boundary With Tests

**Files:**

- Modify: `src/__tests__/work-system-onboarding.test.ts`
- Modify: `src/__tests__/dashboard-redesign.test.ts`

- [ ] **Step 1: Write failing tests**

Update onboarding tests so they expect `WORK_SYSTEM_ONBOARDING_ROUTE` to be `/setup?step=workspace`, `SetupPage` to render `wizard.stepWorkspace` and `WorkSystemWorkspaceChoice`, and Dashboard to have no `WorkSystemWorkspaceChoice` or onboarding query handling.

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts -- --reporter=dot
```

Expected: FAIL because the current app still routes onboarding through the standalone page or Dashboard instead of Setup step 4.

### Task 2: Add Workspace As Setup Step 4

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/lib/work-system-onboarding.ts`
- Modify: `src/pages/SetupPage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Implement the setup step**

Add a fourth `Steps.Step` for workspace, render the existing onboarding step summary and `WorkSystemWorkspaceChoice` when `currentStep === 3`, and put `createFirstWorkbenchMatter`, first-matter draft state, and skip navigation in `SetupPage`.

- [ ] **Step 2: Wire the route**

Set `WORK_SYSTEM_ONBOARDING_ROUTE` to `/setup?step=workspace`, remove the standalone onboarding route/page, and make connection success advance to step 4. Mark initialization complete only when the user leaves the workspace step.

- [ ] **Step 3: Run green test**

Run the same focused tests and expect PASS.

### Task 3: Remove Dashboard Initialization Surface

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/__tests__/dashboard-redesign.test.ts`
- Modify: `src/__tests__/work-system-onboarding.test.ts`

- [ ] **Step 1: Delete onboarding-only Dashboard code**

Remove `WorkSystemWorkspaceChoice`, `createFirstWorkbenchMatter`, `buildSkippedWorkspaceSessionState`, onboarding anchor scrolling, first-matter state, and `renderWorkSystemOnboarding` from Dashboard.

- [ ] **Step 2: Keep Dashboard observations**

Keep repository unavailable and work-system summary displays. Do not change ActionRun, Artifact, Knowledge, or card behavior.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts -- --reporter=dot
```

Expected: PASS.

### Task 4: Verify And Commit

**Files:**

- All changed files

- [ ] **Step 1: Run verification**

Run:

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts -- --reporter=dot
npm run typecheck
```

- [ ] **Step 2: Review diff**

Run:

```bash
git diff --stat
git diff -- src/pages/DashboardPage.tsx src/pages/SetupPage.tsx src/App.tsx src/lib/work-system-onboarding.ts
```

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-07-06-onboarding-workspace-step-design.md docs/superpowers/plans/2026-07-06-onboarding-workspace-step.md src/App.tsx src/lib/work-system-onboarding.ts src/pages/SetupPage.tsx src/pages/DashboardPage.tsx src/locales/zh.json src/locales/en.json src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts
git commit -m "fix: move workspace onboarding out of dashboard"
git push -u origin codex/onboarding-workspace-step
```
