# Trade FX Mobile App

Native React Native wrapper for the Trade FX web app. It opens the full Trade FX website inside a fullscreen WebView, without browser address bar or browser UI.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Set your live HTTPS website URL:

```bash
EXPO_PUBLIC_TRADEFX_URL=https://your-tradefx-domain.com
```

For Android emulator local testing, use:

```bash
EXPO_PUBLIC_TRADEFX_URL=http://10.0.2.2:3000
```

For real phone testing, use a live HTTPS URL or a tunnel URL.

## Run

```bash
npm run start
```

Android:

```bash
npm run android
```

iOS:

```bash
npm run ios
```

## Build APK

```bash
npx eas-cli build --platform android --profile preview
```

## Build Play Store AAB

```bash
npx eas-cli build --platform android --profile production
```

## Notes

- The app shows Trade FX fullscreen in a WebView.
- Android back button goes back inside the WebView.
- External links open outside the app.
- Offline state shows a native no-internet banner.
- The web app should be hosted on HTTPS for production.
