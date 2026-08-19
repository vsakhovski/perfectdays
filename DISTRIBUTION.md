# Distribution and Store-Release Plan

> Last policy review: 2026-08-19. Store policies, fees, target SDK requirements, and legal obligations change. Re-check every linked primary source immediately before creating accounts and before each submission. This document is an engineering and product-planning reference, not legal, medical, tax, or export-control advice.

## Recommended Distribution Strategy

For the current product, distribute the hosted PWA first and add store packages later. The recommended sequence is:

1. Deploy the production `dist/` directory as a static PWA on a permanent custom HTTPS domain.
2. Use that deployment for private pilots, direct installation, and the public web release.
3. After the mobile experience and public-release gates are complete, package the same application with Capacitor for the Apple App Store and Google Play.

### Primary PWA Channel

Cloudflare Pages is the best current fit for this repository because the application has no runtime backend, Pages supports Git-based deployments and custom domains, and the existing `public/_headers` file is supported directly for static-response security and cache headers. Other capable static hosts remain possible, but their header configuration must be translated and verified on the deployed origin.

Use these build settings:

```text
Build command: npm ci && npm run build
Output directory: dist
Production branch: main
```

`vite preview` is only a local production-build preview and must not be used as the public server. Distribute the hosted URL or a QR code instead of sending the `dist/` directory or asking users to open `dist/index.html` directly. PWA installation and service workers require a correctly served secure origin.

Installation instructions should cover:

- iPhone and iPad: use the browser's **Add to Home Screen** action;
- Android: use **Install app** or **Add to Home Screen**;
- Chrome and Edge on desktop: use the installation control in the address bar or browser menu.

Choose the permanent production origin before real users create journals. Browser storage, the installed PWA, and its IndexedDB vault are scoped to an origin and browser profile. Moving from a temporary preview domain to the final domain does not migrate existing journals. Installation from another browser can also create a separate app instance with separate local data. Encrypted backup and restore is the supported migration path.

The application does not transmit journal contents to the static host. The host will nevertheless receive ordinary connection metadata, such as an IP address and requests for application assets. Do not add advertising, analytics, attribution, translation, or other third-party scripts without a new privacy review.

### Release Sequence

**Private pilot:** deploy to the permanent HTTPS domain, share the link with selected testers, and validate installation, offline startup, updates, rollback, encrypted backup/restore, deletion, security headers, and physical iOS/Android devices.

**Public PWA:** retain the hosted PWA as the canonical release, add concise installation instructions and a QR code, publish privacy/support/limitations pages, automate verified deployments, and document recovery from a faulty service-worker release.

**App stores:** add Capacitor iOS and Android projects when store discovery, platform-native local notifications, lifecycle integration, file sharing, or app-switcher privacy justify the added signing, review, and maintenance work. Avoid submitting a minimal iOS web wrapper: Apple requires utility and an app-like experience beyond a repackaged website. A Trusted Web Activity remains an optional Android-only shortcut, but it depends on the hosted origin and browser and does not solve iOS distribution.

Primary references: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [PWA installation behavior](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing), [Capacitor](https://capacitorjs.com/docs), [Apple minimum functionality](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality), and [Android Trusted Web Activities](https://developer.chrome.com/docs/android/trusted-web-activity/).

## Long-Term Channel Strategy

Keep three distribution targets from one source repository:

1. The existing hosted PWA for private pilots, direct installation, and the web release.
2. A bundled iOS application built with Capacitor for TestFlight and the Apple App Store.
3. A bundled Android application built with Capacitor for Google Play testing and production.

Capacitor is preferred over an Android-only Trusted Web Activity (TWA) because this app benefits from native local notifications, file import/export, lifecycle locking, private app-switcher snapshots, immediate first-launch offline behavior, and consistent iOS/Android infrastructure. Capacitor is designed to be added to an existing web project and can create both native platforms.

A TWA remains a lower-effort Android alternative if the app never needs meaningful native integration. It displays the hosted PWA through a supported browser, requires Digital Asset Links to prove ownership of the web origin, and can have an unprepared offline experience on its first launch before the service worker is installed.

| Channel                   | Package                                           | Strengths                                                                                 | Important limitations                                                                         |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Direct web/PWA            | Existing HTTPS deployment                         | Fastest private pilot; no store review; existing offline shell                            | Limited discovery; no reliable cross-platform local alarm API                                 |
| Google Play TWA           | Lightweight Android wrapper around the hosted PWA | Small Android project; web deployment remains authoritative                               | Browser and origin dependent; weaker native integration; separate iOS solution still required |
| Capacitor iOS/Android     | Store binaries containing the built web assets    | Shared application code plus native APIs; immediate offline start; native local reminders | Native projects, signing, releases, and platform adapters must be maintained                  |
| Full Swift/Kotlin rewrite | Independent native applications                   | Maximum platform control                                                                  | Two new UI codebases; not justified by the current product                                    |

## Architecture for Native Distribution

The domain, application, React feature, localization, and most presentation code should remain shared. Add native platforms and implement native adapters behind the existing application ports:

```text
android/                         Android Studio project
ios/                             Xcode project
src/infrastructure/native/
  persistence/                   Native vault-record storage, if adopted
  files/                         Import, export, document picker, and sharing
  lifecycle/                     Background, foreground, and lock integration
  notifications/                 On-device reminder scheduling
  privacy/                       App-switcher snapshot and screen protection
```

Native-release engineering requirements:

- Bundle the production web assets inside each binary. Do not submit a thin iOS shell that merely opens the hosted website.
- Disable PWA service-worker registration inside the native container. Store releases, rather than Workbox, should update bundled native-app assets.
- Keep the hosted PWA and store apps on the same logical vault schema and backup format.
- Treat encrypted backup/restore as the supported transfer path between the browser PWA and a store app. A native WebView cannot automatically access an existing browser profile's IndexedDB.
- Decide whether WebView IndexedDB is sufficiently controllable or whether the immutable vault-record store should receive a native filesystem/database adapter.
- Preserve crash-safe active-record replacement and encrypted/plaintext representation rules in every adapter.
- Connect auto-lock to native foreground/background lifecycle events.
- Hide or replace sensitive UI in iOS and Android recent-app/app-switcher snapshots.
- Add native document-picker and share-sheet adapters for encrypted backup and explicitly warned readable export.
- Verify that **Erase everything** deletes vault records, inactive candidates, preferences, reminder registrations, native temporary files, and previews.
- Schedule future reminders with native local-notification APIs when running inside a store app. This permits on-device delivery without sending a health-derived timestamp to a server.
- Use feature detection and one platform-capability facade instead of scattering Capacitor checks through React features.
- Audit every native plugin and transitive SDK before inclusion. Avoid advertising, analytics, attribution, fingerprinting, and unneeded crash-reporting SDKs.

## Current Readiness Assessment

The product has enough substantive functionality to be more than a repackaged informational website: it provides offline journaling, a mobile calendar, local encryption, PIN locking, derived estimates, correction workflows, backup/restore, readable export, and destructive erasure. That is favorable for Apple's minimum-functionality review.

It is not ready for public store submission yet. Current release blockers include:

- placeholder product name, logo, splash artwork, and icon;
- no `ios/` or `android/` native projects;
- no public privacy-policy, support, or terms pages;
- incomplete public-beta clinical and safety copy;
- no completed intended-use or medical-device classification review;
- no completed GDPR/data-protection or US consumer-health legal review;
- no independent security review of the final native builds;
- no verified exclusion of personal health data from iCloud backup;
- no real-device validation of native lifecycle, import/export, restore, deletion, notifications, software keyboard, accessibility, and app-switcher behavior;
- final name/trademark clearance remains open;
- manual contrast, forced-colors, screen-reader, large-text, and usability review remains open.

## Apple App Store

### Developer and Build Requirements

- Join the Apple Developer Program. The currently published price is USD 99 per membership year, or local equivalent.
- Prefer an organization account. Apple says apps providing services in highly regulated fields or requiring sensitive information should be submitted by the legal entity providing the service rather than an individual.
- An organization needs a verifiable legal entity and D-U-N-S number. The store displays the organization's legal name.
- Maintain a Mac with a supported Xcode release, a unique bundle identifier, signing identities, App Store provisioning, and version/build numbers.
- Upload signed archives to App Store Connect and validate through TestFlight before production review.
- Use public platform APIs only and keep native dependencies current.
- Include an accurate privacy manifest for the application and all relevant third-party SDKs.
- Declare permitted reasons for any covered required-reason APIs. App Store Connect rejects builds whose relevant API use lacks the required declaration.

### Minimum Functionality and Review Quality

Apple Guideline 4.2 says an application must provide adequate utility and an app-like experience beyond a repackaged website. To reduce rejection risk:

- ship the application assets in the binary;
- preserve full offline first-launch behavior;
- use platform-appropriate file pickers, share sheets, lifecycle handling, and local reminders;
- eliminate prototype labels, placeholder assets, broken controls, debug content, and web-navigation artifacts;
- provide polished iPhone layouts and test every declared device class;
- ensure every advertised feature works without an external account or undocumented setup;
- keep production services available throughout review if any network feature is introduced.

Acceptance is never guaranteed solely because Capacitor or another approved framework is used.

### Health, Privacy, and Storage

- Publish a stable privacy-policy URL and link it prominently inside the app.
- Describe exactly what data is entered, where it is stored, how PIN-disabled and PIN-enabled storage differ, how export works, and how data is erased.
- Explain retention/deletion, consent withdrawal, and every third party that can access user data.
- Complete App Privacy answers for the app and every embedded SDK.
- Data processed only on-device and never transmitted is not considered collected for Apple's App Privacy answers. Re-evaluate this if push scheduling, remote backup, analytics, crash reporting, or support uploads are introduced.
- Do not use menstrual or wellbeing data for advertising, marketing, data brokerage, or behavioral profiling.
- Do not store personal health information in iCloud. Explicitly verify and enforce exclusion of the vault, WebView storage, exports, temporary plaintext, and diagnostic artifacts from iCloud backup.
- Do not request HealthKit, contacts, location, camera, microphone, advertising identifiers, or other protected resources unless a reviewed core feature genuinely requires them.
- If HealthKit is added later, disclose the exact health data accessed and satisfy the additional HealthKit rules.

### Intended Use and Health Claims

Use a restrained intended-purpose statement, for example:

> A private journal for recording menstrual cycles and presenting estimates based on the user's own recorded history.

Do not advertise the app as:

- diagnosing, treating, curing, or preventing a condition;
- measuring a biological state;
- guaranteeing period dates or wellbeing states;
- providing contraception, fertility, or ovulation testing;
- directing important decisions based on predicted cycle phase;
- establishing universal mood, conflict, cognition, or self-esteem effects.

Apple may scrutinize health-accuracy claims and can request the methodology or evidence supporting them. Keep the forecast range, uncertainty, history count, personal-data basis, and non-medical limitations visible.

Apple has introduced regulated-medical-device information in App Store Connect for applicable Health & Fitness or Medical apps and regions. Complete the declaration accurately even when the legal conclusion is that the app is not a regulated medical device.

### Encryption and Export Compliance

The app deliberately uses PIN-based encryption and standard cryptographic algorithms. Complete App Store Connect's encryption/export-compliance determination before TestFlight or App Store submission. Do not assume an exemption without reviewing the implementation and target territories. If documentation is required, obtain approval and place the resulting values in the native app metadata as directed by Apple.

### App Store Metadata

Prepare:

- cleared name, subtitle, category, bundle ID, SKU, and copyright;
- age rating and intended-audience answers;
- localized English and German descriptions, keywords, screenshots, and release notes;
- final icon and launch assets;
- privacy-policy, support, and optional marketing URLs;
- App Privacy answers;
- regulated-medical-device declaration where shown;
- Digital Services Act/trader status and territory-specific business information where applicable;
- review contact, detailed review notes, and attachments supporting non-obvious health/privacy behavior.

## Google Play

### Developer and Build Requirements

- Create a Play Console account. The currently published registration fee is a one-time USD 25.
- Prefer an organization account for this health app. Google specifically directs health-app providers toward organization accounts; organization verification requires a D-U-N-S number.
- Personal and organization profiles require identity/contact verification. Newly created personal accounts can also require Android-device verification.
- New personal accounts created after 2023-11-13 must complete a closed test with at least 12 continuously opted-in testers for 14 days before applying for production access. Re-check whether the chosen organization account has any equivalent current requirement.
- Build and sign an Android App Bundle (`.aab`). Keep the upload key secure and use Play App Signing.
- From 2026-08-31, new mobile applications and updates must target Android 16/API level 36 or later. Because that deadline is imminent, the initial project should target API 36 rather than build against the expiring minimum.
- Request only permissions required by implemented functionality. Remove unused permissions brought in by plugins.
- Test runtime notification permission, file access, restore, background/foreground locking, process death, upgrade, uninstall/reinstall, and erasure on supported Android releases.

### Health Apps Declaration

Complete the Health Apps declaration for every relevant testing and production track. Declare at least:

> Health and fitness -> Period Tracking

Google defines this category to include tools for monitoring menstrual health, menstrual-cycle tracking, predictions, and fertility awareness. Do not declare fertility awareness, ovulation, medical-device, research, or other features unless they are actually implemented and legally intended.

For a non-regulated health application with health-related functionality, include a clear store-description disclaimer, for example:

> This app is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.

The disclaimer does not determine legal medical-device status; intended purpose and functionality do. Obtain a jurisdiction-specific review before public launch.

### Privacy Policy and Data Safety

- Provide an active, public, non-geofenced HTML privacy-policy URL and make the same policy reachable inside the app.
- Identify the app and legal entity, explain every access/collection/use/share path, and describe security, retention, export, and deletion behavior.
- Complete the Data Safety form for the application and all included SDKs.
- Google defines Data Safety collection as transmission off the user's device. On-device-only vault processing need not be declared as collection, but it must still be explained honestly in the privacy policy.
- Re-evaluate the answers if notification push, remote backup, analytics, crash reporting, customer-support uploads, WebView navigation, or any SDK transmits data.
- Do not claim all data is encrypted in transit unless that is true for every applicable transmission from the app and included SDKs.
- If account creation is ever added, implement accessible in-app and web account-deletion paths and delete the associated server data rather than merely disabling the account. The current no-account model avoids this requirement.
- Keep the current no-ads/no-tracking model for the first store release.

### Play Console Content and Listing

Complete and maintain:

- Health Apps declaration;
- Data Safety form;
- privacy policy;
- target-audience and content declaration;
- ads declaration;
- IARC content-rating questionnaire;
- app-access/reviewer instructions;
- permissions declarations if any controlled permission is introduced;
- category, contact details, store listing, screenshots, feature graphic, icon, and localized descriptions;
- country availability, pricing, and release track;
- export-control assessment for software containing encryption.

Choose the intended age groups deliberately. A first release targeting adults only reduces child-consent, Families Policy, and jurisdiction-specific minor-data complexity. If teenagers or children are included later, perform a dedicated legal, consent, content, and Google Families review rather than merely changing the store checkbox.

## Shared Clinical, Legal, and Privacy Gates

Before either public store submission:

- finalize the intended use and target population;
- obtain a medical-device classification assessment for every launch jurisdiction;
- complete the planned clinical review of neutral forecast and symptom language;
- add localized guidance for persistent unusual bleeding, very heavy/prolonged bleeding, bleeding between periods, severe symptoms, disruptive pain, and urgent or mental-health help;
- keep emergency resources country-aware rather than hard-coding one number;
- preserve the statement that the app is not contraception or an ovulation/pregnancy test;
- complete GDPR legal-basis/privacy-by-design analysis and a DPIA assessment for EU distribution;
- assess the US FTC Health Breach Notification Rule even if HIPAA does not apply;
- inventory all data flows, storage locations, logs, caches, native backups, network requests, SDKs, notification content, and support processes;
- run an independent security review against the final iOS and Android artifacts;
- define a vulnerability contact and patch/update process;
- document what happens when the PIN is forgotten and why no recovery bypass exists;
- ensure readable export remains explicitly warned and encrypted backup remains the safe default;
- never expose menstrual state in URLs, logs, analytics, crash reports, app previews, notification payloads, or lock-screen copy without separate explicit consent.

## Branding, Support, and Submission Assets

Required product work:

- clear the final product name in the intended trademark territories and both stores;
- replace the placeholder logo, splash, manifest identity, bundle display names, and icons together;
- register stable product, support, privacy, and security-contact domains/URLs;
- write localized App Store and Play listings that match actual functionality;
- create screenshots from release builds without real health information;
- use synthetic review/test data only;
- publish support instructions for backups, restore, PIN loss, erasure, device migration, accessibility, and known limitations;
- maintain a changelog and an incident/recall communication process.

## Suggested Reviewer Instructions

Provide precise steps in both stores' review notes:

1. Launch the app; no account or network connection is required.
2. Select English or German on the splash screen.
3. Complete or skip onboarding and explain that all fields are optional.
4. Add synthetic historical periods, open Calendar, and perform a daily check-in.
5. Open forecast reasoning and period-history correction.
6. Open Privacy and demonstrate optional PIN protection, auto-lock, encrypted backup, readable-export warning, and erasure.
7. State that records remain on-device, that PIN-disabled storage is not encrypted, and that a forgotten PIN cannot be recovered without erasing the vault.
8. State that estimates are derived from recorded history, express uncertainty, and are not medical, fertility, ovulation, pregnancy, or contraceptive guidance.
9. List every native permission and explain the precise user action that requests it.
10. Provide a contact who can answer health, privacy, encryption, and technical-review questions promptly.

Do not give reviewers an undocumented PIN or require access to a private server. If a future account or server feature is introduced, supply a stable, fully functional review account and keep the service available during review.

## Release Sequence

1. Continue the hosted PWA as the private usability pilot.
2. Finalize name, brand, intended use, adult/minor scope, clinical safety copy, privacy policy, support pages, and legal assessments.
3. Create organization developer accounts and complete identity/D-U-N-S verification.
4. Add Capacitor and native projects; implement/test native adapters without changing domain rules.
5. Complete native storage, iCloud exclusion, lifecycle privacy, backup compatibility, local notifications, and erasure tests.
6. Run automated browser tests plus native unit/integration tests on every release build.
7. Distribute through TestFlight and Google Play internal testing.
8. Conduct a closed real-device accessibility, clinical-language, privacy, security, and usability pilot.
9. Complete Google Play's required closed test if applicable.
10. Submit Google Play first, address policy/review findings, and then submit iOS.
11. Tag the exact source revision used for each PWA, iOS, and Android release and retain reproducible build records.
12. Re-check policy declarations whenever functionality, SDKs, data flow, permissions, age scope, claims, or target countries change.

## Primary Sources

### Packaging

- [Capacitor documentation](https://capacitorjs.com/docs)
- [Trusted Web Activity overview](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Trusted Web Activity quick start and Digital Asset Links](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Offline-first Trusted Web Activities](https://developer.chrome.com/docs/android/trusted-web-activity/offline-first)

### Apple

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Developer Program membership comparison](https://developer.apple.com/support/compare-memberships/)
- [Apple health and fitness app guidance](https://developer.apple.com/health-fitness/)
- [App Store Connect: manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Required App Store Connect properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties)
- [Required-reason API declarations](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- [Apple export-compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)
- [Apple encryption-documentation reference](https://developer.apple.com/help/app-store-connect/reference/export-compliance-documentation-for-encryption/)

### Google Play

- [Play Console registration](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Google Play developer account types](https://support.google.com/googleplay/android-developer/answer/13634885)
- [Testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Create and set up a Play application](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-IN)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Health Apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291)
- [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511)
- [Data Safety form guidance](https://support.google.com/googleplay/android-developer/answer/10787469)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Content rating requirements](https://support.google.com/googleplay/android-developer/answer/9859655)
- [Google Play export-compliance overview](https://support.google.com/googleplay/android-developer/answer/113770)
