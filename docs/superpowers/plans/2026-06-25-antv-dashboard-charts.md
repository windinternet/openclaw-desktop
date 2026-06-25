# AntV Dashboard Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace current hand-built dashboard data chart UI with AntV React chart components.

**Architecture:** Add a focused chart wrapper under `src/components/charts/` and keep Dashboard data normalization unchanged. Dashboard owns section layout and empty state; chart components own AntV configuration and visual rendering.

**Tech Stack:** React 18, Vite, TypeScript, AntV `@ant-design/charts`, Semi Design tokens.

---

### Task 1: Install AntV React Chart Package

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install dependency**

Run: `npm install @ant-design/charts`

Expected: `package.json` includes `@ant-design/charts` and lockfile records its transitive packages.

### Task 2: Add Usage Trend Chart Wrapper

**Files:**
- Create: `src/components/charts/UsageTrendChart.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/styles/global.css`
- Test: `src/__tests__/dashboard-redesign.test.ts`

- [ ] **Step 1: Write failing source tests**

Assert the Dashboard imports `UsageTrendChart`, the wrapper imports `Column` from `@ant-design/charts`, and the old `.dashboard-usage-bar` implementation is no longer used.

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/dashboard-redesign.test.ts`

Expected: FAIL because the wrapper and import do not exist yet.

- [ ] **Step 3: Implement wrapper and Dashboard replacement**

Create `UsageTrendChart` with props `{ trend: GatewayUsageTrendPoint[] }`, map each point to `{ date, tokens, cost }`, and render AntV `Column` with compact axes, token tooltip, rounded columns, and responsive height.

- [ ] **Step 4: Remove old hand-built chart CSS**

Delete `.dashboard-usage-bars`, `.dashboard-usage-bar`, and `.dashboard-usage-bar span`; add `.dashboard-antv-chart` with stable min height.

- [ ] **Step 5: Verify**

Run:
- `npm test -- src/__tests__/dashboard-redesign.test.ts src/__tests__/gateway-usage.test.ts`
- `npm run typecheck`

Expected: all pass.

### Task 3: Final Regression

**Files:**
- No new files.

- [ ] **Step 1: Run adjacent tests**

Run: `npm test -- src/__tests__/dashboard-redesign.test.ts src/__tests__/gateway-usage.test.ts src/__tests__/dashboard-gateway-summary.test.ts src/__tests__/new-session.test.ts`

Expected: all pass.

- [ ] **Step 2: Commit and push**

Run:
```bash
git add package.json package-lock.json docs/superpowers/plans/2026-06-25-antv-dashboard-charts.md src/components/charts/UsageTrendChart.tsx src/pages/DashboardPage.tsx src/styles/global.css src/__tests__/dashboard-redesign.test.ts
git commit -m "feat: render dashboard charts with antv"
git push origin main
```
