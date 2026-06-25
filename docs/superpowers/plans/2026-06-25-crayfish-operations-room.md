# Crayfish Operations Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the first 3D Office pass from a warm robot office into the Crayfish Operator operations room while preserving the current interaction gameplay.

**Architecture:** Keep the current `OfficeScene`/Three.js architecture and existing Gateway-backed state flow. Replace the programmatic actor and scene presentation layer with a low-poly crayfish operator style, and reframe local first-person shooting as a diagnostic pulse interaction without changing the core control loop.

**Tech Stack:** React, Three.js, Vitest, Markdown design docs.

---

### Task 1: Lock The New Direction With Tests

**Files:**
- Modify: `src/__tests__/office-scene.test.ts`
- Modify: `src/__tests__/office-gameplay.test.ts`

- [ ] Add source-level tests that require `createCrayfishOperator`, crayfish anatomy markers, and diagnostic pulse gameplay names.
- [ ] Run `npm test -- src/__tests__/office-scene.test.ts src/__tests__/office-gameplay.test.ts` and verify the new tests fail before implementation.

### Task 2: Update 3D Office Design Documentation

**Files:**
- Modify: `docs/design-docs/3d-office.md`

- [ ] Replace the “warm robot office” language with “Crayfish Operations Room”.
- [ ] Document the retained interaction gameplay: selected-agent walking, first-person view, local diagnostic pulse, hit feedback, temporary down/recover loop.
- [ ] Keep non-goals clear: no external GLTF and no Gateway state mutation.

### Task 3: Rebuild Programmatic Actor Style

**Files:**
- Modify: `src/components/office/OfficeScene.tsx`

- [ ] Rename `createRobot` to `createCrayfishOperator`.
- [ ] Build the actor from simple Three.js primitives: segmented shell, antennae, claws, small legs, terminal chest panel, cyan status face.
- [ ] Keep existing `ActorState` fields and hitbox semantics so selection, first-person walking, collisions, and local interaction still work.

### Task 4: Reframe Local Gameplay As Diagnostic Pulse

**Files:**
- Modify: `src/lib/office-gameplay.ts`
- Modify: `src/lib/office-audio.ts`
- Modify: `src/components/office/office-scene-interactions.ts`
- Modify: `src/components/office/OfficeScene.tsx`
- Modify: related tests under `src/__tests__/`

- [ ] Preserve the current local interaction mechanics.
- [ ] Rename user-facing/source names from toy blaster toward diagnostic pulse where practical.
- [ ] Keep compatibility strings only if tests or existing code paths still need them.
- [ ] Update gameplay messages so the loop reads as scan/debug/recover rather than combat.

### Task 5: Verify

**Files:**
- Test: `src/__tests__/office-scene.test.ts`
- Test: `src/__tests__/office-gameplay.test.ts`
- Test: `src/__tests__/office-scene-interactions.test.ts`
- Test: `src/__tests__/office-audio.test.ts`

- [ ] Run focused tests.
- [ ] Run `npm run typecheck`.
- [ ] Report any pre-existing unrelated dirty work separately.
