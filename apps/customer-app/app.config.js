module.exports = {
  expo: {
    name: 'SPTC Finance',
    slug: 'sptc-finance-customer',
    scheme: 'sptcfinance',
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
      package: 'com.sptcfinance.customer',
      versionCode: 2,
      googleServicesFile: './android/app/google-services.json',
      permissions: [
        'USE_BIOMETRIC',
        'USE_FINGERPRINT',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#2C3FE0',
      },
    },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL ?? 'http://10.0.2.2:3000',
      // Firebase project "sptc-finance-platform" - shared Web OAuth client used by
      // @react-native-google-signin/google-signin to obtain a Google ID token.
      googleWebClientId:
        process.env.GOOGLE_WEB_CLIENT_ID ?? '780616935214-sbtmvn04cj27r6evcckipgmlvfvietc2.apps.googleusercontent.com',
      eas: {
        projectId: '91722e95-b7ff-4cfa-b214-0181895da18d',
      },
    },
    plugins: [
      'expo-asset',
      '@react-native-google-signin/google-signin',
      'expo-image-picker',
      'expo-local-authentication',
      [
        'expo-notifications',
        {
          // Must be a white silhouette on a transparent background - Android
          // draws the status-bar icon by masking this to solid white and
          // ignores any color info, so the full-color app icon (used here
          // before) rendered as an opaque dark square instead of a mark.
          icon: './assets/notification-icon.png',
          color: '#2C3FE0',
        },
      ],
      'expo-secure-store',
    ],
  },
};
