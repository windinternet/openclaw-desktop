# Brand Asset Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and wire a complete OpenClaw brand asset pack for the desktop app, pet window, documentation, and the OpenClaw Desktop Club website.

**Architecture:** Keep editable SVG sources under `assets/brand/source`, generate raster/package outputs through a Node script, and update the existing Electron/Web/Pet asset paths that already exist in the project. The generated manifest documents each file, its dimensions, and its intended usage so future agents can regenerate rather than hand-cut assets.

**Tech Stack:** Node.js ESM, SVG, ImageMagick, macOS `iconutil`, Vitest, Electron Builder icon conventions.

---

### Task 1: Add Brand Asset Contract Tests

**Files:**
- Create: `src/__tests__/brand-assets.test.ts`

- [ ] Test that the brand manifest exists and contains entries for app icon, product logo, Desktop Club logo, pet assets, and packaged Electron icons.
- [ ] Test that required PNG files have the expected pixel dimensions by reading the PNG IHDR header.
- [ ] Test that SVG sources contain the expected product text and crayfish/operator identifiers.

### Task 2: Add A Reproducible Export Script

**Files:**
- Create: `scripts/export-brand-assets.mjs`

- [ ] Generate SVG sources for the OpenClaw mark, product wordmark, combined product logo, Desktop Club logo, Desktop Club badge, and mascot/operator cutout.
- [ ] Export PNG sizes for `assets/brand`, `src/assets`, `src/pet/assets`, and `build/icons`.
- [ ] Generate `build/icons/icon.icns` with `iconutil`.
- [ ] Generate `build/icons/icon.ico` with ImageMagick.
- [ ] Write `assets/brand/brand-assets-manifest.json` and `assets/brand/README.md`.

### Task 3: Run Export And Inspect Outputs

**Files:**
- Modify generated assets under `assets/brand/`, `src/assets/`, `src/pet/assets/`, and `build/icons/`.

- [ ] Run `node scripts/export-brand-assets.mjs`.
- [ ] Verify generated image dimensions with `sips`.
- [ ] Preview key assets: app icon, product logo, Desktop Club logo, and mascot cutout.

### Task 4: Verify App Integration

**Files:**
- Existing references in `package.json`, `index.html`, and `src/pet/renderer/SpriteManager.ts`.

- [ ] Confirm Electron builder still references `build/icons/icon.ico`, `build/icons/icon.icns`, and `build/icons`.
- [ ] Confirm Web and Pet paths now point to regenerated files.
- [ ] Run `npm test -- src/__tests__/brand-assets.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.

### Task 5: Refresh Mascot To Selected B Direction

**Files:**
- Modify: `scripts/export-brand-assets.mjs`
- Modify: `src/__tests__/brand-assets.test.ts`
- Modify generated assets under `assets/brand/`, `src/assets/`, `src/pet/assets/`, and `build/icons/`.

- [x] Save the selected B concept as a reference asset under `assets/brand/concepts/`.
- [x] Update the SVG mark to use the cute 3D-flat hybrid crayfish operator: round head/body, close friendly eyes, cheek blush, waving claw, segmented abdomen, tail, legs, and a side diagnostic terminal that does not cover the face.
- [x] Update the manifest/README direction text to record the D2/B mascot direction.
- [x] Run `npm run brand:export`.
- [x] Preview the app icon, product logo, Desktop Club logo, and pet mascot.
- [x] Run `npm test -- src/__tests__/brand-assets.test.ts`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.

### Task 6: Switch Official Brand Pack To AI Raster Masters

**Files:**
- Modify: `scripts/export-brand-assets.mjs`
- Modify: `src/__tests__/brand-assets.test.ts`
- Modify generated assets under `assets/brand/`, `src/assets/`, `src/pet/assets/`, and `build/icons/`.

- [x] Regenerate official visuals with image-to-image AI masters instead of local SVG recreation.
- [x] Make OpenClaw Desktop the product brand in manifest, README, and product logo output.
- [x] Keep OpenClaw Desktop Club as the community/site logo brand.
- [x] Restrict local tooling to resize, crop, icon packaging, and manifest generation.
- [x] Preserve compatibility output at `assets/brand/openclaw-logo-horizontal-1200x360.png`.

### Task 7: Rebuild Assets From Image2 Chroma Masters With Verified Alpha

**Files:**
- Modify: `scripts/export-brand-assets.mjs`
- Modify: `src/__tests__/brand-assets.test.ts`
- Create/modify: `assets/brand/source/*-chroma-master.png`
- Create/modify: `assets/brand/source/*-transparent-master.png`
- Create/modify generated transparent and panel assets under `assets/brand/`, `src/assets/`, `src/pet/assets/`, and `build/icons/`.

- [x] Generate image2 artwork on pure chroma background so visual quality comes from the model.
- [x] Archive raw chroma masters under `assets/brand/source/` and `assets/brand/raw-ai-renders/`.
- [x] Convert chroma masters to real alpha PNG masters using deterministic color-key processing.
- [x] Export light/dark transparent logos for OpenClaw Desktop and OpenClaw Desktop Club.
- [x] Export semi-transparent light/dark gradient panel variants.
- [x] Add tests that require RGBA PNGs with transparent corner pixels.
