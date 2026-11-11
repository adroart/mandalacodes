# Oracle for iPhone

This native iOS app bundles the dedicated Oracle web build. Its name is **Oracle**,
bundle ID is `com.adrian.oracle`, and signing team is `X2RS69BS48`. It uses
Capacitor 8.5.3 with Swift Package Manager and supports iOS 15 or later.
There is no remote development-server URL.

From the repository root:

```sh
npm --prefix mobile ci
VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle
npm --prefix mobile run sync
npm --prefix mobile test
npm --prefix mobile run build:simulator
```

For a signed device build, use the same account-enabled web build first:

```sh
VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle
npm --prefix mobile run build:device
```

The web build writes `dist-oracle/oracle-build.json` (`accounts`, `commit`,
`builtAt`). `build:device` first runs `mobile/scripts/check-oracle-build.mjs` and
stops, before syncing or signing, when that file is missing, says `accounts` is
false, or names a commit other than the current git HEAD. It prints one line such
as `Error: The Oracle web bundle was built without phone sign-in. Run:
VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle`. Run that command, commit
any changes first so the commit matches, and build again. `build:simulator` only
warns. The account screen ends with a line such as `Oracle · build 19 · a1b2c3d ·
11 Nov 2026` so a phone can be matched to its bundle. The signing checks below are
unchanged.

The commands select `/Applications/Xcode.app` for the current command because
this Mac's global developer path currently points to Command Line Tools.
Xcode 26 or newer is required; this project was prepared using Xcode 27.1.
Device builds require the team's Apple account and signing credentials in Xcode.
They do not install or launch the app.

Free Personal Team installs use seven-day provisioning profiles. The default
`build:device` command now requires a fresh signing clock for the app and widget.
It CMS-decodes the two standard Xcode profile caches and moves only exact free
development profiles for `com.adrian.oracle` and `com.adrian.oracle.widget`, team
`X2RS69BS48`, into a private backup. It then builds with Xcode automatic
provisioning and a new DerivedData directory. It changes no certificates, Apple
server registrations, installed apps, or app data.

The build succeeds only when both embedded profiles were created after this
build started (allowing five minutes of clock skew) and each has at least **6 days
23 hours** remaining at verification. It verifies the actual bundle IDs, signed
team/entitlements, code signatures, and the signing certificate's presence in each
profile. A stale profile downloaded again from Apple fails the build. There is no
freshness override. A build number change or reinstall alone does not reset the
clock. Free development does not require App Store submission or paid enrollment.

A successful build promotes the verified app to the existing device output path
below. A failed build leaves that previous output intact and returns nonzero;
**do not install after a failed build**, including from an older output. Cache
rollback never overwrites a newly generated profile. Conflicting backups remain
private for recovery. Audit dates, scope and outcome plus the recovery manifest
are retained under `~/Library/Application Support/FreshDeviceSigning/` in a
per-scope directory. Backed-up profiles contain private signing metadata; do not
share or commit them. Xcode command output is suppressed because it can include
account and device identifiers. The helper reports sanitized failure messages.

For offline policy tests, run `npm --prefix mobile run test:signing`. Another app
can use the same helper with `python3 /absolute/path/fresh_device_build.py
--config /absolute/path/signing.json` from that app's native package directory.
Copy `scripts/oracle-device-signing.json`, replacing the exact team, app and every
extension's relative path/bundle ID plus the existing Xcode build settings. No
wildcard bundle scopes are accepted. This does not change Mosaic's workflow.

After interruption, inspect that run's private `audit.json` and `recovery.json`.
To recover retained cache entries, import this helper and pass the manifest's
`(Path(entry['source']), Path(entry['backup']))` pairs to `restore_profiles`.
It uses atomic, non-overwriting links; entries with an existing destination stay
in the private backup. Never copy a backup over an existing cache file.

After a successful fresh build, installation is a separate step. Opening Xcode
and running another build can choose different profiles, so verify that new
artifact again before installing. The project is `mobile/ios/App/App.xcodeproj`
and its scheme is **App**. The home-screen name is **Oracle**.
An unlocked, paired phone with Developer Mode enabled is required.

Build outputs are in `mobile/build/simulator/Build/Products/Debug-iphonesimulator/App.app`
and `mobile/build/device/Build/Products/Debug-iphoneos/App.app`.
After a web change, rebuild `dist-oracle` and run `sync` before building in Xcode.
Keep the native project and lockfiles in Git; generated web assets, dependencies,
local signing state and build outputs are ignored.

The app icon is a 1024-pixel opaque resized copy of the first Oracle artwork,
from `.oracle-public/oracle-art/1.webp`.

The native controller supplies Capacitor's cookie/HTTP startup settings before
its bridge script runs. This avoids the synchronous document-start prompt that
stalled WKWebView on the iOS 27 simulator. Settings come from Capacitor config;
Only disabled cookie/HTTP probes bypass the prompt. Ordinary prompts, cookie
operations, enabled plugin probes, and native sharing keep their standard behavior.
`npm --prefix mobile test` checks those boundaries against the injected script.

The native app and website share `components/oracle/entry/OracleDrawDialog.tsx` and its stylesheet. The app adds its optional question and saved-reading flow around the shared coin casting and trigram chooser.

## Build 12 account verification

Use the account-enabled build command above for production phone updates. Omitting
`VITE_ORACLE_NATIVE_ACCOUNTS=true` deliberately disables phone login; build 12 was
packaged with it enabled.

Build 12 uses the shared sign-in form for Google, password, and email-code sign-in.
The system authentication prompt identifies the app as Oracle. Reminder time
controls keep their spacing at narrow phone widths.

Run `npm run test:oracle-account` for the
mocked account/reminder layout checks. They do not establish that a real Google
account completed authentication. On the installed phone, verify Google sign-in,
reopen the app to confirm the session remains, and sign out. No device rebuild
or installation is needed merely to merge these already-installed source changes.

## Build 13 whole-card voice workflow

Record opens the section-aware studio. Speak across complete named sections, use Next section without restarting the microphone, then Finish & review. AR Create prepares evidence-linked speech cleanup and section assignments. Review Current section beside Your words, check flagged speech, then integrate one section or all ready sections into private working cards. Original audio and transcripts remain saved; neighboring sections remain intact. Intro edits are separate from the main reading. On the phone, recordings go to the site first (signed in, owner account only). The paired Mac bridge is only a fallback, used when the site answers 404, 405 or 503.
