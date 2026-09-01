# My Perfect Days

![My Perfect Days app icon](public/icons/app-icon-192.png)

My Perfect Days is a private, mobile-first menstrual journal. It records bleeding and daily observations, presents personal cycle estimates with visible uncertainty, and works as an installable offline PWA.

> **Development preview — version 0.2.0.** The app is not a medical device, contraceptive tool, ovulation test, pregnancy test, or substitute for professional medical advice.

## Highlights

- Calendar-first mobile interface with smooth continuous month scrolling.
- Fast daily check-ins for bleeding intensity, energy, confidence, tension, pain, and private notes.
- Recorded periods, estimated future period days, and an optional pre-period window remain visually distinct.
- Period history editing and review of potentially inconsistent records.
- Estimates derived from completed recorded cycles when enough history exists, with optional starting estimates used only as a fallback.
- English, German, and Russian interfaces with device-language detection.
- Light and dark themes, keyboard support, reduced-motion behavior, and non-color marker semantics.
- Installable offline application shell with local IndexedDB persistence.
- Optional six-digit PIN protection, encrypted backup and restore, and explicitly warned readable export.

## Privacy model

The application is local-first and currently has no account, backend, advertising, analytics, hosted fonts, or tracking SDKs. Journal data is not sent over the network and is not placed in URLs, application caches, or browser logs.

PIN protection is optional:

- with a PIN, the journal is encrypted locally using Web Crypto;
- without a PIN, the journal remains only on the device but is not encrypted at the application layer;
- a forgotten PIN cannot be recovered—regaining access requires erasing the inaccessible local journal;
- downloaded backup and export files are outside the app and must be stored safely.

## Estimates, not promises

Cycle estimates are derived from the user's own completed recorded periods once enough usable history exists. Optional starting estimates can provide an early fallback. Results are displayed as uncertain personal estimates, not biological certainties. The application does not predict fertility or future “good” days and does not advise the user to avoid decisions, work, or relationships because of a cycle phase.

Cycle checks can flag records that may need review, but never silently rewrite journal data or diagnose a health condition.

## Run locally

Requirements:

- Node.js 24 or newer
- npm 11 or newer

Install dependencies and start the development server:

```powershell
npm.cmd ci
npm.cmd run dev
```

On macOS or Linux, use `npm` instead of `npm.cmd`.

Create and preview the production PWA build:

```powershell
npm.cmd run build
npm.cmd run preview
```

Open the local URL printed by Vite. Use the production preview—not the development server—when testing installation, service-worker control, or offline reload.

## Quality checks

```powershell
npm.cmd run verify
npm.cmd run test:e2e
```

`verify` checks formatting, linting, unit/component tests, the production build, and generated PWA artifacts. The end-to-end command runs the Playwright browser suite.

Useful individual commands:

| Command | Purpose |
| --- | --- |
| `npm.cmd test` | Run unit and component tests |
| `npm.cmd run test:watch` | Run Vitest in watch mode |
| `npm.cmd run typecheck` | Check strict TypeScript types |
| `npm.cmd run lint` | Run ESLint |
| `npm.cmd run format:check` | Check formatting |
| `npm.cmd run test:e2e:ui` | Open Playwright's interactive runner |

## Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) — detailed product specification, architecture, security design, data model, engineering decisions, roadmap, and acceptance criteria.
- [DISTRIBUTION.md](DISTRIBUTION.md) — Cloudflare/PWA deployment guidance and future App Store and Play Store planning.

## Current status

The secure local core, onboarding, calendar and check-in flows, period history, cycle estimates, initial cycle-data review rules, localization, encrypted backup/restore, and PWA shell are implemented. Work still open before a public beta includes real-device and assistive-technology validation, clinical and legal review, independent security review, final branding, and evidence-based forecast calibration.

The working product name is **My Perfect Days**; final trademark and store-name clearance remains pending.
