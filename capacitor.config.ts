import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Keep this identifier stable once APKs have been distributed.
  appId: 'app.myperfectdays.journal',
  appName: 'My Perfect Days',
  webDir: 'dist-android',
  server: { hostname: 'localhost', androidScheme: 'https' },
  plugins: { LocalNotifications: { smallIcon: 'ic_stat_reminder', iconColor: '#087b80' } },
};

export default config;
