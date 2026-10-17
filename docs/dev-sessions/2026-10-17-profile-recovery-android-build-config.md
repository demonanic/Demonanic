# Saved Profile Recovery — Android Build Configuration Guard

Date: 2026-10-17

## Starting state and preservation

- Starting/ending application branch: `feature/castle-management-first-pass`.
- Starting/ending HEAD: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Initial working tree had pre-existing edits in `backend/server.py`, `frontend/src/App.js`, `frontend/src/api.js`, `frontend/src/context/GameProvider.jsx`, `frontend/src/game/towerPlacement.test.js`, `frontend/src/screens/Home.jsx`, plus untracked recovery tests/reports, `frontend/src/apiConfig.js`, `frontend/src/apiConfig.test.js`, and `frontend/src/context/GameProvider.test.jsx`/`Home.test.js`. These were preserved.
- This session's application changes are limited to `frontend/package.json`, `.github/workflows/castle-management-build.yml`, and two new validator/test files under `frontend/scripts/`. No prior recovery/game/menu source was overwritten.
- No reset, clean, stash, branch switch, local commit, install, or launch occurred.

## Why the installed APK had no backend URL

React Scripts (CRA) replaces `process.env.REACT_APP_*` when the frontend is bundled. This value is not read at Android app runtime. Capacitor sync copies `frontend/build` into the Android project, and Gradle packages those static files; neither step injects a missing environment variable. There are no frontend `.env` files in this checkout. The current shell also has `REACT_APP_BACKEND_URL` unset.

Both checked-in workflows were compared without printing secret values:

- `.github/workflows/demonanic-pages.yml` sets the public backend host `https://demonanic.onrender.com` on its `npm run build` step, then deploys the web bundle.
- `.github/workflows/castle-management-build.yml` also sets that host on the frontend build step, then runs Capacitor sync and Gradle. This session changed that workflow to call `npm run build:android` instead of generic `npm run build`.
- The old `frontend/package.json` scripts had only `start`, `build`, and `test`; generic `npm run build` had no backend URL preflight. A local/manual Android build with the variable unset could therefore compile `undefined/api` and then have Capacitor embed it.

The installed APK's compiled expression (`void 0` plus `undefined/api`) proves its JS bundle was compiled without a backend value (or that stale unconfigured assets were embedded). It predates the current auth-safe recovery UI. The current workflows have the correct setting, so that APK did not come from their current correctly configured build path. Its exact historical shell command/workflow run cannot be identified because the installed artifact has no build-commit provenance and no matching APK artifact was available to compare. This is the exact mechanism; the specific producer remains unknown.

## Configuration fix

- Added `frontend/scripts/validate-android-backend.cjs`. It rejects missing/malformed values, non-HTTPS URLs, credentials, query/fragment, paths, localhost, and any origin other than `https://demonanic.onrender.com`. It does not substitute a fallback URL and emits only a clear error or public backend hostname.
- Added `npm run build:android`, which runs the validator before `craco build`.
- Updated the Android build workflow to run `npm run test:android-config` and then `npm run build:android`; its existing public URL value remains configured at the build step. The Pages workflow already supplies the same expected URL and remains on its web `npm run build` command.
- Added Node tests for the expected host, missing-config CLI failure, invalid/insecure/unrelated/credential-bearing URLs, and no localhost fallback. No secrets were added.

## New APK verification

`REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android`, `npx --no-install cap sync android`, and `./gradlew assembleDebug` all succeeded. The assembled debug APK is local at `frontend/android/app/build/outputs/apk/debug/app-debug.apk`; it was **not installed or launched**. A static scan of its bundled JavaScript found one JS bundle with the expected backend hostname, no `undefined/api`, and the strings `SAVED PROFILE NOT FOUND`, `CONTINUE WITH DEVICE SAVE`, and `START NEW GAME`; the old `NEW PROFILE CREATED` marker is absent. This verifies that the Android artifact includes the current recovery UI and configured hostname. It does not verify runtime network/auth or saved profile behavior.

The old installed APK remains untouched and unsafe to launch because it lacks the recovery prompt and contains the old `NEW PROFILE CREATED` marker.

## Profile guard and data-safety review

Current `GameProvider.loadGame()` distinguishes explicit `{state: null}` from malformed responses and request failures. Unauthenticated, 401, network, and server errors do not create a new state. A valid local backup requires explicit player selection; the device-only save path keeps server writes disabled. New-game action is explicit and authenticated. Backend creation uses `insert_one` and the existing unique `user_id` index; duplicate attempts return conflict instead of replacing a record. The regular PUT endpoint is still upsert, so it must not be used for diagnostics. The existing state GET accrues offline resources and writes `lastSeen`; it was not called.

The original account ID is not available in safe local metadata, `EXPECTED_USER_ID` is unset, and no authorized read-only Mongo connection/operator path is available. No database query, API request, account action, or save was performed. The original record remains **unverified**. The next safe action is an authorized operator using trusted private account identity and a Mongo user limited to `read` on the required collections to return only user-record/state-record/valid-shape booleans via `findOne`.

ADB check: `/usr/bin/adb get-state` returned `device`; `/usr/bin/adb devices -l` showed the active TCP transport. No pairing/reconnect was needed. The APK was not installed or started.

## Verification results

| Command / check | Exit | Result |
| --- | ---: | --- |
| `npm run test:android-config` (frontend) | 0 | 4 Node tests passed. |
| `env -u REACT_APP_BACKEND_URL npm run build:android` (frontend) | 1, expected | Failed clearly before CRACO: `REACT_APP_BACKEND_URL is required for Android production builds.` |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` (frontend) | 0 | 2 suites/19 tests passed. Mocked frontend tests. |
| `CI=true npm test -- --watchAll=false --runInBand` (frontend) | 0 | 10 suites/61 tests passed. Frontend unit tests, not backend integration. |
| `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` (frontend) | 0 | Configured production frontend build passed; Node warning `[DEP0176] fs.F_OK is deprecated`. |
| `npx --no-install cap sync android` (frontend) | 0 | Capacitor sync passed. |
| `./gradlew assembleDebug` (Android project) | 0 | APK assembled. Gradle warned about experimental `android.aapt2FromMavenOverride` and `flatDir`; build succeeded (93 actionable tasks). |
| Static bundled-JS scan of assembled APK | 0 | Expected host and all recovery markers present; `undefined/api` and old auto-create marker absent. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Python syntax compilation passed. |
| `python -m pytest backend/tests/test_profile_creation_safety.py -q` | 1 | Blocked because `pytest` is not installed. No real Mongo/backend test ran. |
| `/usr/bin/adb get-state`; `/usr/bin/adb devices -l` | 0 | Device connected over TCP. No install/launch. |
| `git diff --check` | 0 | Passed after edits. |

An initial asset scan used the repository root instead of `frontend/build` and found zero bundles. The corrected scan found the one generated bundle and verified the markers above.

## End state

- Existing feature-branch recovery, tower-placement, menu, and test changes remain local and uncommitted. The build validator and Android workflow change are also local and uncommitted.
- Documentation-only publication to `docs/development-reports-2026-10-15` will be recorded after GitHub readback.
- The original save remains unverified. No profile/database/app data changed; no API route was called. No merge, deployment, or gameplay-code publication occurred.
