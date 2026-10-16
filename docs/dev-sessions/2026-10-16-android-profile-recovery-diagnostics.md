# Android Saved Profile Recovery — Device and Database Diagnostics

Date: 2026-10-16

## Checkout and preservation

- Starting and ending branch: `feature/castle-management-first-pass`.
- Starting and ending commit: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad` (`Fix tower placement position consistency`).
- Pre-existing changes observed and preserved: modified `frontend/src/game/towerPlacement.test.js`, modified `frontend/src/screens/Home.jsx`, untracked `frontend/src/screens/Home.test.js`, and local documentation. No app source, gameplay, or profile data was changed.
- No branch switch, reset, stash, merge, or local commit occurred.

## Read the prior investigation

The previous report, `docs/dev-sessions/2026-10-16-android-profile-recovery.md`, confirms a source-level risk: when authenticated `GET /api/game/state` returns `state: null` and the current user has no local backup, `GameProvider.loadGame()` creates a new profile and immediately saves it. That report did not confirm the incident's device-specific cause.

## Device availability and runtime log collection

- `adb` exists at `/data/data/com.termux/files/usr/bin/adb`.
- `adb devices -l` listed no connected Android device. As a result no `logcat`, installed package metadata, app storage, or live API traffic was collected.
- No expected account ID, original username, API hostname, installed APK build identifier, or prior login details were supplied in this environment. There was nothing available to compare against.

### Safe way to identify runtime values when device access is restored

The app already emits useful markers, but **raw logcat is unsafe to share**:

- `AuthContext.jsx` logs whether `dm_token` is present (boolean), then `/auth/me` starting/success/failure. The success log serializes the user data, including ID and username. Login/register success logs serialize the full response, which includes the JWT. Login/register start logs the username and password length.
- `api.js` logs backend/API URL, request method/URL and whether a token is present, plus response status/URL. Error logs include response data and full error details; the base URL is also repeated.
- `GameProvider.jsx` logs profile-load start (username or ID), whether a saved profile loaded, creation of a new profile, load failures, and save success/failure markers. Error objects may include URL/response details.

Do not collect or transmit unfiltered `adb logcat` output, Chrome/WebView console exports, HTTP request dumps, or WebView storage files. For a controlled diagnostic, an authorized operator should inspect logs on-device or through a local redacting filter that emits only:

- `dm_token`: present/missing boolean only;
- `/auth/me`: status and whether it returned a user, plus a short one-way hash of the ID for correlation (do not emit username or full ID in a shared report);
- state GET and PUT: method, route, HTTP status, and a boolean `state_present`/`state_null`; never body or response state;
- backend origin: scheme and hostname only, with user info, port if sensitive, path, query, and fragment removed;
- whether a `NEW PROFILE CREATED` or `SAVE OK` marker occurred.

Compare the hashed or full ID **locally under the player's control** with the original account's expected ID obtained from an authorized admin; compare backend hostname with the intended deployment configuration. Do not paste tokens, passwords, request headers, usernames, profile bodies, Mongo URLs, or raw logs into chat. Because current code logs JWTs and broad error objects, filtering must be applied before any log output is copied or uploaded.

`REACT_APP_BACKEND_URL` is injected at frontend build time, and no value was inspected here. The runtime API log may show its configured origin, but only a redacted origin should be retained. No conclusion can be drawn about the APK installed on the player's phone from this checkout alone.

## MongoDB read-only diagnostic availability

- `mongosh` and legacy `mongo` were not found on `PATH`.
- `MONGO_URL`, `DB_NAME`, and `REACT_APP_BACKEND_URL` were unset in this shell. The bounded repository scan found no `.env*` files; file contents were not read.
- Source/repository scans found no existing read-only game-state diagnostic route or operator script. The existing `GET /api/game/state` is not a safe substitute: it applies offline accrual and writes the modified state and `lastSeen`.
- No database query was attempted. There is no authorized existing diagnostic path available in this environment, and no player user ID is available to check.

An authorized database operator could perform a no-update existence check against the correct Mongo deployment after receiving the expected user ID through a trusted channel. The check should return only booleans for `users.id` and `game_states.user_id`; do not export the game-state document or credentials. The original ID/backend must first be established. This investigation did not access production data.

## Evidence and hypothesis status

| Hypothesis | Evidence from this stage | Status |
| --- | --- | --- |
| Wrong/current account ID | No device, auth response, or expected ID was available. Source confirms saves are keyed by authenticated user ID. | Unresolved; not confirmed or ruled out. |
| Wrong backend/database in APK | Build config is `REACT_APP_BACKEND_URL`; no build-time value or installed APK runtime value was available. | Unresolved; not confirmed or ruled out. |
| Session restoration failure | Source logs would reveal token-present and `/me` status, but no runtime logs/device. Existing log formatting may include secrets. | Unresolved. |
| Successful empty state lookup followed by auto-creation | Source path is established in prior report, but no runtime GET result or DB record was available. | Mechanism confirmed; incident occurrence unconfirmed. |
| App data not retained across APK update | No device install history/package state available. | Unresolved. |
| Existing profile remains in MongoDB | No read-only DB credentials/tool/identity were available. | Unknown; recovery remains plausible but unverified. |

## Tests and commands

- `adb devices -l`: no connected device; no logs were collected.
- `command -v mongosh` and `command -v mongo`: no executable found.
- Shell checks confirmed `MONGO_URL`, `DB_NAME`, and `REACT_APP_BACKEND_URL` unset without printing values.
- Bounded source scan found no existing read-only state diagnostic; backend `GET /api/game/state` was inspected in source and not called.
- `git diff --check`: exit 0; no whitespace errors.
- No app tests or build were run because no source code changed.

## Changes and end state

- Documentation updated: `DEVELOPMENT_LOG.md`, `TEST_REPORT.md`, `ROADMAP.md`, and this report.
- No app/gameplay code changed; no profiles/accounts/data were read or written.
- Docs-only publication to `docs/development-reports-2026-10-15` is requested and will be verified by GitHub readback before the session ends.
- No gameplay push, merge, deployment, or production change occurred.

## Information still needed

1. A connected device or user-collected, safely redacted diagnostics as listed above.
2. Expected original account identity and intended backend hostname from a trusted source; do not share credentials.
3. An authorized operator with a read-only route to the correct Mongo deployment and the original user ID, to return only record-existence booleans.
