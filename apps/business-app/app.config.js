module.exports = {
  expo: {
    name: 'SPTC Finance Business',
    slug: 'sptc-finance-business',
    scheme: 'sptcfinancebiz',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0B1F3A',
    },
    assetBundlePatterns: ['**/*'],
    android: {
      package: 'com.sptcfinance.business',
      versionCode: 1,
      googleServicesFile: './android/app/google-services.json',
      permissions: [
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B1F3A',
      },
    },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL ?? 'http://10.0.2.2:3000',
      // Firebase project "sptc-finance-platform" - shared Web OAuth client used by
      // @react-native-google-signin/google-signin to obtain a Google ID token.
      googleWebClientId:
        process.env.GOOGLE_WEB_CLIENT_ID ?? '780616935214-sbtmvn04cj27r6evcckipgmlvfvietc2.apps.googleusercontent.com',
      eas: {
        projectId: 'REPLACE_WITH_EAS_PROJECT_ID',
      },
    },
    plugins: [
      '@react-native-google-signin/google-signin',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#0B1F3A',
        },
      ],
      'expo-secure-store',
      [
        'expo-local-authentication',
        {
          faceIDPermission: 'Allow $(PRODUCT_NAME) to use Face ID for biometric authentication.',
        },
      ],
    ],
  },
};
