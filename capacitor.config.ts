import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.winatour.app',
  appName: 'WINA TOUR',
  webDir: 'dist',
  // Android auth stability: keep a secure https WebView origin, but avoid
  // optional native plugins/deep-link bridges while diagnosing WebView freezes.
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
};

export default config;
