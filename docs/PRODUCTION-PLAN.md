# FuelTill — roadmap from working demo to live businesses

## What works in v1.0 pilot demo
- React + TypeScript application with Overview, Safe Drop, End of Shift, End of Day, Profile and Settings.
- Actual denomination counting (NZD cents), configurable drawer targets, tolerances and safe-drop range.
- Safe drops of available notes, deducted exactly once from one register's drawer.
- Individual draft drawer counts isolated by station, register, date and shift.
- One-time shift closing locked in the UI; recorded snapshot includes removed and retained quantities.
- End-of-day cash movement report scoped to one station and date.
- Separate receipts as direct PDFs (58mm, 80mm, A4), HTML and A4 worksheet in generic station format.
- Browser-local persistence, manual JSON backup export (the exported files are **NOT** encrypted).
- Tests for money, isolation, safe drops, locking, dates and PDF format.

## Not complete / not suitable for actual businesses yet
1. Firebase Authentication and authorized business invitations.
2. Backend multi-tenant membership and server-side permissions; selecting "Business owner" in demo must not grant privileges.
3. Database-backed transaction ledger; append-only cash events via authenticated server transactions.
4. Signed/authoritative shift closings, managerial approvals and correction/reversal workflow with immutable audit trail.
5. Proper data backups and restoration, retention policies, privacy disclosure, data access requests.
6. Protection against concurrent writers, idempotency keys and offline queue conflict reconciliation.
7. Real receipt printer compatibility, 58mm/80mm page sizing, cash-drawer operational acceptance testing.
8. Cash discrepancies, POS expected transactions and bank deposit verification with bank audit support.
9. Legal/privacy review, staff permission to pilot, business terms, incident response and reliability monitoring.
10. Deployment to a domain controlled by the owner and secret management. A ZIP alone is not a publicly hosted service.

## Proposed production data model
organizations/{orgId} — legal entity and owners (server managed)
organizations/{orgId}/members/{userId} — approved role, assigned station IDs (trusted invitation flow)
organizations/{orgId}/stations/{stationId} — currency, register IDs, cash policy, timezone
organizations/{orgId}/shifts/{shiftId} — open/closed, operator, station/register/date, expected POS count
organizations/{orgId}/safeDrops/{eventId} — immutable event ID, type, exact note quantities, cents, register, cashier, timestamp, shift ID
organizations/{orgId}/audit/{eventId} — server-generated audit trail, correction links, transaction request IDs

Every write must be authorized server-side. Use immutable transaction IDs and Firestore transactions to avoid double submission; compute cents on the server and verify available denominations. The client cannot be allowed to create arbitrary membership or change audit entries. Assign roles with a trusted administrative flow; do not trust a role selected in the browser.

The included `firebase/firestore.rules` intentionally **deny all client writes** to financial data. This is a secure starting default, not a working cloud backend. Before enabling cloud mode, build and test callable Cloud Functions, identity verification, App Check, membership provisioning, migration and Firestore emulator tests. Admin SDK server permissions rely on IAM and are not restricted by Firestore rules.

## Release gates
- `npm test` and `npm run build` pass in a clean environment.
- Unit tests include brute-force comparison against drop algorithm for random small cash counts.
- Firebase Auth rules/emulator tests for same-business access and cross-business denial.
- Repeated requests for one safe drop must create only one immutable event.
- Shift lock and correction/audit trails tested under concurrent devices.
- Printable receipts tested on physical 58mm and 80mm printers and A4; saved PDF visually checked.
- Written permission for one station to run a **parallel** pilot: keep existing paper/official POS process.
- Business backup, support escalation, privacy policy and incident response are operating.

## Responsible rollout
Stage 1: public no-login calculator only (no real records, local demo disclaimers).
Stage 2: trusted single-business pilot with authenticated server ledger.
Stage 3: multiple invited organizations and support processes.
Stage 4: paid business analytics (optional; validate value first).
