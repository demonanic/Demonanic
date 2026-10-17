# Demonanic Profile Creation and Save Readiness

Date: 2026-10-17

## Starting state and preservation

- Starting branch: `feature/castle-management-first-pass`.
- Starting HEAD: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- The branch was one local commit ahead of `origin/feature/castle-management-first-pass`.
- Before edits, modified tracked files were `.github/workflows/castle-management-build.yml`, `backend/server.py`, `frontend/package.json`, `frontend/src/App.js`, `frontend/src/api.js`, `frontend/src/context/GameProvider.jsx`, `frontend/src/game/towerPlacement.test.js`, and `frontend/src/screens/Home.jsx`.
- Pre-existing untracked files included `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, `backend/tests/test_profile_creation_safety.py`, `docs/dev-sessions/`, `frontend/scripts/`, `frontend/src/apiConfig.js`, `frontend/src/apiConfig.test.js`, `frontend/src/context/GameProvider.test.jsx`, and `frontend/src/screens/Home.test.js`. All were preserved.
- No reset, clean, stash, branch switch, or local commit occurred. No merge, deployment, production data change, app install, or app launch occurred.

## Review and implementation

Reviewed Android backend URL validation and build workflow, auth boot/login/register, API configuration, GameProvider saved-profile recovery and save gating, and backend GET/POST/PUT state routes.

- The Android-only build script validates `REACT_APP_BACKEND_URL` before invoking CRA. It rejects absent, malformed, non-HTTPS, credential-bearing, path/query-bearing, localhost, and incorrect-host values. It requires the configured HTTPS origin for `demonanic.onrender.com`; it has no localhost or alternate-backend fallback. The CI Android workflow runs its config tests and uses this guarded build.
- `GameProvider.loadGame()` keeps cloud saves disabled while checking. An authenticated successful response with explicit `{state: null}` displays the explicit new-game option. A malformed/empty response, an invalid state, missing authentication, or a rejected request leaves the game in an error state; none calls creation or save. A valid state enables cloud save. A valid local backup requires explicit selection and remains device-only with cloud writes disabled.
- Explicit new-game confirmation checks user/token and coalesces rapid clicks. It calls backend POST creation; cloud saves are enabled only after that succeeds. Backend creation uses `insert_one`; its unique `game_states.user_id` index rejects duplicate/concurrent inserts with HTTP 409 rather than replacing a state. Normal later saves use the existing PUT endpoint. Client behavior is covered by mocks; the actual backend/database path was not exercised.
- Extended the existing GameProvider test to assert a successful explicit create enables a later save.
- The auth path previously logged login/register success response objects containing the JWT; raw Axios errors could also include request configuration. Replaced those logs and profile/API raw-error logs with event-only messages or status/code metadata. No credentials were printed or collected.

## Verification

| Command/check | Exit | Result |
| --- | ---: | --- |
| `git branch --show-current`, `git rev-parse HEAD`, `git status --short --branch`, `git diff --stat`, `git diff`, `git diff --check` | 0 | Confirmed feature branch and preserved pre-existing changes; no whitespace errors. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 10 suites, 61 tests passed. Frontend/provider/backend-call behavior is mocked; it does not verify actual cloud writes. |
| `npm run test:android-config` (from `frontend/`) | 0 | 4 Node tests passed. |
| `env -u REACT_APP_BACKEND_URL npm run build:android` | 1, expected | Failed clearly before CRA because the variable is required. |
| `REACT_APP_BACKEND_URL='not a URL' npm run build:android` | 1, expected | Failed clearly before CRA because the URL is malformed. |
| `REACT_APP_BACKEND_URL='http://demonanic.onrender.com' npm run build:android` | 1, expected | Failed clearly because production Android configuration requires HTTPS. |
| `REACT_APP_BACKEND_URL='https://wrong.example.invalid' npm run build:android` | 1, expected | Failed clearly because the configured host is incorrect. |
| `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` | 0 | Production frontend build succeeded. Final build retained Node `[DEP0176] fs.F_OK` deprecation warning; it had no ESLint warning after removing a stale hook dependency. |
| `npx --no-install cap sync android` | 0 | Capacitor sync succeeded. |
| `./gradlew assembleDebug` (from `frontend/android/`) | 0 | Android debug build succeeded; 93 Gradle tasks. Warnings: experimental AAPT2 override and `flatDir` metadata support. |
| Static APK JavaScript asset scan | 0 | One bundle includes the expected backend hostname, missing-profile prompt, local-save choice and explicit new-game choice; no `undefined/api` or old auto-create marker. APK size is 6,747,835 bytes. An initial scan targeted the wrong APK asset prefix and failed to find a bundle; the corrected scan of `assets/public/static/js/` passed. |
| `python -m py_compile backend/server.py backend/auth.py backend/tests/test_profile_creation_safety.py` | 0 | Syntax compilation passed; this does not run the server. |
| `python -m pytest backend/tests/test_profile_creation_safety.py -q` | 1 | Blocked because `pytest` is not installed. No real backend or Mongo test ran. |
| `command -v adb`, `adb version`, `adb get-state` | 0 | `/usr/bin/adb` 34.0.4 reports a connected device. No install or launch. |
| Final `git diff --check` | 0 | Passed. |

An initial configured frontend build emitted an ESLint warning that `user.username` was an unnecessary `loadGame` dependency. After log redaction removed the username use, the dependency was removed and the build rerun without the ESLint warning. The Node deprecation and Gradle configuration warnings remain.

## Readiness and remaining backend test

**Decision: safe to install for controlled testing.** The built APK is local at:

`/root/Demonanic/frontend/android/app/build/outputs/apk/debug/app-debug.apk`

Size: **6,747,835 bytes**. It was not installed or launched. An in-place installation command is:

```sh
/usr/bin/adb install -r /root/Demonanic/frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

This is an update/install command only. It does not launch the app, clear app data, or uninstall it. If Android rejects the update due to signature/version compatibility, stop; do not uninstall or clear storage. Launching the app with a production account may load state and perform the backend's existing accrual/`lastSeen` update. Do not select **START NEW GAME** against production unless the player explicitly approves creating that record.

Actual authenticated creation and cloud saving remain unverified. The minimum runtime test is an explicitly authorized disposable test account on the intended backend (or an isolated equivalent): authenticate; make the explicit create request and verify HTTP 201; repeat creation and verify HTTP 409 while the first state remains unchanged; save a known test change through PUT; confirm only the disposable account's state with a genuinely read-only database query. Do not register an account or write production data without explicit approval. The `GET /api/game/state` route is not needed for this check and was not called.

## Files changed in this session

- `frontend/src/context/AuthContext.jsx`, `frontend/src/api.js`, `frontend/src/context/GameProvider.jsx`: remove authentication/profile logging of response bodies, raw errors, token-bearing objects, and user identity; retain safe status/code diagnostics.
- `frontend/src/context/GameProvider.test.jsx`: assert a post-creation explicit save uses the cloud save API after successful creation.
- `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this dated report: record actual checks, APK details, and backend-runtime limitation.

No files were deleted. Existing tower-placement, main-menu, recovery, backend, workflow, and other tests remain present and uncommitted. No application code was published.

## Documentation publication

Published only `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this report to `docs/development-reports-2026-10-15` in documentation-only commit [`26cdeb6effef15ce786aa01254b71c46deb9dff5`](https://github.com/demonanic/Demonanic/commit/26cdeb6effef15ce786aa01254b71c46deb9dff5). GitHub readback succeeded for all four paths, and the commit's changed-path list contains only those Markdown files. No merge or deployment occurred.
