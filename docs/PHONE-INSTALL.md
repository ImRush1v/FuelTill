# Install FuelTill on a phone or computer

FuelTill is a Progressive Web App (PWA) hosted at https://imrush1v.github.io/FuelTill/ .

## iPhone / iPad
1. Open the website in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen** and **Add**. If displayed, enable **Open as Web App**.
4. Open FuelTill using the Home Screen icon.

## Android
1. Open the website in Chrome.
2. Open browser menu.
3. Choose **Install app** (or **Add to Home screen**, depending on device/browser).
4. Open the installed FuelTill icon.

## Windows / macOS
Open the URL in Edge or Chrome. Use the browser's Install site/app option where available.

## Deployment and limitations
- The GitHub Pages Vite build uses `--base=/FuelTill/`.
- `manifest.webmanifest` start URL, scope, and icons are relative to the deployed site; service worker registers at `/FuelTill/sw.js`.
- The service worker caches the static demo shell, not live Firebase or financial API data. Network and browser/device constraints may limit offline access.
- Browser installation is not App Store/Play Store publication.
- The current public release is a local demo; records should not be used as official station accounting.
- Firebase login-first is in a separate PR and must not be merged until the free-plan auth/store migration and security review are complete.
- Test the home-screen launch, print/share dialog, receipts, reload and updates on actual devices before distributing as operational software.
