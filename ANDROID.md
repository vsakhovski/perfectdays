# Android developer preview — signed APK distribution

This target bundles My Perfect Days locally using Capacitor. The hosted PWA remains a separate, notification-free distribution. Android does not download its app code from Cloudflare and does not register a service worker. There is no notification server or Firebase integration.

## Current status

The Android project, local reminder adapter, native-only Settings card, vault migration, and release-signing configuration are implemented. A signed APK has **not** yet been built or tested on a device. Native import/export, system Back, lifecycle locking, notifications after reboot/update, and OS permission behavior are release gates, not verified guarantees. Do not distribute this developer preview to real journal users before that verification.

TypeScript, lint and formatting passed for this first implementation. Dependency installation reported eight audit findings (six moderate, two high); review their dependency paths and available fixes before release. No broad automatic dependency fixes were applied.

## First build on Windows

1. Install Android Studio, the SDK platform matching `android/variables.gradle` (currently API 36), and its recommended build tools. Configure the Android SDK location using Android Studio. Use JDK 21 for the current Capacitor 8 project.
2. Run `npm.cmd ci`.
3. Run `npm.cmd run android:sync`. This builds the **native** web bundle in `dist-android/` and runs `cap sync android`, generating native plugin Gradle files and copying assets. The ordinary `npm.cmd run build` still produces the PWA in `dist/`.
4. Run `npm.cmd run android:open`. Use Android Studio to install a debug build on an emulator or physical device first.
5. Create a release keystore using Android Studio's **Generate Signed Bundle / APK → APK → Create new** workflow. Keep it outside the repository, with an offline backup and securely stored passwords. Use the same signing identity for every release.
6. Either complete that signed-APK wizard, or set these environment variables in your local terminal and run `npm.cmd run android:apk`:

   - `PERFECTDAYS_KEYSTORE`: absolute path to the release keystore.
   - `PERFECTDAYS_STORE_PASSWORD`: keystore password.
   - `PERFECTDAYS_KEY_ALIAS`: alias selected when creating the key.
   - `PERFECTDAYS_KEY_PASSWORD`: key password.

   Do not paste passwords into committed files or chat. Use your local secret manager/terminal. The scripted release build fails closed when the keystore is not configured.

7. The signed APK is normally `android/app/build/outputs/apk/release/app-release.apk`. Verify the signing certificate with Android SDK `apksigner verify --print-certs` before distribution. Share only the APK and release notes, never the keystore or credentials.

The application ID is `app.myperfectdays.journal`. Confirm this ID before the first public APK release, then keep it stable. `versionName` follows `package.json`; increment `versionCode` in `android/app/build.gradle` for every distributed update.

## Updates and migration

Install the new signed APK **over** the old version. Do not uninstall or clear data. Verify an actual upgrade with an existing PIN, journal and scheduled/skipped reminder. Keep the Capacitor hostname and scheme stable (`https://localhost`) so WebView storage remains accessible. PWA deployment does not update Android; build and distribute another APK.

PWA and Android storage are separate. Encrypted backup/restore is the intended transfer path; native file-picker/export compatibility must be checked before migration of real data. Schema 7 adds optional reminder preferences; older app releases cannot read schema-7 journals, so do not downgrade after migration.

## Reminder behavior

- Android-only. A reminder step immediately before PIN setup starts with reminders enabled; Continue requests Android notification permission. Existing journals are not automatically opted in. Configuration is saved when onboarding finishes, and device permission is still required.
- 1–7 days before the next estimate, default **2**, local time default **09:00**.
- Discreet/direct localized presets or a custom message up to 160 characters.
- One upcoming occurrence only; no catch-up burst or indefinite recurrence.
- Skipping applies to the upcoming cycle (keyed by the last recorded episode), even if its estimated date changes. After the delivery time, the same cycle is not rescheduled.
- Relevant saved changes produce a new plan. Startup/resume checks pending registrations and repairs missing future alarms without replacing unchanged ones. No journal decryption in the background.
- Disabling clears pending and displayed notifications. Restore and erasure disarm native scheduling before proceeding; activation must be confirmed again after restore.
- No exact-alarm permission: delivery is approximate and depends on Android power/permission settings. Notification swipes dismiss normally. Tapping opens the app without bypassing PIN protection or interrupting an open dialog.
- Android stores scheduled message content/time and a minimal scheduling receipt outside the PIN-encrypted vault. This is disclosed in Settings. Channel lock-screen visibility defaults to private, but users control system notification settings.

## Privacy and release checks

Automatic Android backup/device transfer is excluded, and `FLAG_SECURE` protects screenshots/recent-app previews. Explicit backup files remain under the user's control. Test these protections on actual devices.

Before distributing even a pilot APK, run the unit suite, production PWA build/artifact checks, full web E2E, native build and Android device tests. Cover first-run permission denial, re-enabling in Android Settings, disabled channels, locked/background delivery, force-stop, reboot, timezone/DST changes, app updates, skip persistence, repeated note saves without duplicate scheduling, forecast correction, backup restore, and erasure. Verify zero reminder-related network requests.

Do not commit keystores, signing passwords, APKs, SDK paths, or generated web bundles. An official Play Store release can be added later; decide signing-key continuity before switching distribution channels.
