# Development Log

## 2026-10-15 — Tower placement verification and main menu redesign

- Starting checkout for the development work: `feature/castle-management-first-pass` at `db5bc6763811f2f428215546e3d325b3fec087e4`, clean.
- The existing tower-placement implementation was absent from this branch. The already-reviewed commit `0b094d92e57c929a0e6e0f8cd66c87c172506389` from `fix/tower-placement-position` was cherry-picked locally, producing `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad` on the feature branch. `main` was not changed.
- Placement fix preserves explicit slot IDs through confirmation/build, validates occupied IDs, and shares saved logical tower coordinates between preparation and battle. Legacy towers retain their coordinates and receive occupancy-only assignments.
- Redesigned `frontend/src/screens/Home.jsx` with compact resource and status panels, a custom skull crest, and larger menu touch targets. Existing navigation, logout, tactical HUD preference, offline-gain toast, and vault/Shoppe counts remain connected.
- Food is displayed as `N/A` because the current economy removes it; no resource/profile state was added.
- Added/extended focused tests in `frontend/src/screens/Home.test.js` and `frontend/src/game/towerPlacement.test.js`.
- Verification results are recorded in `TEST_REPORT.md` and the detailed session report at `docs/dev-sessions/2026-10-15-tower-placement-main-menu.md`.
- No push, merge, or deployment occurred. The menu and test changes remain uncommitted.

## 2026-10-15 — Mandatory development reporting

- Starting and ending checkout: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Worktree was preserved. This reporting turn created/updated only repository documentation; it did not change application code or rerun application tests/builds.
- No prior `ROADMAP.md`, `DEVELOPMENT_LOG.md`, `TEST_REPORT.md`, or `docs/dev-sessions` history existed. The roadmap and reports were created using the verified work and command results from the immediately preceding development session.
- No commit, push, merge, or deployment occurred in this reporting turn.

## 2026-10-15 — Publish development reports for ChatGPT review

- Verified the connected public repository `demonanic/Demonanic` and confirmed the linked GitHub access has push permission.
- Published only `ROADMAP.md`, `DEVELOPMENT_LOG.md`, `TEST_REPORT.md`, and `docs/dev-sessions/2026-10-15-tower-placement-main-menu.md` on `docs/development-reports-2026-10-15`, created from the remote `main` tip. The publication commit is `1d0fd1cb4a18b3426766629681169d1d7124f0b5`.
- GitHub readback succeeded for all four documents. The commit diff contains only those four Markdown paths; no gameplay files were published.
- No tests/build were run in this publication-only session. No merge, deployment, or production change occurred.
- A follow-up docs-only commit `377a7a03ef6e01da749e9128989156a23f3ffed4` added this publication session report and clarified the report branch's current contents. GitHub readback confirms five Markdown documents and no application files at the branch tip.

## 2026-10-16 — Android saved profile recovery investigation

- Starting and ending local checkout: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`. Existing uncommitted tower test, Home menu, and Home test work was preserved.
- Traced Capacitor config, auth boot, JWT identity, API URL/token handling, `GameProvider.loadGame`, MongoDB state lookup/upsert, and Android application ID/data-backup configuration. The repository uses its own JWT auth and MongoDB, not Supabase.
- Confirmed source hazard: a successful state lookup returning `null` and no same-user local backup causes immediate new-state creation and a backend upsert. Missing token/401 alone routes to login; network/API errors do not auto-create a profile in this code. Which condition happened on the player's device remains unproven.
- Android localStorage is app-origin scoped; the bundled Capacitor app has no configured `server.url`, so its WebView storage is distinct from browser-origin storage. Stable package ID is `com.demonanic.game`, and Android manifest enables backup. These facts alone do not establish how the specific APK was installed or whether data was retained.
- No connected Android device or useful app logs were available. No backend/database call was made. Existing progress likely remains recoverable if it is still stored under the original backend user ID; it was not checked.
- Ran a local, non-networked economy suite (1 suite/3 tests passed) and `git diff --check` (passed). These do not test profile recovery. Backend integration tests were intentionally not run because they register accounts and write state.
- Updated roadmap, test report, and detailed report. Published only those four Markdown files to `docs/development-reports-2026-10-15` through the connected GitHub integration. Publication commit: `5a8f80c00aab72b2036b3bdddbac45c17b86d184`; GitHub readback succeeded for all four paths. No code changes, local commit, merge, or deployment occurred; no gameplay push occurred.

## 2026-10-16 — Android profile recovery diagnostics

- Starting and ending local checkout: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`; existing tower-placement and Home changes were preserved.
- Confirmed no Android device is connected (`adb devices -l`); no runtime auth, profile-load, or save request logs could be collected. The expected account ID and backend host were not supplied or otherwise available.
- Inspected source logging safely. The client logs backend URL and API method/URL/status, auth token presence, `/me` outcome, and game load/save markers. It also logs the full login/register success response (which includes a JWT) and full errors/response data. Therefore raw logcat must not be shared; runtime collection is blocked until a safe redaction/filtering path can be used.
- No Mongo shell or database env configuration was available; no existing read-only profile diagnostic route/script was found. The state GET performs offline accrual and writes `lastSeen`, so it was not used. No database query or mutation occurred.
- No tests/build were run. `git diff --check` passed (exit 0). Updated the roadmap, test report, and detailed diagnostics report.
- No application changes or local commit. Documentation-only publication to the authorized report branch was completed and read back through GitHub. No gameplay push, merge, deployment, or production change occurred.
