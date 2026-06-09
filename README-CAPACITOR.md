# Capacitor Mobile Setup

This project uses **Capacitor** to build native iOS and Android apps from the TanStack Start web application.

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Web App
```bash
npm run build
```

### 3. Add Android Platform
```bash
npm run cap:add:android
```

### 4. Add iOS Platform
```bash
npm run cap:add:ios
```

### 5. Sync Web Assets
```bash
npm run cap:sync
```

### 6. Open Android Studio
```bash
npm run cap:open:android
```

### 7. Open Xcode (macOS only)
```bash
npm run cap:open:ios
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run cap:init` | Initialize Capacitor in the project |
| `npm run cap:add:android` | Add Android platform |
| `npm run cap:add:ios` | Add iOS platform |
| `npm run cap:sync` | Sync web assets to native platforms |
| `npm run cap:open:android` | Open Android project in Android Studio |
| `npm run cap:open:ios` | Open iOS project in Xcode |
| `npm run cap:build` | Build web app and sync with Capacitor |

## Project Info

- **App ID:** `com.tourwina.transportwina`
- **App Name:** WINA TOUR
- **Web Directory:** `dist` (Vite build output)

## Workflow

1. Make changes to your React/TypeScript code
2. Run `npm run cap:build` to build and sync everything
3. Build and test in Android Studio or Xcode
