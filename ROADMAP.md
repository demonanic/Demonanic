# Demonanic Development Roadmap

Updated: 2026-10-17

Development reports are published for review on [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15). This branch is documentation-only and was created from `main`.

## Current priorities

| Area | Status | Evidence / next step |
| --- | --- | --- |
| Tower placement consistency | Implemented and verified | Preparation rendering and battle initialization use saved logical coordinates; explicit slot IDs flow through confirmation and build. Focused regression tests and the full frontend suite passed. Legacy towers retain saved coordinates and receive occupancy-only slot assignments. |
| Main menu redesign | Implemented; device review pending | Home screen was rebuilt around compact resource/status panels, a stronger skull crest, and larger navigation touch targets. Focused menu tests, the full frontend suite, and production build passed. Review on an Android device when available. |
| Food resource display | Unavailable in current game state | Food is migrated out of legacy saves and is not part of the current economy/profile state. Menu shows `N/A`; do not create resource state without a separate gameplay decision. |
| Android saved profile recovery | Installed APK configuration defect confirmed; guarded debug APK built but not installed; original record/account unverified | Old installed APK had `void 0`, `undefined/api`, and old auto-create code. Android build now requires the expected HTTPS backend hostname and its workflow runs config tests plus guarded build. A new debug APK contains the expected hostname and recovery prompt, with the old auto-create marker absent. Do not install/launch until an authorized read-only operator checks the original record. ADB is connected; no authorized DB path is available. |

Latest verification (2026-10-17): Android workflow runs config tests and the guarded build. Validator tests passed (4/4); missing config fails before frontend build; configured frontend/debug APK build passed and the APK bundle contains the expected host and recovery markers, with the old auto-create marker absent. Focused recovery tests passed (2 suites/19 tests), full frontend tests passed (10 suites/61 tests), Python syntax compilation and `git diff --check` passed. Backend pytest is blocked by missing pytest. Original account identity and record existence remain unverified; the new APK has not been installed/launched.

## Known follow-up

- Update: the profile-creation guard is now implemented in the local working tree, but is uncommitted and not present in the installed APK or production backend. Do not launch the installed build for diagnostic purposes. See `docs/dev-sessions/2026-10-16-android-profile-recovery-guard.md`.
- 2026-10-17 follow-up: ADB currently reports a connected TCP device. The installed APK was pulled read-only; its bundled JS contains `void 0` as backend configuration and `undefined/api`, lacks the workflow backend hostname, and contains the prior auto-create marker without the new recovery prompt. No launch occurred. Do not use this APK; see `docs/dev-sessions/2026-10-17-profile-recovery-apk-adb-followup.md`.
- 2026-10-17 build follow-up: both workflows set the expected backend hostname, but the Android workflow now runs a fail-fast `build:android` validator. A configured debug APK was assembled and its bundle verified; it was not installed. The exact historical command that produced the old APK is not recorded, but its frontend bundle was compiled without the build-time environment value or stale output was embedded. See `docs/dev-sessions/2026-10-17-profile-recovery-android-build-config.md`.

- Review the menu at common Android viewport sizes and confirm the visual hierarchy and touch targets on-device.
- The referenced visual examples were not present in the checkout or available message context during the redesign, so the implementation follows the written design direction.
- Android app data was not inspected or cleared. No device was connected for diagnostics; existing backend progress was not queried. See `docs/dev-sessions/2026-10-16-android-profile-recovery.md` for confirmed findings, hypotheses, and safe recovery steps.
- Runtime Android log collection and Mongo record verification remain blocked by the unavailable device and database diagnostic access. Current client logs include sensitive login response data, so raw logcat must not be shared; see `docs/dev-sessions/2026-10-16-android-profile-recovery-diagnostics.md` for safe fields and evidence limits.
- The Termux ADB binary was not reused. Ubuntu's repository `adb` package now sees an active TCP/IP device and confirms the Demonanic package is installed, but the log buffer has no auth/profile/API markers and backend identity remains unverified. Do not launch the app until profile-creation behavior is guarded; details are in `docs/dev-sessions/2026-10-16-android-profile-recovery-linux-adb.md`.
