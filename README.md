# FuelTill v1.1 — Phone, PC, Receipts & Multi-Company Cloud Beta

**FuelTill is a mobile-friendly React + TypeScript cash-handling application.** The working local demonstration includes six cash-management workspaces. v1.1 adds a seventh **Business Cloud** area with **optional** Firebase email authentication and server-authorized company/station membership.

> **IMPORTANT:** This source package is not deployed or independently certified. Without your Firebase config, Business Cloud displays setup instructions instead of fake accounts. Local demo data stays on that browser. Do not use the beta as a sole official financial record.

## Start on a computer

Install Node.js 22+, then in this project folder:

```bash
npm install
npm test
npm run dev
```

Vite will print the address, normally `http://localhost:5173`. For an installable PWA, run a production build and publish to HTTPS hosting. To preview locally: `npm run build && npm run preview`.

## Phone and PC app
- **Phone:** after deploying over HTTPS, open FuelTill in Safari (iPhone) or Chrome (Android). Use Add to Home Screen / Install App. The PWA is a responsive web application, not an App Store/Play Store binary.
- **PC:** open in Chrome/Edge/Safari on desktop; supported browsers can offer Install App.
- An application shell service worker supports some offline loading after installation, but **Business Cloud cash transactions require a live connection**. No offline financial write queue exists.

## Downloads and printer support

| Page | Download | Print |
| --- | --- | --- |
| Safe Drop | **Separate Safe Drop PDF**, HTML; also individual saved-drop history receipts | Browser/native print + phone share/print |
| End of Shift | **Separate End of Shift PDF**, CSV and HTML, includes the exact final drawer quantities | Browser/native print + phone share/print |
| End of Day | Separate End of Day PDF, HTML and generic printable A4 station worksheet | Browser/native print + phone share/print |

Set receipt width to **58 mm**, **80 mm** or **A4** in Settings (local) or in the Business Cloud receipt selector. Mobile printing uses Android's installed Print Service or iPhone's system share/AirPrint features. Real thermal printers must support the chosen path. Silent/raw ESC/POS printing over an arbitrary local network is **not supported** in an ordinary website.

## Multi-company, multi-station accounts

Source for the Firebase backend is included under `functions/`. The connected workflow supports:

1. Owner verifies an email and creates an organization and first station.
2. Owner/manager invites a specified verified email to one or more approved stations (single-use, 48-hour code).
3. Cashier signs in on another phone or PC, accepts the invitation and sees only assigned locations.
4. All recorded cloud cash counts, safe drops, locked shifts and end-of-day figures are processed using server-authorized callable endpoints.
5. Managers can add stations, change cash policies, invite/revoke access and review staff membership.

**Cloud accounts are unavailable until a Firebase project is configured and its functions/rules deployed.** Full setup and pre-release checks are in [docs/CLOUD-SETUP.md](docs/CLOUD-SETUP.md). This does not prove an organization legally owns a claimed fuel company, and is not intended to imply any relationship with Caltex or a specific fuel brand.

## Current features
- Overview, Safe Drop, End of Shift, End of Day, My Profile, Settings, **Business Cloud**.
- Integer-cent denomination engine; large cash drops, actual note-removal plans, carry-forward tolerance, exact remaining coins/notes.
- Configurable safe-drop range and station target.
- Two distinct receipts — Safe Drop and End of Shift — plus a separate daily report; download direct PDF without using Print to PDF.
- Save the verified physical denomination count to cloud (when configured); server-issued revision prevents stale devices silently overwriting another cashier's count.
- One-time cloud shift closings and recorded safe-deposit events. Source includes restrictive Firestore rules and an event audit trail.
- Local JSON export/import for demo data only (not encrypted); cloud records are **not** stored in this local backup.

## Tests

```bash
npm test             # React tests + Firebase backend cash tests
npm run test:frontend  # Only React/TypeScript tests
npm run test:backend   # Only Firebase cash tests
npm run build
```

The backend cash-engine Node tests can be run without any Firebase credentials. Cloud integration, Firestore Rules emulator, printer hardware and complete deployed application tests still need to be executed before a live launch.

## Design limitations
- Financial data from local Demo mode is **not** automatically copied into a cloud company. Enter and save separate counts in Business Cloud.
- Cloud mode does not yet offer offline writes, refunds/corrections approval, POS integration, automatic bank reconciliation or signed/verified PDF content.
- Email/password plus verification and station-specific membership are a foundation, **not foolproof authentication**. Enforce MFA for privileged users and App Check before launching.
- Server-level company affiliation proof, abuse controls, production incident response, backups, billing, real printer compatibility and legal review remain explicit launch requirements.

See [docs/CLOUD-SETUP.md](docs/CLOUD-SETUP.md) and [docs/PRODUCTION-PLAN.md](docs/PRODUCTION-PLAN.md).
