# Android Profile Recovery — Ubuntu ADB Diagnostics

Date: 2026-10-16

## Starting state

- Starting and ending local branch: `feature/castle-management-first-pass`.
- Starting and ending commit: `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`.
- Existing work preserved: modified `frontend/src/game/towerPlacement.test.js`, modified `frontend/src/screens/Home.jsx`, untracked `frontend/src/screens/Home.test.js`, and local reports.
- Read `docs/dev-sessions/2026-10-16-android-adb-connect.md` before proceeding. The Termux `adb` binary failed in Ubuntu due to an unresolved Android NDK symbol. It was not retried.

## Compatible ADB installation and connection state

Ubuntu is 24.04.5 LTS Noble Numbat, ARM64. No Linux ADB binary was installed initially. `apt-cache policy adb` showed candidate `1:34.0.4-1build3` from the configured Ubuntu Noble `universe` repository. With escalation approval, ran `apt-get install -y adb` (exit 0). Apt installed that package and eight dependencies from the configured `ports.ubuntu.com/ubuntu-ports` repositories. No arbitrary binary was downloaded or copied into the repository.

`/usr/bin/adb version` reported ADB 1.0.41, version 34.0.4-debian. `/usr/bin/adb devices -l` reported one TCP/IP transport in `device` state. The live transport endpoint matched the previously supplied IP/port; this was verified from `adb devices`, not assumed. The exact private endpoint is omitted from this public report. A read-only `pm path com.demonanic.game` query succeeded, confirming the Demonanic package is installed on the connected device. No new pair or reconnect command was needed, and no pairing code was requested.

`adb mdns services` and `adb mdns check` both returned `unknown host service`, so mDNS discovery is unavailable through this Ubuntu ADB setup. This did not block use of the already-active TCP/IP transport. No other current Wireless debugging port was inferred from the earlier value.

## Safe runtime log collection

Read the current log buffer with `/usr/bin/adb logcat -d -v brief`, piping it directly through a Python filter that emits only approved, redacted markers. The raw buffer was not returned to the tool output.

Observed aggregate: 237,537 log lines; 2 lines contained `Demonanic`; zero auth markers, zero game markers, zero API markers, and zero relevant WebView console lines. The filter found no recognized auth/profile/API events. No token, username, full user ID, request body, response body, URL, or raw log line was printed. This means the current buffer does not establish whether auth was restored, which account ID is active, what backend answered, whether state was null, or whether a save occurred.

The installed package path was read, and its APK was copied read-only into a temporary directory for a static check. The configured backend origin could not be safely extracted by the bounded check; no URL was printed. The temporary APK is not a profile or app-data backup and was not uploaded. The build-time `REACT_APP_BACKEND_URL` value and the expected backend hostname remain unavailable for comparison.

No app launch was performed: normal startup can call state loading and may create/save a profile when the API reports no state. No authentication, game-state, or save endpoint was called. No localStorage/WebView data or token was read.

## Findings and limitations

- **ADB access:** confirmed; Ubuntu Linux ADB is functional and a live TCP/IP device is present. The connected endpoint matched the previously supplied endpoint at the time checked.
- **Demonanic installation:** confirmed by a read-only package-path query.
- **Authentication/session:** not verified; no auth markers were present in the current logcat buffer, and local auth storage was not read.
- **Profile GET/PUT behavior on device:** not verified; no game/API markers were present and no endpoint was called.
- **Backend configuration:** not verified. Static APK extraction did not safely identify the origin, and no expected backend hostname was supplied.
- **MongoDB record:** not verified. Mongo credentials and a read-only diagnostic path remain unavailable. The app's GET route was not called because it mutates offline accrual and `lastSeen`.
- **Profile recovery cause:** remains unconfirmed. The source-level risk remains as documented in prior reports, but this device stage provides no evidence that it occurred in the player's session.

## Commands and results

- `apt-cache policy adb`: exit 0; Ubuntu candidate `1:34.0.4-1build3`.
- `apt-get install -y adb`: exit 0; package and dependencies installed from configured Ubuntu repositories after escalation approval.
- `/usr/bin/adb version`: exit 0; ADB 1.0.41 / version 34.0.4-debian.
- `/usr/bin/adb devices -l` with serial redacted: exit 0; one TCP/IP device in `device` state.
- `/usr/bin/adb -s <active-device> shell pm path com.demonanic.game`: exit 0; package installed.
- `/usr/bin/adb logcat -d -v brief | <redacting filter>`: exit 0; aggregate counts above; no raw lines emitted.
- `/usr/bin/adb mdns services` and `mdns check`: exit 1; host service unavailable.
- Installed APK static-origin extraction: completed; no origin safely extracted.
- `git diff --check`: exit 0.
- No application tests/build ran; source code was not modified.

## End state and publication

- Local branch and commit remain `feature/castle-management-first-pass` at `7fb3d67c552a48551f2ee39af3f1ac4cf5f548ad`; existing application changes remain untouched.
- ADB and Android package diagnostics were read-only. No account, profile, app data, or production database was changed.
- Documentation updates: `DEVELOPMENT_LOG.md`, `ROADMAP.md`, `TEST_REPORT.md`, and this session report. Published only these four Markdown files to `docs/development-reports-2026-10-15` in docs-only commit [`82c45bb`](https://github.com/demonanic/Demonanic/commit/82c45bb449613deb7415c0f8a192010bc2f0cf0b). GitHub readback succeeded for all four paths. This report receives a docs-only follow-up to record the readback.
- No gameplay push, merge, or deployment occurred.

## Remaining information required

1. The original account identity and intended backend hostname from a trusted source, without sharing credentials.
2. An authorized operator and original user ID for a no-update Mongo existence query that returns only presence booleans.
3. Safe auth/profile logs from a prior natural app startup, or approval for a future source change that prevents automatic profile creation before diagnostics. Do not launch this build to generate logs while auto-save-on-empty behavior remains possible.
