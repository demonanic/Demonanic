# Android Saved Profile Recovery Investigation

Date: 2026-10-16

## Scope and checkout

- Starting branch and commit: `feature/castle-management-first-pass`, `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad` (`Fix tower placement position consistency`).
- Ending local branch and commit: same branch and commit.
- Existing work preserved: modified `frontend/src/game/towerPlacement.test.js`, modified `frontend/src/screens/Home.jsx`, untracked `frontend/src/screens/Home.test.js`, and pre-existing local reporting documents/history. No source or gameplay file was edited during this investigation.
- `git status --short --branch` showed the current branch ahead of `origin/feature/castle-management-first-pass` by one commit, with those changes present. Nothing was reset, stashed, discarded, or overwritten.

## Findings

### Confirmed in source

1. This checkout uses custom username/password authentication with JWTs and MongoDB. `backend/auth.py` creates user UUIDs, puts the UUID in the JWT subject, and resolves authenticated requests by that same ID. The module comment says Supabase may be adopted later; no Supabase client is in the startup path.
2. On boot, `frontend/src/context/AuthContext.jsx` reads `dm_token` from WebView `localStorage` and calls `/api/auth/me`. A valid response refreshes cached `dm_user`; an explicit 401/403 removes the local token/user and displays login. For network/server errors it preserves the token and tries the cached user. Without a token it displays login.
3. `frontend/src/api.js` gets its API host from build-time `REACT_APP_BACKEND_URL`, uses a 30-second timeout, and attaches `dm_token` as a bearer token. Missing or wrong build-time host is therefore a relevant configuration hypothesis, but this investigation did not inspect environment values or determine which host is embedded in the installed APK.
4. `frontend/src/context/GameProvider.jsx` looks up state using the authenticated user's ID (the backend does the same). If the response contains state, it loads that save. If the response is empty, it first checks only `dm_state_backup_<current-user-id>`. With no such backup, it calls `createNewState()`, writes a local backup, and immediately calls `gameApi.saveState()`.
5. `backend/server.py` returns `{"state": null}` when no MongoDB `game_states` document matches the authenticated ID. Its state PUT performs `update_one(..., upsert=True)`. Therefore a successful empty lookup can cause a new document to be written under the current ID. The GET also updates `lastSeen` and applies offline accrual when a record exists, so even GET is not strictly read-only; no production endpoint was called.
6. A regular API/network exception in the current `loadGame` path is caught and does not create a profile. The recovery UI says the saved profile was not replaced. This narrows the source-level danger to a successful empty response (or another response interpreted as empty), rather than an ordinary timeout.
7. `frontend/capacitor.config.ts` sets app ID `com.demonanic.game`, uses bundled `build` assets, and does not set `server.url`. Capacitor's bundled WebView origin therefore has distinct browser storage from a hosted browser origin. Server saves remain available across origins only when the app authenticates to the same backend as the same account.
8. Android manifest has `allowBackup="true"`; Gradle `applicationId` is `com.demonanic.game`, version code 1. The same package and signing key updated in place normally retains application data; uninstall/data clearing or changed package/signing identity can remove or isolate it. No install command, prior APK, signing identity, or device state was available to verify the player's actual install path.

### Confirmed startup risk versus unconfirmed incident cause

The source-level auto-creation hazard is confirmed. The incident's actual trigger is not confirmed. Highest-ranked explanations are:

1. **Different authenticated account/user ID:** Android may have no token, a token rejected by the backend, or the player may have logged into/registered a different account. A different ID has no matching MongoDB game state and no matching per-ID local backup, so the app can create a new profile. The previous user's document would not be overwritten by this different ID.
2. **Wrong backend/database in the installed build:** a changed `REACT_APP_BACKEND_URL`, backend deployment, or database target can return a legitimate empty result even though the old profile remains in another database. A subsequent upsert can establish a blank profile in the new target. Build-time environment values were intentionally not read or published.
3. **Local app storage was not retained:** browser storage does not transfer to Capacitor's app origin. If Android app data was cleared/uninstalled, the JWT and local backup are gone. This alone should not hide a server profile when the same account and backend are used.
4. **Original backend identity/session is no longer valid:** JWTs last 30 days in source; an expired token, changed JWT secret, or missing user row returns 401 and sends the player to login. A new registration creates a different UUID. Existing `game_states` documents may remain but cannot be associated to the player from client source alone.

These are ranked hypotheses, not observed device facts. No race condition was established from the inspected flow. No claim is made that the previous profile was overwritten or deleted.

## Recoverability and safe next steps

The existing progress is plausibly recoverable if the MongoDB record remains in the backend/database and can be associated with the original account UUID. This repository inspection cannot confirm record presence. The empty lookup/upsert affects the current authenticated ID and selected database; if the old record is under a different ID or database, it is not directly overwritten by that write. If the same ID/database had an inconsistent empty read, a subsequent upsert could overwrite state, so preserve current local app data and stop further gameplay saves until verified.

Safest recovery sequence:

1. Do not uninstall, clear storage, register another account, or continue playing/saving from the new profile. Preserve the current APK/app data and any local backup.
2. Record the account username exactly as used previously (do not share password or tokens), APK build/version/date, whether the app was uninstalled or app data cleared, and whether this is the same device.
3. Obtain a sanitized runtime diagnostic from the device: whether `dm_token` is present (boolean only), `/auth/me` HTTP status and returned user ID (do not share token), `/game/state` status plus whether state is null (do not export profile contents), and the API hostname/build target (host only; no query parameters or credentials). Compare the returned ID with the original account identity through an authorized administrator.
4. Have an authorized backend operator perform a read-only, non-mutating existence check for `users.id` and `game_states.user_id` against the configured production database, using the original account ID. Do not dump the document or issue a GET through the app, because the route applies offline accrual and updates `lastSeen`.
5. If a profile exists under the old ID/database, restore access by using the correct original account/backend or an operator-approved identity recovery. Do not copy or replace profiles until both records are backed up and ownership is established.

## Proposed fix (not implemented)

Change first-run behavior so an empty state lookup never triggers an unconditional save. Present an explicit recovery/confirmation state, retain local data, and require a deliberate new-game action only after confirming the authenticated account and backend. Consider a server-side distinction between a genuinely new account and a missing/unavailable profile, with creation guarded against replacing an existing state. Add observability that reports request status, current user ID (or a safe short hash), and whether a save exists, while never logging tokens, passwords, profile payloads, or secrets.

## Regression tests to add after approval

- Valid session plus saved backend state loads it and never calls `createNewState` or PUT.
- Empty server state plus a same-user local backup restores the backup and makes no PUT.
- Empty server state plus no local backup shows an explicit first-run/recovery decision and makes no automatic PUT.
- Authenticated request failures (401, timeout, 5xx) preserve local data and do not create or save a profile.
- A different user ID cannot read or overwrite another ID's record; account switching selects only that user's local backup.
- Replayed/overlapping load attempts or late responses cannot apply one account's state to another account.
- API host is validated at build/startup; missing/invalid host fails closed instead of looking like an empty new account.
- Android instrumentation/manual upgrade check verifies same package/signature APK upgrade retains app storage; separately test browser origin and Capacitor origin isolation.

## Tests, commands, and actual results

- `CI=true npm test -- --watchAll=false --runInBand src/game/logic.economy.test.js` from `frontend/`: exit 0; 1 suite and 3 tests passed. This suite does not test authentication/profile recovery.
- `git diff --check`: exit 0; no whitespace errors at the time it was run.
- Inspected existing `backend/tests/backend_test.py`: tests register accounts and write state; not run because they mutate the configured/preview backend.
- No dedicated AuthContext/GameProvider profile recovery tests were found by filename scan.
- `adb devices -l`: no connected device listed. No device logs were collected.
- No production build was run because no source code was changed. No backend, production DB, or player profile was queried or modified.

## Changed files and publication

Documentation updated: `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this report. No application files changed. These documents are intended for publication only on `docs/development-reports-2026-10-15`; the gameplay branch and its worktree remain untouched.

- Local code commit: none.
- Documentation publication: pending GitHub update and readback for this session.
- Push of gameplay changes: none.
- Merge: none.
- Deployment/production change: none.
