import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Garimpo Madruga',
  slug: 'garimpo-madruga',
  scheme: 'garimpo',
  version: '0.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.garimpomadruga.app',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        'A câmera é usada para fotografar as peças durante o legit check.',
    },
  },
  android: {
    package: 'com.garimpomadruga.app',
    edgeToEdgeEnabled: true,
    permissions: ['android.permission.CAMERA'],
  },
  plugins: ['expo-router', 'expo-apple-authentication', 'expo-web-browser'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      // projectId é definido ao rodar `eas init` com a conta da empresa
    },
  },
});
