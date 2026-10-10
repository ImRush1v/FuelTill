# FuelTill native mobile application — development plan

FuelTill is **not just a shortcut** in this branch: Capacitor can package the React/TypeScript code as an Android application (APK) and an iOS app (Xcode project). The PC version remains the existing web app. Capacitor renders the application UI in an embedded native WebView; native integrations may require plugins.

## Android: install a test APK at no app-store cost
GitHub Actions has a manually triggered workflow **Build Android APK (development only)** in `.github/workflows/android-debug.yml`. It uses Node 22, Java 21 and the Android SDK to create a **debug APK**.

1. Merge this branch after code review, or run the workflow on this feature branch using GitHub Actions → Build Android APK → Run workflow → select `feature/native-android-ios`.
2. After a successful run, download the `FuelTill-Android-Debug-APK` artifact from the workflow run and extract the ZIP.
3. Transfer `app-debug.apk` to a trusted Android phone and install for personal testing. Android may ask for permission to install from this source. Keep this permission off when not needed.
4. Test startup, app navigation, date input, PDF generation, native share/print, permission prompts, login, and airplane-mode behavior.

**Warning:** Debug APKs are for personal testing, not general public distribution. They may be signed with a debug key; a public release requires a secure release signing key, signed AAB/APK, store policies, privacy docs and testing. Never upload release signing keys into a public GitHub repo.

## Reproduce locally on Windows for Android

```powershell
npm install
npm test
npm install @capacitor/core@8 @capacitor/android@8
npm install -D @capacitor/cli@8
npm run build -- --base=./
npx cap add android
npx cap sync android
npx cap open android
```

Android Studio 2025.2.1+ and Android SDK are required. Build/run from Android Studio. After changing React code, repeat `npm run build -- --base=./` and `npx cap sync android`.

## iOS (requires a Mac)

```bash
npm install
npm install @capacitor/core@8 @capacitor/ios@8
npm install -D @capacitor/cli@8
npm run build -- --base=./
npx cap add ios
npx cap sync ios
npx cap open ios
```

Install compatible Xcode and configure Apple signing. You can test on your own iPhone with a free Apple account via Xcode when eligible, but distribution to other users through TestFlight/App Store normally requires Apple Developer Program membership and review.

## Firebase and cash security

- The main website currently runs a local demonstration. The separate login-first branch has not been merged; the existing company cash backend depends on Cloud Functions. Native packaging alone does **not** make that backend functional on the Spark plan.
- An actual business release must have authenticated storage, tenant isolation, server-verified approvals, audit trails and recovery tests.
- Native Google Sign-In / OAuth and Firebase authorized domains may require platform-specific configuration (Android SHA certificate fingerprints, iOS URL schemes, redirect handling). The current web email/password authentication has not yet been tested in Android/iOS builds.
- The current PDF/print browser code may need Capacitor Share/Filesystem/Printing plugins. Do not assume that a thermal receipt printer works directly from Android WebView or iOS WKWebView.
- Do **not** use the debug APK to record real station money. No production financial-accounting safety review has been completed.

## What the deliverable is

This pull request adds a working configuration and a CI build **recipe**, but does not claim a completed APK until the GitHub workflow actually succeeds and its artifact is downloaded and tested. It keeps the deployed website unchanged.
