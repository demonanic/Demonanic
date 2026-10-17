# Demonanic Development Roadmap

Updated: 2026-10-17

Development reports are published for review on [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15). This branch is documentation-only and was created from `main`.

## Current priorities

| Area | Status | Evidence / next step |
| --- | --- | --- |
| Tower placement consistency | Implemented and verified | Preparation rendering and battle initialization use saved logical coordinates; explicit slot IDs flow through confirmation and build. Focused regression tests and the full frontend suite passed. Legacy towers retain saved coordinates and receive occupancy-only slot assignments. |
| Main menu redesign | Implemented; device review pending | Home screen was rebuilt around compact resource/status panels, a stronger skull crest, and larger navigation touch targets. Focused menu tests, the full frontend suite, and production build passed. Review on an Android device when available. |
| Food resource display | Unavailable in current game state | Food is migrated out of legacy saves and is not part of the current economy/profile state. Menu shows `N/A`; do not create resource state without a separate gameplay decision. |
| Android profile creation and save safety | Recovery UI and one manual Android persistence smoke test verified; complete backend creation/save coverage remains unverified | The user reports the corrected APK showed the recovery screen, loaded the existing profile after **RETRY LOAD**, and retained a tower deletion after an app restart. This supports the observed retry-load and that deletion persistence path only. It does not verify every save path, new-profile creation, duplicate/concurrent creation, or backend runtime behavior. |

Latest verification (2026-10-17): full frontend tests passed (10 suites/61 tests); Android URL validator tests passed (4/4). Missing, malformed, insecure, and incorrect-host Android build preflights each exited 1 with clear errors before bundling. The configured frontend build, Capacitor sync, and Android `assembleDebug` succeeded. Static APK inspection confirmed the expected backend hostname, recovery prompt, local-save and explicit-new-game choices, and absence of `undefined/api` and the old auto-create marker. Python syntax compilation passed; backend pytest is blocked because pytest is unavailable. The APK has not been installed or launched, and no authenticated profile creation or cloud save was tested against the actual backend.

Latest database-verification attempt (2026-10-17): re-ran Android config tests (4/4) and `git diff --check` (pass); ADB reports a connected device. Mongo URI/database/account-ID variables are unset and `mongosh`/`mongo` are unavailable. No API or database query was performed. An authorized operator must privately resolve the original account ID from its exact login username on the independently confirmed production backend, then return only user-record/game-state-record/recognizable-shape booleans from a Mongo account limited to read access. Until then, the original save remains unverified. See `docs/dev-sessions/2026-10-17-profile-recovery-readonly-db-check.md`.

The user reports that the corrected APK loaded the existing profile after retry; this is device-level user-reported evidence, not an independent database query. The original profile was therefore observed as loadable on the phone, but its MongoDB record was not queried by an operator. Minimum remaining backend verification is an explicitly approved, disposable test account on the intended backend (or an isolated equivalent): authenticate, create via POST and verify 201, retry creation and verify 409 without replacement, save via PUT, and confirm the test state through a read-only database query. No such account or production-write approval was available in this session.

## Known follow-up

- Update: the profile-creation guard is now implemented in the local working tree, but is uncommitted and not present in the installed APK or production backend. Do not launch the installed build for diagnostic purposes. See `docs/dev-sessions/2026-10-16-android-profile-recovery-guard.md`.
- 2026-10-17 follow-up: ADB currently reports a connected TCP device. The installed APK was pulled read-only; its bundled JS contains `void 0` as backend configuration and `undefined/api`, lacks the workflow backend hostname, and contains the prior auto-create marker without the new recovery prompt. No launch occurred. Do not use this APK; see `docs/dev-sessions/2026-10-17-profile-recovery-apk-adb-followup.md`.
- 2026-10-17 build follow-up: both workflows set the expected backend hostname, but the Android workflow now runs a fail-fast `build:android` validator. A configured debug APK was assembled and its bundle verified; it was not installed. The exact historical command that produced the old APK is not recorded, but its frontend bundle was compiled without the build-time environment value or stale output was embedded. See `docs/dev-sessions/2026-10-17-profile-recovery-android-build-config.md`.

- Review the menu at common Android viewport sizes and confirm the visual hierarchy and touch targets on-device.
- The referenced visual examples were not present in the checkout or available message context during the redesign, so the implementation follows the written design direction.
- Android app data was not inspected or cleared. No device was connected for diagnostics; existing backend progress was not queried. See `docs/dev-sessions/2026-10-16-android-profile-recovery.md` for confirmed findings, hypotheses, and safe recovery steps.
- Runtime Android log collection and Mongo record verification remain blocked by the unavailable device and database diagnostic access. Current client logs include sensitive login response data, so raw logcat must not be shared; see `docs/dev-sessions/2026-10-16-android-profile-recovery-diagnostics.md` for safe fields and evidence limits.
- The Termux ADB binary was not reused. Ubuntu's repository `adb` package now sees an active TCP/IP device and confirms the Demonanic package is installed, but the log buffer has no auth/profile/API markers and backend identity remains unverified. Do not launch the app until profile-creation behavior is guarded; details are in `docs/dev-sessions/2026-10-16-android-profile-recovery-linux-adb.md`.


## Latest manual device result — 2026-10-17

The user reports: after installing the corrected APK, startup showed **SAVED PROFILE NOT VERIFIED** with device-save and retry options; choosing **RETRY LOAD** restored the existing Keep Command profile, its resources, and a completed Thought Lance research notification. After deleting a tower, exiting, and reopening, the tower remained deleted. This is a successful user-reported manual Android persistence smoke test for those observed paths. It is not agent-reproduced and does not verify all save paths, explicit new-profile creation, duplicate/concurrent creation, or backend runtime behavior. No operator-side MongoDB check was performed.
