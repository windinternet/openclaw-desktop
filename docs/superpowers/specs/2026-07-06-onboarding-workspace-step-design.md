# Onboarding Workspace Step Design

## Goal

Fix the opening golden path so workspace setup is step 4 of onboarding, not a Dashboard section.

## Scope

- After language/theme and Gateway connection, keep users inside the same Setup wizard and advance to a fourth workspace step.
- The fourth step first offers three directions: skip for now, create a work repository, or bind an existing repository. Create and bind use separate follow-up flows instead of exposing the full generic repository gate.
- Skipping enters the app through the existing lightweight new-session path.
- If users skip and later open Workbench or Knowledge, the existing `RepositoryGate` remains the prominent setup surface.
- Dashboard returns to being an observation page only: current work, pending confirmations, stuck items, outputs, knowledge updates, usage, and Gateway status.

## Non-Goals

- Do not expand ActionRun, Artifact, or desktop message card behavior.
- Do not add a second repository binding model; onboarding may use a narrower UI while reusing the existing binding, inspect, bootstrap, adapt, and semantic mapping functions.
- Do not change RepositoryGate semantics.
- Do not auto-map or auto-migrate existing repositories. Existing repository adaptation still requires explicit approval.

## Design

Add the workspace step directly to `SetupPage`, matching the existing appearance/language/connection Stepper UI. `WorkSystemWorkspaceChoice` owns a narrow onboarding flow: create asks for a repository save location and initializes the recommended Desktop-host structure; bind asks for an existing repository and inspects it before offering semantic mapping or approved adaptation. When the connected Gateway is remote, the flow first asks whether the repository should live on the Desktop host or Gateway host. Move first-matter creation and skip handling from Dashboard into Setup step 4.

Update `WORK_SYSTEM_ONBOARDING_ROUTE` to `/setup?step=workspace`. Setup connection success advances to step 4 without marking initialization complete; final "start using", skip, or first-matter creation marks initialization complete before leaving Setup. Welcome continues using the same constant after connection.

Remove Dashboard's onboarding query handling, onboarding state, workspace choice rendering, and first-matter creation handlers. Dashboard should still surface repository-unavailable observations in existing summary sections, but it should not present the full workspace setup flow.

## Verification

- Static tests prove connection-success onboarding routes to Setup step 4.
- Static tests prove Dashboard no longer imports or renders `WorkSystemWorkspaceChoice`.
- Existing skipped-workspace carryover tests continue to prove the lightweight session path works.
- Run the focused onboarding and dashboard tests.
