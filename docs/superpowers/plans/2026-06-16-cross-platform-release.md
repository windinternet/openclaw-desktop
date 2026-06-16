# Cross-Platform Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tag-triggered GitHub Release pipeline for OpenClaw Desktop with x64/arm64 artifacts across macOS, Windows, and Linux.

**Architecture:** Keep electron-builder as the packaging layer and GitHub Actions as the release orchestrator. Store target definitions in `package.json`; run one build job per OS/arch runner; publish downloaded artifacts from a release job.

**Tech Stack:** Electron, Vite, electron-builder, GitHub Actions, npm, softprops/action-gh-release.

---

### Task 1: Expand electron-builder targets

**Files:**
- Modify: `package.json`

- [ ] Add stable artifact naming at `build.artifactName`.
- [ ] Replace single-target platform configs with macOS DMG/ZIP, Windows NSIS/portable, and Linux AppImage/deb/rpm/tar.gz targets.
- [ ] Add target-specific Windows artifact names so installer and portable `.exe` files do not collide.
- [ ] Add Linux package metadata: maintainer, category, executable name.

### Task 2: Replace release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] Trigger on `v*` tags and `workflow_dispatch`.
- [ ] Create a build matrix for macOS x64/arm64, Windows x64/arm64, Linux x64/arm64.
- [ ] Install Linux system dependencies for rpm/AppImage builds.
- [ ] Run `npm ci`, `npm run build`, then `npx electron-builder ... --publish never`.
- [ ] Upload package artifacts with `if-no-files-found: error`.
- [ ] Download all artifacts on tag refs, create SHA256 checksums, and publish a GitHub Release.

### Task 3: Document release operations

**Files:**
- Create: `docs/RELEASE.md`

- [ ] Document the release flow: update version, commit, create tag, push tag.
- [ ] Document all expected artifact formats and intended Linux package audiences.
- [ ] Document unsigned-app caveats for macOS and Windows.
- [ ] Document future signing/notarization secrets.
- [ ] Document manual dry-run behavior with `workflow_dispatch`.

### Task 4: Verify

**Commands:**
- `npm run typecheck`
- `npm run build`
- `npx electron-builder --mac dmg zip --x64 --publish never`

The local macOS verification proves config parsing and macOS packaging. The full platform matrix is verified by GitHub Actions because Windows, Linux, and arm64 outputs depend on their runner environments.
