# Saved Profile Recovery — APK Configuration and ADB Follow-up

Date: 2026-10-17

## Checkout and preservation

- Starting and ending application branch: `feature/castle-management-first-pass`.
- Starting and ending HEAD: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Existing modified source files remained `backend/server.py`, `frontend/src/App.js`, `frontend/src/api.js`, `frontend/src/context/GameProvider.jsx`, `frontend/src/game/towerPlacement.test.js`, and `frontend/src/screens/Home.jsx`. Existing untracked tests and reports were preserved.
- No application source was changed in this session. Only the reporting files were updated/added. No reset, clean, stash, branch switch, or local commit occurred.

## Verified APK configuration and age

The installed APK was inspected read-only while ADB was connected. `pm path com.demonanic.game` located the installed base APK; `adb pull` copied it to `/tmp/demonanic-installed-base.apk`. The app was not launched.

A local scan of the single bundled JavaScript asset returned:

- `demonanic.onrender.com` present: **false**.
- `onrender.com` present: **false**.
- `undefined/api` present: **true**, one occurrence.
- The surrounding compiled expression is `Tn=void 0,An="undefined/api"`, followed by logging of `BACKEND_URL` and `API`.
- Old `NEW PROFILE CREATED` marker present: **true**.
- Explicit `SAVED PROFILE NOT FOUND`, `CONTINUE WITH DEVICE SAVE`, and `START NEW GAME` markers: **false**.
- Current source marker `BACKEND_HOST`: **false**; previous `BACKEND_URL` marker: **true**.

This confirms the installed APK has no configured API hostname in its bundled client and predates the current explicit profile-recovery UI and fail-closed API configuration. It is a concrete defect in the installed artifact. It does **not** establish which request ran during the user's earlier session, whether the backend received a request, or whether a database record exists. The old auto-create marker demonstrates why the installed APK must not be launched for diagnosis.

Both checked-in build workflows (`.github/workflows/demonanic-pages.yml` and `.github/workflows/castle-management-build.yml`) set `REACT_APP_BACKEND_URL` to the expected hostname `demonanic.onrender.com`. The frontend package scripts are `start`, `build`, and `test`; CRA consumes `REACT_APP_*` values at build time. The current shell's `REACT_APP_BACKEND_URL` is unset, but that alone did not establish APK configuration; the APK inspection did. No `.env` files were found outside dependencies. Git history contains the backend-URL workflow change at `bf086c3` and later Android build workflow commits, but the installed APK could not be associated with a particular workflow artifact/commit.

Current source uses `resolveApiBaseUrl`: absent or invalid configuration returns `null`, and the Axios interceptor rejects before sending a request. Current build workflows supply the backend URL. No APK was rebuilt or installed.

## ADB state

Commands run: `/usr/bin/adb version`, `/usr/bin/adb server-status`, `/usr/bin/adb get-state`, and `/usr/bin/adb devices -l`.

- ADB 1.0.41 (platform-tools 34.0.4-debian) is installed in Ubuntu.
- `adb server-status` is unsupported by this ADB build (`unknown command`); this did not prevent the other status checks.
- `adb get-state` returned `device`; `adb devices -l` listed one device with a private-network IP-and-port serial and `device` state. This is an active TCP/IP transport consistent with Android Wireless Debugging. The private endpoint is intentionally omitted from this public report.
- No pairing or reconnect was attempted because the existing transport worked.
- Only package path and APK bytes were read. No app launch, logcat collection, auth/session read, game endpoint request, or data access occurred.

If disconnected later, enable Wireless debugging on the trusted phone while it is on a trusted Wi-Fi network. Use only the current IP and pairing port displayed in Android's Pair device with pairing code screen with `/usr/bin/adb pair <phone-shown-ip>:<pairing-port>`; enter the temporary code only at the prompt and keep it out of shell history/reports. Then use the current debug IP/port shown on the Wireless debugging screen with `/usr/bin/adb connect <phone-shown-ip>:<debug-port>`. Ports may change; do not reuse the old endpoint. No PC is required when the Ubuntu/Termux ADB client can reach the phone over that trusted network.

## Recovery guard review

Current uncommitted `GameProvider.loadGame()` accepts only an explicit `state: null` as missing; malformed success responses and request failures take the error path. Missing auth prevents the state request. A local backup is offered for explicit user selection and the device-only session leaves `serverSaveEnabled` false, so debounced/manual cloud saves return without calling PUT. Explicit new-game creation requires the missing-profile prompt, authenticated identity/token, and one in-flight request. Backend creation uses `insert_one` and handles duplicate-key conflict; the existing unique `user_id` index is the cross-request concurrency guard. The regular PUT endpoint remains an upsert, but the recovery client does not call it before a valid server profile loads or after device-only continuation.

Current tests cover saved-server load, explicit null, malformed server response/state, unauthenticated/401, network/503 failures, no replacement save, local device-only continuation, explicit creation, and rapid duplicate confirmation. The backend tests use an in-memory fake collection for duplicate/concurrency behavior; they are not real Mongo tests. `GET /api/game/state` was not used because it performs offline accrual and writes `lastSeen`.

Auth code review also reconfirmed that successful login currently logs the raw response object, which may include a JWT, and logs the username/password length at login start. No auth logs were collected or exposed. Raw logcat must not be shared; this logging concern remains a source limitation for any future runtime log collection.

## Account and database status

`MONGO_URL`, `DB_NAME`, `READ_ONLY_MONGO_URL`, and `EXPECTED_USER_ID` are unset in the current shell. No authorized read-only Mongo URI/operator session is available; `mongosh` is unavailable. The expected account ID was not retrieved, and no production query was made. A read-only user with `read` access restricted to the Demonanic database and needed collections must resolve the expected account through trusted private identity data, then `findOne` the corresponding `users` and `game_states` records. The operator should report only presence/shape booleans and must not invoke game endpoints or return profile contents. This check is genuinely read-only and does not trigger accrual/timestamps.

**Original saved-profile status: unverified.** The APK has incorrect/missing backend configuration, but there is no evidence that the original profile is absent or present. Account identity/backend-to-record association is not established.

## Verification results

| Command / check | Exit | Result |
| --- | ---: | --- |
| `git branch --show-current`, `git rev-parse HEAD`, `git status --short --branch`, full targeted `git diff`, `git diff --check` | 0 | Correct feature branch/HEAD; pre-existing changes preserved; whitespace check passed. |
| `CI=true npm test -- --watchAll=false --runInBand src/apiConfig.test.js src/context/GameProvider.test.jsx` (frontend) | 0 | 2 suites, 19 tests passed. Mocked frontend tests. |
| `CI=true npm test -- --watchAll=false --runInBand` (frontend) | 0 | 10 suites, 61 tests passed. Mocked/unit frontend tests; not production integration. |
| `npm run build` (frontend) | 0 | Compiled successfully; Node emitted `[DEP0176] fs.F_OK is deprecated`. No APK generated. |
| `python -m py_compile backend/server.py backend/tests/test_profile_creation_safety.py` | 0 | Python syntax compilation passed. |
| `python -m pytest tests/test_profile_creation_safety.py -q` (backend) | 1 | Blocked: `pytest` is not installed. No FastAPI/Motor/PyMongo runtime or real DB tests ran. |
| `/usr/bin/adb get-state`, `/usr/bin/adb devices -l`, read-only `pm path` and APK pull | 0 | Device connected; package installed; APK inspected without launch. |
| `git diff --check` (final) | 0 | Passed. |

## Final state and next safe step

- Current branch/HEAD remain unchanged; all existing application changes are local and uncommitted.
- Published `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and both 2026-10-17 recovery reports to `docs/development-reports-2026-10-15` in documentation-only commit [`20781b738dc7757188cbee8f9c4378514f885d48`](https://github.com/demonanic/Demonanic/commit/20781b738dc7757188cbee8f9c4378514f885d48). GitHub readback verified all five paths; no application/backend source was included.
- No profile/account/database/app data was changed. No game endpoint was called. No merge, deployment, or gameplay-code publication occurred.
- The single most useful next step is an authorized operator's read-only lookup of the expected account's `users` and `game_states` records, returning only existence and valid-shape booleans. Do not launch the stale installed APK.
