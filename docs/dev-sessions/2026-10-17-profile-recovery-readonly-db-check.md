# Saved Profile Recovery — Read-Only Database Check Availability

Date: 2026-10-17

## Starting and ending state

- Application branch at start/end: `feature/castle-management-first-pass`.
- HEAD at start/end: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- The worktree already contained uncommitted tower-placement, menu, recovery-guard, backend-safety, Android build-validator, workflow, and test changes. They were preserved. This session edited documentation only; no application code was changed.
- The checkout is one local commit ahead of its origin tracking branch. No branch switch, reset, clean, stash, or local commit occurred.

## Finding

**Original save status: still unverified.** No production database was queried. This session cannot conclude that the original user or game-state record exists or is absent.

The local process does not have an authorized read-only Mongo connection or the information needed to resolve the expected account. Presence-only checks (without printing values) found `MONGO_URL`, `DB_NAME`, `READ_ONLY_MONGO_URL`, and `EXPECTED_USER_ID` unset. `mongosh` and `mongo` are not installed. No operator-provided authorized diagnostic route or credential path was available. These are environment facts; they do not establish what access a trusted service owner may have elsewhere.

ADB currently returns device state `device`. The connected phone was not launched, paired, reconnected, queried for app storage, or used to issue game requests. Its endpoint was intentionally omitted. ADB connectivity does not identify the original account or establish save presence.

## Exact safe information and operator action needed

1. The player should privately provide the **exact original login username** to the trusted Demonanic service/database operator. A password, JWT, or copied authentication response is not needed. The username must not be put in a report or public issue.
2. The operator must independently confirm the intended production service/cluster and database from deployment configuration or service records. The current guarded Android build is configured for hostname `demonanic.onrender.com`, but the old installed APK was previously shown to have no usable backend hostname. The currently configured host alone does not prove where the old save was written.
3. Using an already authorized MongoDB account limited to read access on the exact database/collections, the operator privately resolves the normalized username in `users` to its internal `id`. They then check whether `users` has that ID and `game_states` has the corresponding `user_id`.
4. The operator returns only booleans: expected backend/cluster confirmed; user record exists; game-state record exists; stored `state` has recognizable shape (for example, object plus numeric finite `wave`). They may provide a non-identifying correlation label or a short one-way digest computed privately from the resolved ID if needed to distinguish the checked account. Do not return the ID, username, document, state fields/values, or credentials.

These checks can use read-only `find`/aggregation operations with projections that emit only existence/type booleans. The database role should be read-only; no write-capable credential should be used. Do not use the application's `GET /api/game/state`: backend code calls `apply_offline_accrual`, updates `lastSeen`, and writes the modified state. Do not call its PUT endpoint, which upserts. Do not call POST creation, registration/login, or any save/reward route for diagnosis. No query was simulated in this session.

The local backend source confirms that auth resolves normalized `users.username` to `users.id`; game state is keyed by `game_states.user_id`. The frontend account ID comes from its authenticated user object. This session did not inspect device storage or extract that ID. The player's original login username plus the operator's verified deployment target is therefore the smallest safe handoff; the operator, not a client-supplied user ID, should perform the identity mapping.

## Recovery guard and Android configuration review

- `GameProvider.loadGame()` leaves cloud saves disabled while loading. Only an explicit `{state: null}` produces the missing-profile prompt; malformed responses and request/auth/network errors result in an error prompt and do not create a replacement profile.
- A same-user local backup is offered explicitly. Continuing locally keeps cloud writes disabled. An explicit new-game action is required; backend creation uses insert-only behavior and duplicate `user_id` is rejected by the unique index. These behaviors were reviewed in source, not exercised against production.
- The Android build validator rejects missing or invalid configuration and only allows the expected HTTPS origin. The prior report records a guarded build/static APK check. The newly built APK has not been installed/launched; the currently installed older APK remains untouched.
- No Android auth/profile request logs were collected. No token, password, raw auth response, profile contents, or private identifier was printed.

## Commands and actual results this session

| Command/check | Exit | Result |
| --- | ---: | --- |
| `git branch --show-current`, `git rev-parse HEAD`, `git status --short --branch`, `git diff --stat` | 0 | Branch `feature/castle-management-first-pass`, HEAD `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`; existing modified source/workflow files and untracked tests/reports preserved. |
| `git diff --check` (initial and final) | 0 | No whitespace errors. |
| `npm run test:android-config` (from `frontend/`) | 0 | 4 Node tests passed. |
| `adb get-state` and `adb devices -l` | 0 | Connected device reported; endpoint redacted. No app action followed. |
| Presence checks for `MONGO_URL`, `DB_NAME`, `READ_ONLY_MONGO_URL`, `EXPECTED_USER_ID`, `REACT_APP_BACKEND_URL` | 0 | All unset; values were never printed. |
| `command -v mongosh` and `command -v mongo` | 0 | Neither client is installed. |
| Source review (`backend/auth.py`, `backend/server.py`, `frontend/src/context/GameProvider.jsx`, `frontend/src/api.js`, Android validator/workflow) | 0 | Confirmed schema/key relationship and mutating behavior of state GET/PUT; no request was sent. |

The focused config tests are real local Node tests. There was no backend runtime/database test, no full frontend test run/build, and no device runtime verification in this session. Prior session results remain in `TEST_REPORT.md`; they are not new results here.

## Changed files

- `DEVELOPMENT_LOG.md`: appended this session's findings and exact checks.
- `ROADMAP.md`: kept original profile status unverified and added the missing read-only prerequisites.
- `TEST_REPORT.md`: added only the checks actually rerun this session.
- `docs/dev-sessions/2026-10-17-profile-recovery-readonly-db-check.md`: this detailed report.

No application or backend source was changed. All existing tower-placement, main-menu, profile-recovery and build-configuration changes remain local and uncommitted. No data was changed. No local commit, merge, deployment, or application-code publication occurred.

## Safest next step

Ask the player to give their exact original login username privately to the trusted service/database operator. The operator should confirm the correct production cluster, use a read-only database identity to resolve the ID internally, and return only the requested booleans. Until then, keep the old installed APK unlaunched and do not install the new APK or use any game-state endpoint for diagnosis.

## Documentation publication

Published only `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this report to `docs/development-reports-2026-10-15` in documentation-only commit [`7c0d4f5bd03a6f4e1c89bd5215d6142214408f5c`](https://github.com/demonanic/Demonanic/commit/7c0d4f5bd03a6f4e1c89bd5215d6142214408f5c). GitHub readback succeeded for all four paths. The commit's changed-path list contains only those four Markdown files; no gameplay or backend source was published.

No merge or deployment occurred. No application-code changes were published.
