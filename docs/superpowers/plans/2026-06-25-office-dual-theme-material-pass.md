# Office Dual Theme Material Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Crayfish Operations Room with a real light/dark material layer while improving the perceived quality of the existing procedural Three.js scene.

**Architecture:** Keep the current `OfficeScene` and procedural geometry approach. Fix the theme regression by giving light and dark modes separate scene palettes, then add small reusable visual helpers for bevel-like layering, glow surfaces, floor panels, and screen-lit props without introducing external GLTF assets.

**Tech Stack:** React, Three.js, Vitest, Playwright CDP, Markdown design docs.

---

### Task 1: Restore Separate Light And Dark Scene Palettes

**Files:**
- Modify: `src/lib/office-theme.ts`
- Test: `src/__tests__/office-scene.test.ts`

- [ ] Add a source-level test that protects light mode from using dark graphite scene colors.
- [ ] Set light mode to a pale shell/frosted-glass room palette and dark mode to the graphite operations palette.
- [ ] Keep shared coral/cyan brand accents in both themes.

### Task 2: Add Procedural Material Quality Helpers

**Files:**
- Modify: `src/components/office/OfficeScene.tsx`
- Test: `src/__tests__/office-scene.test.ts`

- [ ] Add helpers for inset panels, luminous strips, and soft shadow slabs using existing Three.js primitives.
- [ ] Use those helpers on the floor, walls, reception desk, work bay, lounge, and task-flow sand table.
- [ ] Avoid changing actor hitboxes, controls, or Gateway-backed state.

### Task 3: Theme-Specific Actor And UI Readability

**Files:**
- Modify: `src/components/office/OfficeScene.tsx`
- Modify: `src/lib/office-theme.ts`
- Test: `src/__tests__/office-audio.test.ts`

- [ ] Make label, status buffer, and speech bubble colors readable in both themes.
- [ ] Give the crayfish shell a lighter candy-gloss treatment in light mode and stronger emissive contrast in dark mode.

### Task 4: Runtime Visual Verification

**Files:**
- No permanent app files unless defects are found.

- [ ] Run focused Vitest tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Use CDP against `http://127.0.0.1:9222` to capture both light and dark office screenshots.
