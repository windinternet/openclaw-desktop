# Release Guide

OpenClaw Desktop publishes desktop installers through GitHub Releases. The release pipeline uses `electron-builder` and GitHub Actions.

## Release Flow

1. Update `package.json` version, for example from `0.1.0` to `0.2.0`.
2. Add release notes at `docs/release-notes/vX.Y.Z.md`.
3. Commit the version and release notes changes.
4. Create an annotated tag:

```bash
git tag -a v0.2.0 -m "Release v0.2.0"
```

5. Push the tag:

```bash
git push origin v0.2.0
```

GitHub Actions will build all configured packages and create a GitHub Release for the tag.

If `docs/release-notes/<tag>.md` exists, the release workflow uses that file as the GitHub Release body. If it does not exist, the workflow falls back to GitHub's generated release notes. The `.github/release.yml` file only configures GitHub's generated release notes categories; it is not a hand-written changelog source, and direct commits without pull request labels may only produce a full changelog link.

## Release Notes Rule

The release notes file must exist before the release tag is created. The release workflow checks out the tagged commit, so the tagged commit must already contain `docs/release-notes/<tag>.md`.

Use this order for every release:

```bash
npm version 0.1.3 --no-git-tag-version
# Write docs/release-notes/v0.1.3.md
git add package.json package-lock.json docs/release-notes/v0.1.3.md
git commit -m "chore: release v0.1.3"
git tag -a v0.1.3 -m "Release v0.1.3"
git push origin main
git push origin v0.1.3
```

Do not create the tag before committing the release notes. If the tag points to a commit without `docs/release-notes/<tag>.md`, the workflow cannot read the hand-written release body and will fall back to generated notes.

## Manual Dry Run

Use the `Build & Release` workflow's `workflow_dispatch` button to run packaging manually.

- Running it on a branch builds packages and uploads workflow artifacts only.
- Running it on a `v*` tag also creates or updates the GitHub Release for that tag.

## Artifact Matrix

| Platform | Architecture | Artifacts |
| --- | --- | --- |
| macOS | x64 | `.dmg`, `.zip` |
| macOS | arm64 | `.dmg`, `.zip` |
| Windows | x64 | installer `.exe`, portable `.exe` |
| Windows | arm64 | installer `.exe`, portable `.exe` |
| Linux | x64 | `.AppImage`, `.deb`, `.rpm`, `.tar.gz` |
| Linux | arm64 | `.AppImage`, `.deb`, `.rpm`, `.tar.gz` |

Linux package guidance:

- Use `.deb` for Debian, Ubuntu, and derivatives.
- Use `.rpm` for Fedora, RHEL, openSUSE, and derivatives.
- Use `.AppImage` as the broad portable Linux package.
- Use `.tar.gz` for users who prefer unpacked archives or custom install scripts.

## Current Signing Policy

The current release pipeline intentionally produces unsigned packages so public downloads can start without Apple Developer or Windows code-signing credentials.

Expected user-facing caveats:

- macOS may show a Gatekeeper warning for unsigned or unnotarized apps.
- Windows SmartScreen may warn on unsigned installers until signing and reputation are established.
- Linux package managers may warn that packages are not signed by a distro repository key.

## Future macOS Signing and Notarization

To enable signed and notarized macOS releases, add the required Apple Developer certificate and credentials as GitHub Secrets, then update the release workflow to allow code-signing identity discovery.

Typical secrets:

- `CSC_LINK`: Base64-encoded `.p12` certificate or a secure URL to it.
- `CSC_KEY_PASSWORD`: Certificate password.
- `APPLE_ID`: Apple Developer account email.
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for notarization.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

## Future Windows Signing

To enable Windows code signing, add a code-signing certificate and password as GitHub Secrets.

Typical secrets:

- `WIN_CSC_LINK` or `CSC_LINK`: Base64-encoded certificate or secure URL.
- `CSC_KEY_PASSWORD`: Certificate password.

After signing is enabled, keep the unsigned workflow path available for forks that do not have access to private signing secrets.

## Local Verification

Run these before pushing a release tag:

```bash
npm run typecheck
npm run build
npx electron-builder --mac dmg zip --x64 --publish never
```

Full Windows/Linux/arm64 packaging is verified by GitHub Actions because those outputs depend on platform-specific runners.
