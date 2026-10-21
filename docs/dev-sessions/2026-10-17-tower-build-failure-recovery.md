# Tower build failure recovery

## Scope and starting state

Continued on `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`. The initial status showed the branch one commit ahead of origin, no staged changes, and pre-existing modified and untracked castle-management, profile-recovery, menu, test, and report files. Those existing changes were preserved. Only `Preparation.jsx`, `PrepField.jsx`, `PrepField.test.jsx`, `DEVELOPMENT_LOG.md`, `TEST_REPORT.md`, and this report were edited for this task.

## Finding and fix

`Preparation` checked current resources/capacity synchronously, then called `mutate()`, where `buildTower()` runs later inside the React state updater. The handler returned `true` immediately after queuing that updater. If the actual build failed against the latest state, `PrepField` interpreted the immediate return as success, switched to `PLACING…`, and waited for a tower that would never appear.

Added a deterministic regression test with a delayed build callback resolving `false`. Before the code change, the test failed because the confirm control remained `PLACING…`. The handler now resolves with the actual `buildTower()` result; `PrepField` awaits that result and only enters its pending state on success. A failed or rejected build leaves the preview and confirmation available. A successful build continues to wait for the new tower in state before clearing the preview.

## Verification

| Command / check | Result |
| --- | --- |
| Pre-fix focused regression | Failed as expected: `PLACING…` persisted after deferred failure. |
| Focused placement tests | Passed: 2 suites, 8 tests. |
| Full frontend suite | Passed: 12 suites, 65 tests. |
| Android config tests | Passed: 4/4. |
| Guarded `build:android` with expected configured host | Passed; existing Node `fs.F_OK` deprecation warning. |
| Capacitor sync | Passed. |
| Android `assembleDebug` | Passed: 93 actionable tasks; existing experimental AAPT2 override and `flatDir` warnings. |
| `git diff --check` | Passed. |

The Android APK is local only and was not installed or launched. No backend/API request or production data change occurred. Touch behavior on an Android device remains unverified.
