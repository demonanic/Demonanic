# Android Saved Profile Recovery — Startup Guard

Date: 2026-10-16

## Starting state

- Starting and ending branch: `feature/castle-management-first-pass`.
- Starting and ending HEAD: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Existing working changes were preserved, including tower placement and Home menu work. This session added profile recovery changes without committing them.
- Read the latest Ubuntu ADB report before examining the source. The connected device was not relaunched.

## Diagnosis from source

`AuthProvider.boot()` reads the local token and requests `/auth/me`. With no token it routes to login. An explicit 401/403 clears credentials; a temporary auth/server/network failure uses a cached user if available or routes to login. The game provider therefore normally mounts only for a truthy user. The profile API request attaches the token from local storage.

Axios rejects non-2xx HTTP responses and network/timeouts. The backend auth dependency rejects missing/invalid/expired credentials with 401. Those cases do not produce a successful `{state: null}` response. The backend GET route returns `{state: null}` only when its authenticated Mongo lookup finds no document. Other backend errors are non-2xx and reject the client request. A malformed successful response was previously treated like a missing profile; a document whose state was absent could also become `{}` at the backend.

The former client path could create a fresh state and immediately PUT it after an empty lookup. The PUT route uses Mongo upsert, so it can replace a profile if the client is operating under an unexpected identity/environment or if a profile is created between lookup and save. Continuing a local backup also allowed periodic/manual saves to reach that upsert route despite the earlier warning comment.

These source facts do not establish what happened on the player's device. The current account ID, installed APK backend hostname, state response, and Mongo record existence remain unverified. The previous ADB log buffer had no auth/profile/API markers. No production database access is available through an authorized read-only diagnostic path; the existing GET route itself changes offline accrual and `lastSeen`.

## Changes made

- `frontend/src/context/GameProvider.jsx`: accept only an object state with a finite `wave`; only explicit `state: null` is classified as a missing profile. Malformed responses and rejected requests show a retry prompt. Local backups are offered for explicit device-only continuation, with server writes disabled for that provider session.
- `frontend/src/App.js`: show a recovery prompt for missing, invalid, or unavailable profiles. Starting a new game is a distinct player action; detected device backups are not replaced by the blank-game option.
- `frontend/src/api.js`: add a separate create-only POST call.
- `backend/server.py`: return 500 for an existing record with an invalid state marker. Add authenticated POST creation using `insert_one`; the existing unique `user_id` index makes a competing profile result in 409 instead of an upsert overwrite. Existing PUT behavior for normal saves is unchanged.
- `frontend/src/context/GameProvider.test.jsx`: add focused startup/recovery tests.

No save schema migration or profile migration was introduced. Existing state normalization remains in its previous location and behavior.

## Tests and builds

| Command | Exit | Result |
| --- | ---: | --- |
| `CI=true npm test -- --watchAll=false --runInBand src/context/GameProvider.test.jsx` (from `frontend/`) | 0 | 1 suite, 9 tests passed. |
| `CI=true npm test -- --watchAll=false --runInBand` (from `frontend/`) | 0 | 9 suites, 51 tests passed. |
| `npm run build` (from `frontend/`) | 0 | Production build compiled successfully; Node emitted a deprecation warning for `fs.F_OK`. |
| `python -m py_compile backend/server.py` | 0 | Python syntax check passed. |
| `git diff --check` | 0 | No whitespace errors. |

Backend runtime/route tests were not run: FastAPI, Motor, and PyMongo are not installed in this environment. Existing backend tests exercise live account and game-state writes, so they were not run against any service.

## Safety and remaining limitations

- No Android app launch, API request, production database query, account registration, local storage change, app-data reset, or uninstall occurred.
- The installed APK is unchanged. The guard and POST endpoint are local, uncommitted source changes, so the device behavior has not been verified and the old installed build does not gain this guard.
- The original save's presence/recoverability is unknown. Confirmation requires trusted expected account/backend identity plus an authorized database operator running a no-update existence check for the correct `user_id` and returning only whether the user/game-state records exist. Do not call the mutating game-state GET for this check.
- Device-only continuation keeps future writes local for the provider session; no conflict-resolution/sync UI is included. Retry after a server error remains available.
- The frontend tests mock the API. The backend insert-only route compiled but was not exercised against Mongo or a route test harness in this environment.

## End state

- Branch and commit remain `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Application/backend changes are uncommitted. The four reporting files were published to [`docs/development-reports-2026-10-15`](https://github.com/demonanic/Demonanic/tree/docs/development-reports-2026-10-15) in docs-only commit [`01494a2`](https://github.com/demonanic/Demonanic/commit/01494a29e2b31b9d1133646f951dd8b9d7bafad4); GitHub readback succeeded for every path. No gameplay changes were pushed.
- No merge, deployment, or production data change occurred.
