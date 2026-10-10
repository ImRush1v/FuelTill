# FuelTill v1.1 — Connect real Firebase Business Cloud

**Status:** Implemented project source and callable endpoints; NOT deployed or security-audited. The public client must not be treated as a real cash-accounting system until a station pilot and independent verification pass.

## Requirements
- Node.js 22+ and npm, an organization-owned Firebase/Google Cloud project, and an authorized Google account.
- Firebase Authentication, Firestore, Cloud Functions, and Hosting enabled. Cloud Functions may require billing. Keep administrative credentials in Google IAM/secret management, never in `VITE_*` values.
- HTTPS hosting for full PWA/browser features and mobile printing.

## Set up
1. In Firebase Console create a project owned by your business. Add a Web app to the project, copy its Web SDK configuration.
2. Enable Authentication → Sign-in method → Email/Password, and set authorized domains. Configure email verification delivery. Use robust password and abuse prevention policies.
3. Create Firestore in a suitable region, review location/data residency, enable any necessary billing, and configure backup/restore policy.
4. Install Firebase CLI (`npm install -g firebase-tools`), sign in (`firebase login`) and point the project to your project ID with `firebase use --add`.
5. Copy `.env.example` to `.env.local`. Populate `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, and if available `VITE_FIREBASE_MESSAGING_SENDER_ID`. These are **public web app identifiers**. Never add service account JSON or secrets to your React app.
6. Install root dependencies (`npm install`), then server dependencies (`cd functions && npm install && cd ..`).
7. Before deployment, configure App Check using a supported provider, set `VITE_FIREBASE_RECAPTCHA_SITE_KEY`, then change the callable endpoint options from `enforceAppCheck:false` to `true` in `functions/index.js` once clients are ready. Test with a staging project first. Enable multi-factor authentication for privileged staff using Firebase Identity Platform features applicable to your plan.
8. Use a staging project: `firebase emulators:start --only auth,firestore,functions` for integration tests, then deploy security rules and callable functions to staging: `firebase deploy --only firestore,functions`.
9. Run `npm test`, `cd functions && npm test`, `npm run build` and test in Safari iOS, Android Chrome, and desktop with the actual printers. Only after permission and sign-off, deploy staging Hosting: `firebase deploy --only hosting`.
10. Deploy to a separately configured production project only after passing the independent security and cash tests below.

## How company access works
- Anyone can use the **local demo calculator** without login; no backend financial trust is conferred.
- A business owner registers and verifies their email, then creates a company workspace and initial station in **Business Cloud**. This verifies the email **not legal company ownership**. The company is marked `verificationStatus: unverified` until business affiliation is checked outside this project.
- Owner or approved manager adds stations and generates a **48-hour, single-use** employee invitation for an **exact verified email**. Cashiers and supervisors are restricted to explicitly assigned stations. Managers and owners may work across that company's stations.
- Employee signs in on any supported device, verifies their email and redeems the private invite code. Merely knowing a company name never grants entry.
- Server-callable APIs check authenticated identity, company membership, station permissions, cash policy and record version. Firestore rules deny client writes entirely; the server alone handles count changes, safe drops and shift closings.
- Safe drops use a request ID and optimistic revision checks; closing a shift is one-time. Cash events are recorded on the backend and do not count twice in daily totals. Managers can list employees and revoke access.
- Store names, organization IDs and workspace invitations only in appropriate authorized channels. Do not publish invite codes or screenshot private financial details.

## Supported client features
- Connect/create business, create/join station via invitation, sign in, sign out, email verification, password reset.
- Cashier counts and saves exact banknotes and coins with conflict detection; separately records safe drops and shift closings; can download/print each saved receipt.
- End of Day aggregates server-backed saved cash movements for the selected station/date.
- Managers add stations, configure cash policy/print format, invite and revoke employees.

## Printing on iPhone, Android, Windows and macOS
- Every Safe Drop and End of Shift **recorded receipt** has its own `Download PDF`, `Print on PC / Phone`, and `Phone Share / Print` actions.
- Android: enable a supported system Print Service, pair/connect to the printer, and choose Print from Chrome or the shared PDF.
- iPhone: select Phone Share / Print, then the system Print option or share the PDF to an application that supports the printer. AirPrint printers normally need the phone and printer on the same network.
- Desktop: choose Print and the installed printer. Select 58 mm, 80 mm or A4 to match your printer's installed paper profile.
- **Browsers cannot silently print directly to arbitrary USB/Bluetooth ESC/POS receipt printers.** For unattended one-tap thermal printing, create an approved native application or install a trusted local bridge compatible with each model. No local printer bridge is bundled; the OS print picker is the currently supported route.
- Printed width and cutting depend on the thermal printer driver. Test margins and paper-feed/cutting with real hardware.

## Security release blockers
- Independent tests on Firestore rules, callable endpoints, tenant isolation, role escalation, invitation abuse, multi-device concurrency, cash totals and server event idempotency.
- Manager MFA (not merely email/password) and production App Check enforcement, suspicious-activity monitoring and rate limiting.
- Legal verification of businesses / operator authority to use or name each station; audit of data-retention policy and lawful employee data handling.
- Verified cloud backups, restore drills, disaster recovery, correction/reversal authorization, and historical report signing.
- Accurate POS expected-cash ingestion, variance resolution, handling of a physical safe deposit that does not match reported value, physical sign-off and manager approvals.
- Real printer acceptance testing for supported iPhone/Android/desktop hardware.
- Public terms, NZ Privacy Act 2020 compliance review, regulatory/legal advice for target regions, support escalation and incident response.
- Staged deployment under a real business-owned domain and owner-approved funding/hosting accounts.

Do not rely on this beta as the sole official station ledger. Operate in parallel with the station's approved reconciliation process until a qualified review and authorized pilot sign-off are completed.
