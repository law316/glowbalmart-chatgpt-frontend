import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glowbalmart.crm',
  appName: 'Glowbalmart CRM',
  webDir: 'www',
  server: {
    url: 'https://glowbalmart-crm-bfc40c99.vercel.app',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#ffffff',
      style: 'LIGHT',
    },
  },
};

export default config;