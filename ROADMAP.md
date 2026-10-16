# Demonanic Development Roadmap

Updated: 2026-10-16

Development reports are published for review on [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15). This branch is documentation-only and was created from `main`.

## Current priorities

| Area | Status | Evidence / next step |
| --- | --- | --- |
| Tower placement consistency | Implemented and verified | Preparation rendering and battle initialization use saved logical coordinates; explicit slot IDs flow through confirmation and build. Focused regression tests and the full frontend suite passed. Legacy towers retain saved coordinates and receive occupancy-only slot assignments. |
| Main menu redesign | Implemented; device review pending | Home screen was rebuilt around compact resource/status panels, a stronger skull crest, and larger navigation touch targets. Focused menu tests, the full frontend suite, and production build passed. Review on an Android device when available. |
| Food resource display | Unavailable in current game state | Food is migrated out of legacy saves and is not part of the current economy/profile state. Menu shows `N/A`; do not create resource state without a separate gameplay decision. |
| Android saved profile recovery | Source hazard confirmed; device and database diagnosis blocked | `GameProvider.loadGame` creates and saves a fresh profile when the authenticated GET succeeds with `state: null` and there is no local backup for that exact user ID. No Android device, expected account/backend identity, Mongo credentials, or read-only diagnostic path was available. Obtain redacted device diagnostics and an authorized read-only Mongo existence check before approving a fix. |

## Known follow-up

- Review the menu at common Android viewport sizes and confirm the visual hierarchy and touch targets on-device.
- The referenced visual examples were not present in the checkout or available message context during the redesign, so the implementation follows the written design direction.
- Android app data was not inspected or cleared. No device was connected for diagnostics; existing backend progress was not queried. See `docs/dev-sessions/2026-10-16-android-profile-recovery.md` for confirmed findings, hypotheses, and safe recovery steps.
- Runtime Android log collection and Mongo record verification remain blocked by the unavailable device and database diagnostic access. Current client logs include sensitive login response data, so raw logcat must not be shared; see `docs/dev-sessions/2026-10-16-android-profile-recovery-diagnostics.md` for safe fields and evidence limits.
