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
