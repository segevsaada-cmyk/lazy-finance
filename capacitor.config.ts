import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lazyfinance.fit',
  appName: 'Lazy Finance',
  webDir: 'dist',
  // Personal app — the native shell loads the live deployment so updates are
  // automatic (no rebuild/resubmit per change). All login + /api calls stay
  // same-origin against the Vercel app.
  server: {
    url: 'https://lazy-finance-segevsaada-cmyks-projects.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
