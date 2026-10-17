# Demonanic Development Roadmap

Updated: 2026-10-17

Development reports are published for review on [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15). This branch is documentation-only and was created from `main`.

## Current priorities

| Area | Status | Evidence / next step |
| --- | --- | --- |
| Tower placement consistency | Implemented and verified | Preparation rendering and battle initialization use saved logical coordinates; explicit slot IDs flow through confirmation and build. Focused regression tests and the full frontend suite passed. Legacy towers retain saved coordinates and receive occupancy-only slot assignments. |
| Main menu redesign | Implemented; device review pending | Home screen was rebuilt around compact resource/status panels, a stronger skull crest, and larger navigation touch targets. Focused menu tests, the full frontend suite, and production build passed. Review on an Android device when available. |
| Food resource display | Unavailable in current game state | Food is migrated out of legacy saves and is not part of the current economy/profile state. Menu shows `N/A`; do not create resource state without a separate gameplay decision. |
| Android saved profile recovery | Client guard and missing-config rejection implemented; device/account/profile record still unverified | Client distinguishes explicit missing, malformed, auth, network, and server errors; local backups remain device-only when selected; new profile creation is explicit and insert-only. The current shell lacks `REACT_APP_BACKEND_URL`, while checked-in build workflows use `demonanic.onrender.com`. ADB currently lists no device, and no authorized read-only DB path is available. |

Latest verification (2026-10-17): focused recovery/config tests passed (2 suites/19 tests), full frontend tests passed (10 suites/61 tests), and production build passed with a Node deprecation warning. Backend pytest could not run because pytest and runtime dependencies are unavailable. The original record and installed APK configuration remain unverified.

## Known follow-up

- Update: the profile-creation guard is now implemented in the local working tree, but is uncommitted and not present in the installed APK or production backend. Do not launch the installed build for diagnostic purposes. See `docs/dev-sessions/2026-10-16-android-profile-recovery-guard.md`.
- 2026-10-17 verification: `/usr/bin/adb` is present but `adb devices -l` reports no device. `MONGO_URL`, `DB_NAME`, `READ_ONLY_MONGO_URL`, `EXPECTED_USER_ID`, and `REACT_APP_BACKEND_URL` are unset. A local build made before URL validation contained `undefined/api`; the updated build rejects missing configuration. The installed APK's host and auth identity remain unknown; do not infer them from CI configuration. See `docs/dev-sessions/2026-10-17-profile-recovery-safe-diagnostics.md`.

- Review the menu at common Android viewport sizes and confirm the visual hierarchy and touch targets on-device.
- The referenced visual examples were not present in the checkout or available message context during the redesign, so the implementation follows the written design direction.
- Android app data was not inspected or cleared. No device was connected for diagnostics; existing backend progress was not queried. See `docs/dev-sessions/2026-10-16-android-profile-recovery.md` for confirmed findings, hypotheses, and safe recovery steps.
- Runtime Android log collection and Mongo record verification remain blocked by the unavailable device and database diagnostic access. Current client logs include sensitive login response data, so raw logcat must not be shared; see `docs/dev-sessions/2026-10-16-android-profile-recovery-diagnostics.md` for safe fields and evidence limits.
- The Termux ADB binary was not reused. Ubuntu's repository `adb` package now sees an active TCP/IP device and confirms the Demonanic package is installed, but the log buffer has no auth/profile/API markers and backend identity remains unverified. Do not launch the app until profile-creation behavior is guarded; details are in `docs/dev-sessions/2026-10-16-android-profile-recovery-linux-adb.md`.
