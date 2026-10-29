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

For a signed device build:

```sh
npm --prefix mobile run build:device
```

The commands select `/Applications/Xcode.app` for the current command because
this Mac's global developer path currently points to Command Line Tools.
Xcode 26 or newer is required; this project was prepared using Xcode 27.1.
Device builds require the team's Apple account and signing credentials in Xcode.
They do not install or launch the app.

To install through Xcode, open `mobile/ios/App/App.xcodeproj`, select the connected
iPhone and the **App** scheme, then run. The home-screen name is **Oracle**.
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

Record opens the section-aware studio. Speak across complete named sections, use Next section without restarting the microphone, then Finish & review. AR Create prepares evidence-linked speech cleanup and section assignments. Review Current section beside Your words, check flagged speech, then integrate one section or all ready sections into private working cards. Original audio and transcripts remain saved; neighboring sections remain intact. Intro edits are separate from the main reading. AI processing on the phone uses the private paired Mac bridge.
