# Test Report

Updated: 2026-10-15

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
