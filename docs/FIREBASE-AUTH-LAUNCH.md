# FuelTill login-first Firebase rollout (staging checklist)

**IMPORTANT:** Do not merge this branch until the Firebase web app settings are configured, the Firebase Cloud Functions and Firestore rules are deployed, and company/station isolation has been tested. The login gate intentionally blocks use when Firebase is not configured. GitHub Pages serves static React assets, **not** Firebase Functions.

## Identity model

- **Every person has their own Firebase Authentication account.** Do not create a single shared company password.
- **Company owner:** choose Company owner during signup, verify email, then use Business Cloud → Create business. This creates an **unverified** organization: an email address alone does NOT prove ownership of an existing legal business.
- **Employee:** create a personal account, verify email, obtain a private 48-hour single-use invitation from the owner/manager, then Business Cloud → Join using invite.
- Server functions enforce membership, role and station assignment on every cash action. Existing backend endpoints, invitations and audit records must be reviewed and tested with Firebase emulators and separate tenant accounts before use.

## 1. Create Firebase project

1. Visit https://console.firebase.google.com and create a **new FuelTill staging project** under an account you control. Choose a billing plan suitable for Cloud Functions if required; review potential costs.
2. Firebase Console → **Project settings → Your apps → Add app → Web**. Register `FuelTill Web`. Copy the SDK config: `apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`.
3. **Build → Authentication → Get started → Sign-in method → Email/Password**: enable email/password, configure and test verification and password reset messages.
4. **Authentication → Settings → Authorized domains**: authorize `imrush1v.github.io` for the GitHub Pages site and any testing domains. Do not add unrelated origins.
5. **Build → Firestore Database**: create a database in an appropriate region with production rules, not open test rules. Review NZ privacy obligations and data residency.
6. In Firebase/Google Cloud console, configure billing, IAM and audit logging. Do not put admin keys or service-account JSON in GitHub, frontend code or GitHub Actions variables.
7. Review production App Check setup and enforced verification, MFA requirements for managers/owners, abuse prevention, tenant isolation, data retention, and incident recovery before real financial data is handled.

## 2. Firebase server deployment (must be done by project administrator)

Install dependencies and Firebase CLI on your trusted computer:

```powershell
npm install
npm --prefix functions install
npm install -g firebase-tools
firebase login
firebase use --add
firebase emulators:start --only auth,firestore,functions
```

From project root run all tests and inspect security rules and emulator tests:

```powershell
npm test
npm run build
```

After verifying rules and endpoint access in staging, deploy **only to your intended Firebase staging project**:

```powershell
firebase deploy --only firestore,functions --project YOUR_STAGING_PROJECT_ID
```

Consult `docs/CLOUD-SETUP.md` for security controls and further rollout details. No Firebase project has been created or deployed by this GitHub PR.

## 3. Configure GitHub Actions web build

Open repository **Settings → Secrets and variables → Actions → Variables** and add these GitHub **repository variables** using the Firebase Web SDK config you copied:

| Name | Value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_FUNCTIONS_REGION` | Region of deployed functions e.g. `australia-southeast1` |

Firebase **Web SDK configuration identifiers are public identifiers**, not admin secrets. Still don't share admin credentials, passwords, invitation codes or private keys. App Check `VITE_FIREBASE_RECAPTCHA_SITE_KEY` can be added after the protection has been configured and tested.

The deployment workflow embeds these values at build time. Changing repository variables requires a new website deployment. GitHub Pages is not the backend.

## 4. Review before merging

- Build and tests pass on the feature branch.
- Login page displays for signed-out browsers on desktop and mobile.
- Company-owner onboarding and employee invitation onboarding work in staging.
- A user assigned to station A cannot access station B or company B by changing request parameters.
- Email verification is required by callable backend functions.
- Safe Drop, End of Shift and End of Day save/read exactly once, including reload and device handover.
- Receipt printing works with your actual thermal printer.
- Company claims are verified independently before a business name receives a trusted/verified status.
- Explicitly assess whether local demo finance records should exist at all once cloud login is enforced. The existing local pages continue to say DEMO and are not authoritative cloud records.

When the above pass, merge the PR and deploy to the public test URL. **Do not use the login-first site as a production financial system before security evaluation and company onboarding controls are complete.**
