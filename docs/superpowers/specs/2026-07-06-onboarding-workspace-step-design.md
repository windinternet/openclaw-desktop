# Onboarding Workspace Step Design

## Goal

Fix the opening golden path so workspace setup is step 4 of onboarding, not a Dashboard section.

## Scope

- After language/theme and Gateway connection, keep users inside the same Setup wizard and advance to a fourth workspace step.
- The fourth step offers skip, create recommended repository, bind existing repository, and map/adapt existing repository.
- Skipping enters the app through the existing lightweight new-session path.
- If users skip and later open Workbench or Knowledge, the existing `RepositoryGate` remains the prominent setup surface.
- Dashboard returns to being an observation page only: current work, pending confirmations, stuck items, outputs, knowledge updates, usage, and Gateway status.

## Non-Goals

- Do not expand ActionRun, Artifact, or desktop message card behavior.
- Do not add a second repository binding implementation.
- Do not change RepositoryGate semantics.
- Do not auto-create, auto-map, or auto-migrate repositories.

## Design

Add the workspace step directly to `SetupPage`, matching the existing appearance/language/connection Stepper UI. Reuse `WorkSystemWorkspaceChoice` and its existing RepositoryGate integration. Move first-matter creation and skip handling from Dashboard into Setup step 4.

Update `WORK_SYSTEM_ONBOARDING_ROUTE` to `/setup?step=workspace`. Setup connection success advances to step 4 without marking initialization complete; final "start using", skip, or first-matter creation marks initialization complete before leaving Setup. Welcome continues using the same constant after connection.

Remove Dashboard's onboarding query handling, onboarding state, workspace choice rendering, and first-matter creation handlers. Dashboard should still surface repository-unavailable observations in existing summary sections, but it should not present the full workspace setup flow.

## Verification

- Static tests prove connection-success onboarding routes to Setup step 4.
- Static tests prove Dashboard no longer imports or renders `WorkSystemWorkspaceChoice`.
- Existing skipped-workspace carryover tests continue to prove the lightweight session path works.
- Run the focused onboarding and dashboard tests.
