# Saved Profile Recovery — Safe Diagnostics and Final Verification

Date: 2026-10-17

## Starting checkout and preserved work

- Starting branch: `feature/castle-management-first-pass`.
- Starting HEAD: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Initial status included uncommitted `backend/server.py`, `frontend/src/App.js`, `frontend/src/api.js`, `frontend/src/context/GameProvider.jsx`, `frontend/src/game/towerPlacement.test.js`, and `frontend/src/screens/Home.jsx`; untracked development reports, `frontend/src/context/GameProvider.test.jsx`, and `frontend/src/screens/Home.test.js` were also present.
- All changes were preserved. No branch switch, reset, stash, commit, or discard occurred. Local source changes are not present in the installed APK by assumption; device verification was unavailable.

## Safeguard review and findings

### Authentication and response classification

`AuthProvider.boot()` checks the stored token and calls `/auth/me`. Missing token routes to login. Explicit 401/403 clears the local token and cached user. A temporary auth/network/server failure preserves the token and may use the cached user; it does not register or create a game. The game request sends the token as a bearer header through the Axios interceptor.

The backend game-state GET returns `{state: null}` only when its authenticated Mongo lookup finds no document. HTTP/auth/network errors reject the Axios request. A successful malformed body is not evidence of a missing profile. Existing documents without a usable numeric wave are now rejected by the source changes already present in the working tree.

The previous recovery code change in this checkout requires an explicit action for a missing state, rejects malformed state, offers a valid local backup as device-only continuation, and blocks periodic/manual server saves in that mode. Fresh profile creation requires a valid local user ID/token and a separate POST. Current client code also coalesces rapid create clicks. The backend uses `insert_one`, with the startup-created unique `game_states.user_id` index, and returns 409 on duplicate key. This is source-level concurrency protection; actual Mongo concurrency has not been exercised.

### Validation compatibility

The current validity marker is a finite numeric `wave`. Current `createNewState` and the checked-in backend game-state fixtures use numeric waves. Older optional arrays/fields continue through existing normalization. A truly old profile with a missing or nonnumeric `wave` is treated as invalid and is not auto-replaced; no schema migration was attempted. More historical production samples were unavailable, so compatibility beyond repository fixtures is not proven.

### Backend configuration finding

The current shell has `REACT_APP_BACKEND_URL` unset. Checked-in frontend build workflows configure the API host `demonanic.onrender.com`; this is workflow configuration, not proof that the installed APK targets that host. Before URL validation, the local optimized bundle contained `undefined/api`. The current code now rejects a missing/invalid HTTP(S) backend URL before issuing an Axios request, and the latest local bundle check found no `undefined/api` literal. The installed APK's embedded origin remains unknown because ADB currently reports no device and no APK artifact was present under `frontend/`.

This makes missing/misconfigured backend URL a confirmed issue for builds made from this shell without an injected URL, and a plausible explanation only if the player's APK was built the same way. It does not prove the cause of the device incident. A wrong authenticated user or a different backend/database could also cause an empty profile lookup; those remain unverified.

## Read-only diagnostic decision and exact blocker

No diagnostic endpoint was added. Current authenticated access is JWT-scoped to the authenticated user, but the backend has no canonical public API-host setting, and no authorized read-only Mongo URI/operator session is available here. The existing `GET /api/game/state` is unsuitable: it accrues offline resources and writes `lastSeen`. Using the game's normal database credentials or adding a public endpoint that trusts an arbitrary user ID would be less safe.

Required operator action:

1. Use the expected username/account through a trusted login or server-side identity lookup and obtain the resulting account ID privately; do not pass an arbitrary client-supplied ID as authorization. Keep the ID and all credentials out of logs/reports.
2. Use a MongoDB identity with read-only `read` permission restricted to the Demonanic database and collections needed for `users` and `game_states`. Do not use the application write credential.
3. In the operator's private session, query `users` by the trusted `id` and `game_states` by `user_id`, projecting only `_id`, `state.wave`, and optional `state.heroes`/`state.towers`. Return only booleans: user record present, game-state record present, and recognizable structure (object state, finite numeric wave, and arrays when those optional fields are present). The query must use `findOne` only and must not expose documents or IDs.
4. Obtain the actual installed APK's backend hostname from its trusted build metadata or a safe device-side diagnostic, and compare it to the expected API hostname `demonanic.onrender.com` from the checked-in frontend build workflows. Report only hostnames and equality booleans.

None of these production checks was run. `MONGO_URL`, `DB_NAME`, `READ_ONLY_MONGO_URL`, `EXPECTED_USER_ID`, and `REACT_APP_BACKEND_URL` were all unset in the current shell; `mongosh` was unavailable. The environment has no attached ADB device (`/usr/bin/adb devices -l` returned an empty device list). Therefore the original profile record is **not verified present or absent**, and the current app account/backend match is **not verified**.

## Changes made this session

- `frontend/src/apiConfig.js` (new): validate build-time backend URL as HTTP(S), reject blank/malformed URLs and embedded user/password/query/fragment, and produce a normalized `/api` base.
- `frontend/src/apiConfig.test.js` (new): test configured host normalization and missing/invalid/credential-bearing URL rejection.
- `frontend/src/api.js`: fail requests closed when backend config is invalid; log only configured hostname rather than the raw backend URL.
- `frontend/src/context/GameProvider.jsx`: prevent duplicate in-flight explicit new-game submissions.
- `frontend/src/context/GameProvider.test.jsx`: distinguish network failure from server error and verify rapid confirmation clicks are coalesced.
- `backend/tests/test_profile_creation_safety.py` (new): mocked unit tests for insert success, duplicate preservation, concurrent duplicate attempts, and malformed state rejection without update.

Pre-existing uncommitted changes in `backend/server.py`, `frontend/src/App.js`, and other tower/menu files were reviewed and preserved; they were not introduced or committed in this session. No new production diagnostic endpoint or source migration was added.

## Tests and verification

| Command / check | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` (from `frontend/`) | 0 | 2 suites passed; 19 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 10 suites passed; 61 tests passed. |
| `npm run build` (from `frontend/`) | 0 | Production frontend build compiled successfully; Node emitted the `fs.F_OK` deprecation warning. |
| Build-bundle check for `undefined/api` | 0 | One JS bundle scanned; no undefined API path literal after validation was added. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Python syntax compilation passed. |
| `python -m pytest tests/test_profile_creation_safety.py -q` (from `backend/`) | 1 | Blocked: no `pytest` module in this Python environment. `/usr/bin/python3 -m pytest` also reported no pytest. FastAPI, Motor, and PyMongo are absent, so endpoint tests could not run. |
| `/usr/bin/adb devices -l` | 0 | No device attached. No app launch or device verification. |
| `git diff --check` | 0 | No whitespace errors. |

No read-only diagnostic authorization/no-mutation test ran because no diagnostic endpoint/tool was added without the required backend-host configuration and least-privilege DB access. The operator query above remains unexecuted.

## End state and limits

- Branch remains `feature/castle-management-first-pass`; HEAD remains `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Application/test changes remain uncommitted. Existing tower-placement, main-menu, and other local changes remain intact.
- The actual installed APK backend, authenticated account, and Mongo game-state record remain unknown. The prior startup risk is guarded in local source but has not been installed or device-verified.
- No app data, localStorage, account, production record, or production configuration was changed. Nothing was merged, deployed, or pushed as gameplay/backend source.
- Published only `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this session report to `docs/development-reports-2026-10-15` in commit [`47c7c7e79a8cf5293028dcda079fd8964f232f15`](https://github.com/demonanic/Demonanic/commit/47c7c7e79a8cf5293028dcda079fd8964f232f15). GitHub commit readback lists exactly those four Markdown paths, and GitHub file readback succeeded for each path on the branch. No gameplay/backend source was published. No gameplay change was pushed; no merge, deployment, app launch, or production data operation occurred.

## Follow-up evidence from later in the same date

The follow-up session report at `docs/dev-sessions/2026-10-17-profile-recovery-apk-adb-followup.md` supersedes this report's earlier point-in-time statement that ADB had no connected device and the installed APK host was unknown. ADB later reported an active TCP device, and read-only APK inspection found `void 0` paired with `undefined/api`, no expected backend host, and the old auto-create marker without the recovery guard UI. The APK was not launched. The new evidence establishes that the installed client is misconfigured and predates the guard, but the Mongo record and expected account ID remain unverified.
