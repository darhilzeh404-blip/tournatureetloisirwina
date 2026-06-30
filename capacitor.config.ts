import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.winatour.app',
  appName: 'WINA TOUR',
  webDir: 'dist',
  // CRITICAL: utilise le schéma https sur Android, sinon les requêtes
  // Supabase (auth/storage) sont traitées comme "mixed content" / origine
  // non sécurisée et certaines API (localStorage, fetch POST) se figent.
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
};

export default config;
