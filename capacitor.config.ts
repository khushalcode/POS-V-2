import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thuso.pos',
  appName: 'Thuso',
  webDir: 'out',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;