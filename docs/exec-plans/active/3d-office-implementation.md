# 3D Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder 3D Office page with a working immersive Three.js 2.5D office where OpenClaw Agents appear as warm robots in work, meeting, and lounge zones.

**Architecture:** React and Zustand remain the data source. Pure mapping modules derive Office Agent state and layout slots from `AgentInfo[]` and connection state; `OfficeScene` consumes that state and owns Three.js renderer, camera, scene, actors, and animation loop. The first version uses procedural geometry instead of external 3D assets.

**Tech Stack:** React 18, TypeScript, Zustand, Semi Design, Three.js, Vitest, Vite/Electron.

---

## File Structure

- Create `src/lib/office-state.ts`: pure Office state derivation from Gateway Agent data.
- Create `src/lib/office-layout.ts`: pure zone coordinates, slot assignment, and transition metadata.
- Create `src/components/office/OfficeScene.tsx`: Three.js scene lifecycle, renderer, camera, actors, animation loop, selected Agent callback.
- Modify `src/pages/Office3DPage.tsx`: replace placeholder cube page with full-screen scene and floating UI.
- Modify `src/lib/types.ts`: extend Office Agent types for zones, behaviors, movement profile, and display metadata.
- Modify `package.json` / lockfile: add `three`.
- Create `src/__tests__/office-state.test.ts`: TDD coverage for status-to-zone behavior.
- Create `src/__tests__/office-layout.test.ts`: TDD coverage for stable layout slot assignment.

## Task 1: State Mapping

- [x] Write failing tests in `src/__tests__/office-state.test.ts`:
  - `running` maps to `working` in `work` zone.
  - `idle` maps to `resting` in `lounge` zone.
  - `error` maps to `stuck` in `work` zone.
  - multiple running Agents map to `collaborating` in `meeting` zone with one presenter.
- [x] Run `npm run test -- src/__tests__/office-state.test.ts` and confirm failure.
- [x] Implement `deriveOfficeAgents()` in `src/lib/office-state.ts`.
- [x] Run the test again and confirm pass.

## Task 2: Layout Mapping

- [x] Write failing tests in `src/__tests__/office-layout.test.ts`:
  - work, meeting, and lounge slots are assigned by zone.
  - assignments are stable for the same ordered Agent list.
  - movement profile is `hurry` when moving from lounge to work or meeting and `stroll` when returning to lounge.
- [x] Run `npm run test -- src/__tests__/office-layout.test.ts` and confirm failure.
- [x] Implement `assignOfficeLayout()` and `getMovementProfile()` in `src/lib/office-layout.ts`.
- [x] Run the test again and confirm pass.

## Task 3: Three.js Scene

- [x] Add `three` dependency.
- [x] Create `src/components/office/OfficeScene.tsx`.
- [x] Implement renderer setup, orthographic camera, lighting, floor, three colored zones, warm robot actors, desks, meeting table, blackboard, and lounge props.
- [x] Add simple animation loop:
  - working robots type at desk.
  - resting robots bob/sleep in lounge.
  - collaborating presenter points at blackboard while listeners nod.
  - stuck robots blink warning color.
- [x] Clean up renderer and animation frame on unmount.

## Task 4: Page Integration

- [x] Replace `src/pages/Office3DPage.tsx` placeholder content with the scene.
- [x] Add floating overlay for connection status, Agent count, selected Agent details, and refresh.
- [x] Keep fallback UI for disconnected state and WebGL failure.

## Task 5: Verification

- [x] Run `npm run test -- src/__tests__/office-state.test.ts src/__tests__/office-layout.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Start dev server and use browser/Playwright to verify canvas is nonblank and zones render.
