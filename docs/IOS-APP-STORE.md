# FuelTill native iOS build and App Store release

FuelTill can be packaged as an iOS application using Capacitor 8. This repository contains an automated **unsigned iOS Simulator** build in `.github/workflows/ios-simulator.yml`. It compiles the native project on a macOS GitHub runner and uploads a simulator ZIP. **A simulator build cannot be installed on a physical iPhone, submitted to App Store Connect, or shared as a TestFlight app.**

## Steps to build without App Store membership
- On the GitHub repository, open Actions → **Build FuelTill iOS simulator (development)** → Run workflow.
- A passing workflow uploads `FuelTill-iOS-Simulator-Test`. This artifact is intended for Xcode Simulator (a Mac); it is not an iPhone .ipa.
- If you have access to a Mac with Xcode 26+, you can also install Node 22, run `npm ci`, `npm run build -- --base=./`, `npm install @capacitor/core@8 @capacitor/cli@8 @capacitor/ios@8`, `npx cap add ios`, `npx cap sync ios`, `npx cap open ios`.
- Apple may allow testing a development-signed build directly on your own iPhone through Xcode with a free Apple account; provisioning limitations apply.

## To distribute on the App Store
- Enroll in the Apple Developer Program (typically US$99 annually, local pricing varies).
- Verify the developer's legal identity, app rights, name/bundle identifier and organization status.
- Configure Apple distribution signing, provisioning profiles and a Mac/Xcode 26+ (or approved macOS signing build service).
- Create the App Store Connect app record, privacy policy and data practices, age rating, screenshots, app description, support contact, and a review test account if authentication is required.
- Produce a signed release archive/.ipa, upload to App Store Connect, run TestFlight/device testing, and submit for App Review. Apple reviews and approves distribution; deployment is not automatic.
- Verify the native print/share functionality, login redirects, account deletion requirements, permissions, offline data handling and receipt exports on a physical iPhone.

## Critical current blockers
- The public GitHub Pages web demo is not a production multi-company financial backend.
- Cloud Functions version of company invitations and ledger is not deployed; the free Spark plan cannot run it unchanged.
- The login-first branch is still pending rollout and authentication testing.
- Do not represent this unsigned simulator test app as an App Store binary or use it for actual cash accounting.
