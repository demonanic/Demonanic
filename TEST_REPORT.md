# Test Report

Updated: 2026-10-17

## Tower placement and main menu development session

Commands were run from `frontend/` unless stated otherwise. Results below are from the completed development work on commit `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad` plus its uncommitted menu/test changes.

| Command | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/game/towerPlacement.test.js src/screens/Home.test.js` | 0 | 2 suites passed; 8 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` | 0 | 8 suites passed; 42 tests passed. |
| `npm run build` | 0 | Optimized production build compiled successfully. Node printed a deprecation warning for `fs.F_OK`; build completed. |
| `git diff --check` | 0 | No whitespace errors. |

The placement tests cover shared saved coordinates, selected slot propagation, slot persistence during tower creation, occupied-slot rejection, stable explicit assignments, legacy occupancy assignment, and nearest-free-slot selection. The menu tests cover displayed current values, unavailable Food state, skull crest presence, existing navigation, and logout wiring.

## Reporting turn

No application tests or build were run during the documentation-only reporting turn. The results above are preserved from the preceding work session and are not represented as newly run in this turn.

## Documentation publication session

- No application tests or build were run; this session only published and read back Markdown reports through the connected GitHub repository.
- GitHub confirmed the publication commit changes only `ROADMAP.md`, `DEVELOPMENT_LOG.md`, `TEST_REPORT.md`, and `docs/dev-sessions/2026-10-15-tower-placement-main-menu.md`.
- Follow-up documentation commit `377a7a03ef6e01da749e9128989156a23f3ffed4` was read back from the branch tip; its changed paths are the five Markdown report files only.

## Limitations

- Android device/emulator layout and touch behavior have not been visually verified.
- Visual-reference files were not available in the repository or message context.
- Food is not tracked by current game state and is rendered as `N/A`.

## 2026-10-16 Android saved profile recovery investigation

This was a source and environment investigation only. No backend endpoints or database were contacted, and no Android app data was read or changed.

| Command | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/game/logic.economy.test.js` (from `frontend/`) | 0 | 1 suite passed; 3 tests passed. This is a local gameplay logic suite and does not cover authentication or profile recovery. |
| `git diff --check` | 0 | No whitespace errors. |

No profile recovery, auth, Android, or backend integration test was run. The backend test suite registers users and writes game state, so it was not run against the configured/preview service. No production build was run because source code was not changed. `adb devices -l` returned no connected device. Source inspection found no dedicated AuthContext or GameProvider profile recovery tests.

The startup hazard is confirmed in source: after authenticated `GET /game/state` returns `{state: null}`, `GameProvider.loadGame` checks a same-user local backup and, if absent, creates a fresh state and immediately saves it. Whether this caused the player's incident is unconfirmed without device logs, the installed APK's build configuration, and a safe server-side check of the player's exact account identity and profile existence.

## 2026-10-16 Android profile recovery diagnostics

No application tests or build were run; this stage was diagnosis-only and made no application changes. The prior session's test results above are not new results from this stage.

| Command / check | Result |
| --- | --- |
| `git status --short --branch`, `git branch --show-current`, `git rev-parse HEAD` | Branch `feature/castle-management-first-pass`, HEAD `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`; pre-existing working changes preserved. |
| `adb devices -l` | No connected Android device. No startup logcat was available. |
| `command -v mongosh`, `command -v mongo` | Neither Mongo shell was available. |
| Shell presence check for `MONGO_URL`, `DB_NAME`, `REACT_APP_BACKEND_URL` | All unset in this environment; values were not printed. No repository `.env*` file was found in the bounded scan (file contents were not read). |
| Source scan for Mongo diagnostics and game state routes | No existing read-only profile diagnostic route/script found. `GET /api/game/state` is not read-only: it accrues offline resources and updates `lastSeen`. |
| `git diff --check` | Exit 0; no whitespace errors. |

The prior diagnostic stage did not collect runtime request status, user ID, API hostname, or state-present/null result. See the next session report below for the subsequent safe ADB connection and log inspection.

## 2026-10-16 ADB connection attempt

| Command / check | Exit | Result |
| --- | ---: | --- |
| `adb connect 192.168.1.235:40495` | 1 | Failed before device connection: `/data/data/com.termux/files/usr/bin/adb` could not load symbol `_ZNSt6__ndk113__hash_memoryEPKvm`. |
| Check common Ubuntu Android SDK ADB paths | 0 (no candidates found) | No executable at `/usr/bin/adb`, `/usr/local/bin/adb`, `/usr/lib/android-sdk/platform-tools/adb`, `/opt/android-sdk/platform-tools/adb`, or `/root/Android/Sdk/platform-tools/adb`. |

No device log collection or app/API calls followed the failure. `git diff --check` was rerun after documentation edits and passed (exit 0). No tests/build were run because application code did not change.

## 2026-10-16 Linux ADB diagnostics continuation

| Command / check | Exit | Result |
| --- | ---: | --- |
| `apt-get install -y adb` | 0 | Installed Ubuntu Noble `adb` package `1:34.0.4-1build3` and eight required dependencies from configured Ubuntu ports repositories. |
| `/usr/bin/adb version` | 0 | ADB 1.0.41, version 34.0.4-debian; Linux ARM64. |
| `/usr/bin/adb devices -l` (serial redacted) | 0 | One TCP/IP device in `device` state; its active endpoint matched the previously supplied endpoint. No stale port was attempted. |
| `/usr/bin/adb -s <active-device> shell pm path com.demonanic.game` | 0 | Demonanic package is installed. Only the package path was read. |
| `/usr/bin/adb logcat -d -v brief` through redacting filter | 0 | 237,537 lines scanned; 2 contained `Demonanic`, but none contained auth, game, API, or relevant console markers. Filter printed no raw logs, IDs, URLs, or secrets. |
| Static installed-APK backend-origin extraction | 0 | APK was read from the installed package into temporary storage; configured origin was not safely extracted. No URL was printed. |
| `/usr/bin/adb mdns services`, `/usr/bin/adb mdns check` | 1 each | ADB host service returned `unknown host service`; mDNS discovery was unavailable. Existing TCP/IP transport was already active, so pairing/reconnect was not attempted. |
| `git diff --check` | 0 | No whitespace errors. |

No app was launched and no API endpoint was called. User ID, backend host, expected identity comparison, and Mongo record existence remain unverified. No tests or build were run because application source did not change. Details: `docs/dev-sessions/2026-10-16-android-profile-recovery-linux-adb.md`.

## 2026-10-16 Saved profile recovery guard

| Command | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/context/GameProvider.test.jsx` (from `frontend/`) | 0 | 1 suite passed; 9 tests passed. Covers saved server state, explicit missing state, malformed/failed/unauthorized requests, unauthenticated provider, device-only local backup continuation, and explicit new-game creation. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 9 suites passed; 51 tests passed. |
| `npm run build` (from `frontend/`) | 0 | Production build compiled successfully. Node emitted the `fs.F_OK` deprecation warning. |
| `python -m py_compile backend/server.py` | 0 | Backend source syntax compiled. Runtime/backend endpoint tests were unavailable because FastAPI/Motor/PyMongo are not installed in this environment. |
| `git diff --check` | 0 | No whitespace errors. |

No Android app was launched and no API or database endpoint was called. Device identity, backend hostname, and existing Mongo profile presence remain unknown. No backend runtime integration test or production DB read occurred.

## 2026-10-17 Safe profile diagnostics and final verification

| Command / check | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` (from `frontend/`) | 0 | 2 suites passed; 19 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 10 suites passed; 61 tests passed. |
| `npm run build` (from `frontend/`) | 0 | Production frontend build compiled successfully. Node emitted the `fs.F_OK` deprecation warning. |
| Build-bundle check for `undefined/api` | 0 | One JS bundle scanned; no undefined API path literal after validation change. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Python syntax compilation passed. |
| `python -m pytest tests/test_profile_creation_safety.py -q` (from `backend/`) | 1 | Blocked: this Python environment has no `pytest` module. `/usr/bin/python3 -m pytest ...` was also unavailable. Backend dependencies `fastapi`, `motor`, and `pymongo` are absent. |
| `git diff --check` | 0 | No whitespace errors. |
| `/usr/bin/adb devices -l` | 0 | No devices attached; no app launch or device verification was performed. |

Backend duplicate/concurrent creation tests were added with a fake unique collection but could not be executed here. No read-only diagnostic endpoint/script was added: no authorized read-only Mongo connection or canonical backend host for a device diagnostic is available. Corresponding diagnostic authorization/no-mutation tests are blocked for the same reason; no record existence was checked.

### Final verification rerun — 2026-10-17

| Command / check | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` (from `frontend/`) | 0 | 2 suites passed; 19 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 10 suites passed; 61 tests passed. |
| `npm run build` (from `frontend/`) | 0 | Production build compiled successfully. Node emitted `[DEP0176] fs.F_OK is deprecated`. |
| `python -m pytest tests/test_profile_creation_safety.py -q` (from `backend/`) | 1 | Could not run: `pytest` module is not installed. |
| `git diff --check` | 0 | No whitespace errors. |

Backend Python syntax compilation and ADB checks are documented in the detailed 2026-10-17 session report; neither backend tests nor Android-device verification occurred in this environment. Frontend tests are mock/unit tests and do not establish that a production record exists.

## 2026-10-17 Installed APK and ADB follow-up

| Command / check | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` (from `frontend/`) | 0 | 2 suites, 19 tests passed; mocked client tests. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 10 suites, 61 tests passed; includes existing tower/menu tests. |
| `npm run build` (from `frontend/`) | 0 | Compiled successfully; Node emitted `[DEP0176] fs.F_OK is deprecated`. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Python syntax compilation passed; no server/database execution. |
| `python -m pytest tests/test_profile_creation_safety.py -q` (from `backend/`) | 1 | Blocked: `pytest` module is not installed. No real-backend test ran. |
| `/usr/bin/adb get-state` and `/usr/bin/adb devices -l` | 0 | Device connected over TCP transport; Demonanic was not launched. |
| Read-only package path/pull and APK bundle marker scan | 0 | Installed APK lacks expected backend hostname, contains `undefined/api`, and contains old auto-create marker without current recovery prompt. No secrets or profile data were printed. |
| `git diff --check` | 0 | Passed. |

No profile/database endpoint was called. Original user identity and Mongo record presence remain unverified. The APK evidence identifies a configuration/code defect but is not evidence that the original save is absent or present.

## 2026-10-17 Android build configuration guard

| Command / check | Exit | Result |
| --- | ---: | --- |
| `npm run test:android-config` (from `frontend/`) | 0 | 4 Node tests passed: expected host accepted; missing config produces nonzero CLI failure; malformed/insecure/localhost/unrelated/credential-bearing/path URLs rejected; no fallback host. |
| `env -u REACT_APP_BACKEND_URL npm run build:android` (from `frontend/`) | 1 (expected) | Stopped before CRACO with `Android production build blocked: REACT_APP_BACKEND_URL is required for Android production builds.` |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` | 0 | 2 suites/19 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` | 0 | 10 suites/61 tests passed. |
| `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` | 0 | Frontend production assets built; expected backend host validation passed. Node emitted `[DEP0176] fs.F_OK is deprecated`. |
| `npx --no-install cap sync android` | 0 | Capacitor copied guarded assets into the Android project. |
| `./gradlew assembleDebug` (from `frontend/android/`) | 0 | Debug APK assembled successfully (93 actionable tasks). Warnings: experimental AAPT2 override and `flatDir` metadata limitations. APK not installed/launched. |
| APK bundled-JS marker scan | 0 | One bundle; expected host and recovery markers present; `undefined/api` and the old auto-create marker absent. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Syntax compilation passed. |
| `python -m pytest backend/tests/test_profile_creation_safety.py -q` | 1 | Blocked: `pytest` module is not installed. No real Mongo/backend tests. |
| `/usr/bin/adb get-state`, `/usr/bin/adb devices -l` | 0 | Device connected over TCP; no install or launch. |
| `git diff --check` | 0 | Passed after source and documentation changes. |

An initial generated-bundle scan looked at the repository root and found zero bundles; the corrected scan of `frontend/build/static/js` found one bundle and verified the markers above. The assembled APK remains local only.

## 2026-10-17 Android build configuration guard

| Command / check | Exit | Result |
| --- | ---: | --- |
| `npm run test:android-config` (from `frontend/`) | 0 | 4 Node tests passed: expected host accepted; missing config produces nonzero CLI failure; malformed/insecure/localhost/unrelated/credential-bearing/path URLs rejected; no fallback host. |
| `env -u REACT_APP_BACKEND_URL npm run build:android` (from `frontend/`) | 1 (expected) | Stopped before CRACO with `Android production build blocked: REACT_APP_BACKEND_URL is required for Android production builds.` |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` | 0 | 2 suites/19 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` | 0 | 10 suites/61 tests passed. |
| `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` | 0 | Frontend production assets built; expected backend host validation passed. Node emitted `[DEP0176] fs.F_OK is deprecated`. |
| `npx --no-install cap sync android` | 0 | Capacitor copied guarded assets into the Android project. |
| `./gradlew assembleDebug` (from `frontend/android/`) | 0 | Debug APK assembled successfully (93 actionable tasks). Warnings: experimental AAPT2 override and `flatDir` metadata limitations. APK not installed/launched. |
| APK bundled-JS marker scan | 0 | One bundle; expected host present, `undefined/api` absent, and recovery prompt/device-save/new-game markers present. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Syntax compilation passed. |
| `python -m pytest backend/tests/test_profile_creation_safety.py -q` | 1 | Blocked: `pytest` module is not installed. No real Mongo/backend tests. |
| `/usr/bin/adb get-state`, `/usr/bin/adb devices -l` | 0 | Device connected over TCP; no install or launch. |
| `git diff --check` | 0 | Passed after source and documentation changes. |

An initial generated-bundle scan looked at the repository root and found zero bundles; the corrected scan of `frontend/build/static/js` found the bundle and verified the markers above. The assembled APK is a local artifact only.

## 2026-10-17 Read-only original-profile verification attempt

| Command / check | Exit | Result |
| --- | ---: | --- |
| `npm run test:android-config` (from `frontend/`) | 0 | 4 Node tests passed, including expected-host and missing/invalid-config behavior. |
| `git diff --check` | 0 | Passed; no whitespace errors. |
| `adb get-state` and `adb devices -l` | 0 | ADB reports a connected device; endpoint omitted from report. No app launch or storage/log read. |
| Presence checks for `MONGO_URL`, `DB_NAME`, `READ_ONLY_MONGO_URL`, `EXPECTED_USER_ID`, `REACT_APP_BACKEND_URL` | 0 | All unset; values were not printed. |
| `command -v mongosh` / `command -v mongo` availability checks | 0 | Both Mongo shells unavailable. |
| Source review of `GameProvider.loadGame()`, auth identity lookup, backend state routes | 0 | Auth resolves normalized username to `users.id`; `game_states.user_id` is the profile key. State GET accrues offline resources and updates `lastSeen`; PUT upserts. Neither endpoint was called. |

No database query, frontend full suite/build, or backend runtime test was run in this session. Existing test/build results from the preceding build-configuration session are recorded above and were not rerun. The profile's existence and validity remain unverified because the exact original username/account identity, independently confirmed target database, and authorized read-only DB access were unavailable. No credentials, user ID, game-state content, or raw device logs were collected.

## 2026-10-17 Profile creation and save readiness

| Command / check | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 10 suites and 61 tests passed. Includes saved profile, null/malformed/error loads, local-only fallback, explicit new-profile creation, post-create save, and rapid-confirm coalescing. Client/API calls are mocked. |
| `npm run test:android-config` (from `frontend/`) | 0 | 4 Node config tests passed. |
| `env -u REACT_APP_BACKEND_URL npm run build:android` | 1 (expected) | Clear required-variable error; CRA was not started. |
| `REACT_APP_BACKEND_URL='not a URL' npm run build:android` | 1 (expected) | Clear invalid HTTPS URL error; CRA was not started. |
| `REACT_APP_BACKEND_URL='http://demonanic.onrender.com' npm run build:android` | 1 (expected) | Clear HTTPS requirement error; CRA was not started. |
| `REACT_APP_BACKEND_URL='https://wrong.example.invalid' npm run build:android` | 1 (expected) | Clear expected-backend-host error; CRA was not started. |
| `REACT_APP_BACKEND_URL=https://demonanic.onrender.com npm run build:android` (from `frontend/`) | 0 | Optimized production frontend build succeeded. Final build had the existing Node `[DEP0176] fs.F_OK` deprecation warning and no ESLint warning. An earlier build emitted an unnecessary `user.username` hook dependency warning after log redaction; the dependency was removed and the build rerun. |
| `npx --no-install cap sync android` | 0 | Capacitor copied the production frontend assets and updated Android plugins/config. |
| `./gradlew assembleDebug` (from `frontend/android/`) | 0 | Android debug APK built successfully; 93 tasks. Gradle warned about experimental `android.aapt2FromMavenOverride` and `flatDir`. |
| APK `zipfile` scan of `assets/public/static/js/*.js` | 0 | One JS bundle; expected hostname and recovery/new-game controls present; `undefined/api` and old auto-create marker absent. APK: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`, 6,747,835 bytes. An initial scan used the wrong archive path and found zero bundles (exit 1); corrected path scan passed. |
| `python -m py_compile backend/server.py backend/auth.py backend/tests/test_profile_creation_safety.py` | 0 | Python syntax compilation passed. |
| `python -m pytest backend/tests/test_profile_creation_safety.py -q` | 1 | Blocked: `pytest` is not installed. No real FastAPI/Mongo runtime test ran. |
| `git diff --check` | 0 | Passed after source and documentation edits. |
| `command -v adb`, `adb version`, `adb get-state` | 0 | `/usr/bin/adb`, version 34.0.4; a device is connected. No install or launch. |

No authenticated profile creation/save test was run against the intended backend. The backend duplicate/concurrency tests use a fake unique collection and were not executed because pytest is missing. Do not treat mocked frontend tests, static APK checks, or Python syntax checks as evidence that production cloud creation or saving works. Minimum runtime verification requires explicit authorization to use an existing disposable test account on the intended backend (or isolated equivalent), then authenticated POST creation (201), duplicate POST rejection (409, existing record unchanged), PUT save, and a read-only DB confirmation of that test record. No account was created and production data was not changed.


## 2026-10-17 Manual Android persistence smoke test (user-reported)

The user reports installing the corrected APK and observing the following on their Android phone:

1. Startup displayed **SAVED PROFILE NOT VERIFIED**, with a device-save option and **RETRY LOAD**.
2. After selecting **RETRY LOAD**, the existing **Keep Command** profile loaded, including its existing resources and a completed Thought Lance research notification.
3. The user deleted a tower, exited the game, reopened it, and confirmed that the tower remained deleted.

**Result:** successful manual Android persistence smoke test for retry-loading this existing profile and persistence of this tower deletion across an app restart. The result was reported by the user; it was not independently reproduced by this agent. It does not establish that every save path works, that explicit new-profile creation works against the backend, or that duplicate/concurrent creation is safe at runtime.

No additional commands, automated tests, or builds were run in this documentation-only reporting turn. Backend runtime tests remain unavailable: the preceding session could not run `pytest` because the module and backend runtime dependencies were absent, and no authorized disposable backend test account/database was available. No production data was queried or changed.
