# Manual Android Persistence Smoke Test

Date: 2026-10-17

## Starting and ending repository state

- Starting branch: `feature/castle-management-first-pass`.
- Starting HEAD: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Starting worktree contained prior modified application/workflow files and untracked reports, tests, and configuration files. All pre-existing work was preserved.
- This reporting session did not change application source, switch branches, reset, clean, stash, or overwrite any work. The ending application branch and HEAD remain the same; only the four reporting documents listed below were edited/created locally.

## User-reported device test

The user reports that the corrected APK was installed on their Android phone. On startup, it displayed **SAVED PROFILE NOT VERIFIED**, with a device-save option and retry button. The user selected **RETRY LOAD** and reports that the existing **Keep Command** profile loaded successfully, including the existing resources and a completed Thought Lance research notification.

The user then deleted a tower, exited the game, reopened it, and confirmed that the tower was still gone.

**Outcome:** successful manual Android persistence smoke test for (1) retry-loading this existing profile and (2) persistence of this tower deletion across an app restart. This evidence is user-reported; the agent did not independently control or observe the device session. It does not verify every cloud-save path, explicit new-profile creation, or duplicate/concurrent creation.

## Checks and limitations

- No automated tests, build, ADB command, backend request, or database query was run during this docs-only session. No new test result is claimed.
- Prior report `docs/dev-sessions/2026-10-17-profile-create-save-readiness.md` records frontend tests (10 suites/61 tests), Android configuration tests (4/4), production frontend/Capacitor/Android debug builds, Python syntax compilation, and the backend test limitation. Those are historical results, not rerun here.
- Backend runtime tests remain unverified. The prior attempt to run backend pytest was blocked because `pytest` and required backend runtime dependencies were unavailable. There is no authorized disposable test account/database in this environment. A backend runtime test is still needed to verify authenticated explicit profile creation, insert-only duplicate rejection (including concurrency), and subsequent cloud saving without touching production player data.
- No claim is made about whether the original MongoDB record was independently inspected. The successful profile load on the phone is evidence of the user's observed recovery behavior, not an operator-side database query.

## Files changed

- `DEVELOPMENT_LOG.md` — appended this session's user-reported result and scope limits.
- `ROADMAP.md` — updated profile-recovery status and recorded the smoke-test evidence while keeping backend runtime gaps open.
- `TEST_REPORT.md` — added the manual test steps, result, provenance, and limitations.
- `docs/dev-sessions/2026-10-17-android-persistence-smoke-test.md` — this detailed session report.

No game code, profile, app data, backend/production data, or APK was modified by this reporting session. The device actions described above were performed by the user.

## Commands and publication

- `git status --short --branch`, `git rev-parse HEAD`, `git branch --show-current`, `git diff --stat`, and `git diff --check` were used to inspect the repository before editing; the initial whitespace check passed.
- No application test or build was run because this session only documents the user's manual test.
- Published only `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this report to `docs/development-reports-2026-10-15` in documentation-only commit `97cc84c36a205408b6bbe889baddb288b73b0517`. GitHub readback verified all four paths; the commit changed only those Markdown files. Direct commit link: https://github.com/demonanic/Demonanic/commit/97cc84c36a205408b6bbe889baddb288b73b0517.
- No application changes were committed or pushed. No merge or deployment occurred, and production data was not changed.
