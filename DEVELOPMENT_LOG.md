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

## 2026-10-16 — Android ADB connection attempt

- Starting checkout: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`; preserved all existing tower-placement, menu, test, and documentation changes.
- Attempted the user-provided `adb connect 192.168.1.235:40495`. It exited 1 because PATH resolves to `/data/data/com.termux/files/usr/bin/adb`, which Ubuntu cannot execute due to unresolved Android NDK symbol `_ZNSt6__ndk113__hash_memoryEPKvm`. No compatible SDK ADB was found in the standard checked paths.
- Device connection, logcat, runtime auth/profile requests, and app storage therefore remain uninspected. No game API or database was accessed. The earlier `adb devices -l` had no connected device before this attempt.
- Updated reports; no application code, tests, build, local commit, merge, deployment, or production data changed. `git diff --check` passed. Documentation-only publication to the authorized report branch is being completed and verified.

## 2026-10-16 — Ubuntu ADB profile diagnostics

- Read the preceding ADB failure report first and preserved the current branch and all existing changes. Installed Ubuntu Noble's repository `adb` package (`1:34.0.4-1build3`) after escalation approval; did not reuse the incompatible Termux binary.
- Ubuntu ADB found one active TCP/IP device in `device` state. Its live endpoint matched the previously supplied endpoint; this was verified from the active transport, not assumed. A read-only package-path query confirmed `com.demonanic.game` is installed. No pair/reconnect, app launch, or API request was performed.
- Collected logcat through an in-process redacting filter. Of 237,537 lines, two contained the product name, but none had auth, game, API, or relevant console markers. No raw logs, IDs, URLs, or secrets were emitted.
- Read the installed APK into temporary storage and attempted safe backend-origin extraction; no origin could be safely extracted. Ubuntu ADB mDNS subcommands returned `unknown host service`; not needed for the already-active transport.
- User ID, current backend host, comparison against intended setup, and Mongo record existence remain unknown. No authorized read-only Mongo path/credentials were available. Do not launch the app because startup could create/save a new profile.
- No source/gameplay change, app test/build, database request, merge, deployment, or production mutation. `git diff --check` passed. Published only the four Markdown reports to `docs/development-reports-2026-10-15` in commit `82c45bb449613deb7415c0f8a192010bc2f0cf0b`; GitHub readback succeeded for all four paths.

## 2026-10-16 — Saved profile startup guard

- Starting and ending local checkout: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`. Pre-existing tower-placement, menu, test, and report changes were preserved.
- Confirmed from source that backend `GET /game/state` returns `{state: null}` only when no document exists; auth rejection, HTTP errors, and network failures reject the Axios request. A successful but malformed body or a stored document without a usable state was previously at risk of being treated as a playable blank state.
- Added strict response/state checks and an explicit missing-profile prompt. A detected local backup can be chosen for device-only play, with periodic/manual cloud saves disabled. A fresh game requires explicit player action and authenticated user/token checks.
- Added authenticated `POST /game/state` insert-only creation; the existing unique `user_id` index makes concurrent creation fail with 409 rather than overwrite a profile. Existing normal saves still use the existing PUT path after a server profile loads.
- Added nine focused provider tests. Focused suite passed 9/9; full frontend suite passed 9 suites/51 tests; production build passed with Node's `fs.F_OK` deprecation warning; Python syntax compilation and `git diff --check` passed.
- Backend runtime tests could not run because FastAPI/Motor/PyMongo are absent in the environment. No app launch, API call, DB read/write, merge, deployment, or production change occurred. Device account/backend and stored profile remain unverified.
- Detailed report: `docs/dev-sessions/2026-10-16-android-profile-recovery-guard.md`. Published only the four reporting files to `docs/development-reports-2026-10-15` in commit `01494a29e2b31b9d1133646f951dd8b9d7bafad4`; GitHub readback succeeded for all four paths, and the commit contains no application files.

## 2026-10-17 — Safe diagnostics and profile recovery verification

- Starting and ending checkout: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`. Preserved existing tower-placement, main-menu, recovery, and documentation changes.
- Reviewed the complete current diff and profile/auth/backend flows. ADB binary exists, but `adb devices -l` now reports no attached device. No app was launched.
- Found the current shell has no `REACT_APP_BACKEND_URL`; a pre-guard local bundle contained `undefined/api`. Checked-in build workflows configure `demonanic.onrender.com`, but the installed APK's host remains unverified. Added URL validation: missing/invalid/credential-bearing backend URLs fail closed, and logs show only a hostname.
- Reviewed profile safeguards: explicit null only opens a user choice; malformed state, 401, network, and server errors do not create a profile; local fallback has server writes disabled; frontend rapid clicks are coalesced; backend insert-only POST plus the existing unique index prevents duplicate inserts from replacing a state. Added mocked backend duplicate/concurrency tests; actual Mongo concurrency remains unverified.
- No authenticated read-only diagnostic was added because no read-only DB credentials/operator path, expected user identity, device connection, or configured public API host is available. The existing GET endpoint mutates accrual/lastSeen. No production record was queried.
- Focused frontend tests passed (2 suites/19 tests); all frontend tests passed (10 suites/61 tests); production build passed with the `fs.F_OK` deprecation warning; Python syntax compilation and `git diff --check` passed. Backend pytest could not run (`No module named pytest`); backend runtime dependencies are absent.
- No database/API request, Android launch, app-data change, account creation, commit, merge, deployment, or production mutation occurred. The detailed report records exact commands, blockers, and the minimal authorized operator check needed.

## 2026-10-17 — Final verification rerun and report publication

- Rechecked branch and HEAD before continuing: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`; all existing changes remained present.
- Reran focused recovery/config tests (2 suites, 19 tests) and the full frontend suite (10 suites, 61 tests); both passed. `npm run build` completed successfully with the existing Node `fs.F_OK` deprecation warning. Backend pytest remains unavailable (`pytest` module missing). `git diff --check` passed.
- Published only `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this dated session report to `docs/development-reports-2026-10-15` in docs-only commit `47c7c7e79a8cf5293028dcda079fd8964f232f15`. GitHub readback succeeded for all four paths; the commit diff lists only those Markdown files.
- No app launch, database query or mutation, branch change, gameplay push, merge, or deployment occurred. Application changes remain uncommitted on the feature branch.

## 2026-10-17 — Installed APK and ADB follow-up

- Starting checkout remained `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`. Reviewed all existing diffs and preserved them.
- Ubuntu `/usr/bin/adb` was responding and listed the device in `device` state over a TCP transport. Read-only `pm path`/`adb pull` inspected the installed base APK without launching Demonanic.
- The APK's single bundled JS contains `void 0` as backend config and the paired `undefined/api` string; `demonanic.onrender.com` is absent. It also has the old `NEW PROFILE CREATED` marker, no explicit missing-profile prompt, and the old `BACKEND_URL` log marker. The installed APK is therefore misconfigured and predates the local guard. This establishes the installed client's configuration/code condition, not whether a cloud record exists or whether a request reached a server.
- Both checked-in build workflows set the backend host to `demonanic.onrender.com`; the current shell has no `REACT_APP_BACKEND_URL`. No `.env` files were found outside dependencies. No account ID or read-only Mongo access is available; no database/profile route was called.
- Focused frontend tests passed (2 suites/19 tests), full frontend tests passed (10 suites/61 tests), frontend production build passed with `[DEP0176] fs.F_OK is deprecated`, Python syntax compilation passed, and `git diff --check` passed. Backend pytest remains blocked because pytest is absent.
- No app launch, data change, profile write, merge, deployment, or gameplay publication occurred. Details and exact evidence are in `docs/dev-sessions/2026-10-17-profile-recovery-apk-adb-followup.md`.
- Published `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and both 2026-10-17 recovery reports as documentation-only commit `20781b738dc7757188cbee8f9c4378514f885d48` on `docs/development-reports-2026-10-15`. GitHub readback verified the five Markdown paths; no application/backend source was included.

## 2026-10-17 — Android build configuration guard

- Starting/ending application branch and HEAD: `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`. Preserved all pre-existing work.
- Traced React build-time environment handling: CRA substitutes `REACT_APP_BACKEND_URL` during bundling; Capacitor sync and Gradle embed the already-built assets and do not inject this setting. Both checked-in workflows set `https://demonanic.onrender.com`. The old APK instead contains `void 0` and `undefined/api`, so its frontend bundle was built without the value or stale output was embedded. The exact historical build invocation is not recorded.
- Added `build:android` preflight validation requiring the expected HTTPS backend origin and changed the Android build workflow to run the four configuration tests and then use that guarded build command. Tests cover expected host acceptance, missing-config failure, invalid/unrelated/insecure URLs, and no localhost fallback.
- Config tests passed 4/4; focused frontend tests passed 2 suites/19 tests; full frontend tests passed 10 suites/61 tests. Missing-config Android build failed clearly as intended. Configured frontend and Android debug APK builds passed; bundle scan found the expected backend host and recovery UI markers. APK was not installed/launched.
- Python syntax compilation and `git diff --check` passed. Backend pytest was blocked (`pytest` missing); no real database test ran. No account/profile/backend request or database query occurred. ADB remains connected over TCP.
- Published only the five reporting documents listed in the session report to `docs/development-reports-2026-10-15` in commit `de1c32251b5cca3c371bc666a5640b89163d2a4d`; GitHub readback confirmed those exact Markdown paths and no source files.
- Only focused Android build config source/workflow changes were made; existing recovery, tower-placement, and menu changes remain local. No application/backend source was published.
