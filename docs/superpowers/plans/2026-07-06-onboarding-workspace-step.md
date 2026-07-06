# Onboarding Workspace Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move workspace setup out of Dashboard and into a dedicated onboarding step.

**Architecture:** Reuse the existing `WorkSystemWorkspaceChoice` and `RepositoryGate` flow inside a new page. Route connection-success onboarding directly to that page. Keep Dashboard focused on observation by removing onboarding-only state and rendering.

**Tech Stack:** React, React Router hash routes, Semi UI, Vitest static source checks.

---

### Task 1: Lock The Route Boundary With Tests

**Files:**

- Modify: `src/__tests__/work-system-onboarding.test.ts`
- Modify: `src/__tests__/dashboard-redesign.test.ts`

- [ ] **Step 1: Write failing tests**

Update onboarding tests so they expect `WORK_SYSTEM_ONBOARDING_ROUTE` to be `/onboarding/workspace`, `App.tsx` to route that path to `WorkspaceOnboardingPage`, and Dashboard to have no `WorkSystemWorkspaceChoice` or onboarding query handling.

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts -- --reporter=dot
```

Expected: FAIL because the current app still routes onboarding through Dashboard.

### Task 2: Add The Dedicated Workspace Onboarding Page

**Files:**

- Create: `src/pages/WorkspaceOnboardingPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/work-system-onboarding.ts`

- [ ] **Step 1: Implement the page**

Create a focused page that renders the existing onboarding steps and `WorkSystemWorkspaceChoice`. Put `createFirstWorkbenchMatter`, first-matter draft state, and skip navigation here.

- [ ] **Step 2: Wire the route**

Set `WORK_SYSTEM_ONBOARDING_ROUTE` to `/onboarding/workspace`, add a protected route for `WorkspaceOnboardingPage`, and remove HomeRoute's onboarding-query bypass.

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
git diff -- src/pages/DashboardPage.tsx src/pages/WorkspaceOnboardingPage.tsx src/App.tsx src/lib/work-system-onboarding.ts
```

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-07-06-onboarding-workspace-step-design.md docs/superpowers/plans/2026-07-06-onboarding-workspace-step.md src/App.tsx src/lib/work-system-onboarding.ts src/pages/WorkspaceOnboardingPage.tsx src/pages/DashboardPage.tsx src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts
git commit -m "fix: move workspace onboarding out of dashboard"
git push -u origin codex/onboarding-workspace-step
```
