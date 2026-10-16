# Demonanic Development Roadmap

Updated: 2026-10-15

Development reports are published for review on [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15). Publication commit: [`1d0fd1c`](https://github.com/demonanic/Demonanic/commit/1d0fd1cb4a18b3426766629681169d1d7124f0b5). This branch is documentation-only and was created from `main`.

## Current priorities

| Area | Status | Evidence / next step |
| --- | --- | --- |
| Tower placement consistency | Implemented and verified | Preparation rendering and battle initialization use saved logical coordinates; explicit slot IDs flow through confirmation and build. Focused regression tests and the full frontend suite passed. Legacy towers retain saved coordinates and receive occupancy-only slot assignments. |
| Main menu redesign | Implemented; device review pending | Home screen was rebuilt around compact resource/status panels, a stronger skull crest, and larger navigation touch targets. Focused menu tests, the full frontend suite, and production build passed. Review on an Android device when available. |
| Food resource display | Unavailable in current game state | Food is migrated out of legacy saves and is not part of the current economy/profile state. Menu shows `N/A`; do not create resource state without a separate gameplay decision. |

## Known follow-up

- Review the menu at common Android viewport sizes and confirm the visual hierarchy and touch targets on-device.
- The referenced visual examples were not present in the checkout or available message context during the redesign, so the implementation follows the written design direction.
