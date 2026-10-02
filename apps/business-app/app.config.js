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
      versionCode: 3,
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
      apiBaseUrl: process.env.API_BASE_URL ?? 'https://sptcfinance.duckdns.org',
      // Firebase project "sptc-finance-platform" - shared Web OAuth client used by
      // @react-native-google-signin/google-signin to obtain a Google ID token.
      googleWebClientId:
        process.env.GOOGLE_WEB_CLIENT_ID ?? '780616935214-sbtmvn04cj27r6evcckipgmlvfvietc2.apps.googleusercontent.com',
      eas: {
        projectId: 'a3917f9d-813c-47eb-967c-5139009df5b5',
      },
    },
    plugins: [
      'expo-asset',
      '@react-native-google-signin/google-signin',
      [
        'expo-notifications',
        {
          // Must be a white silhouette on a transparent background - Android
          // draws the status-bar icon by masking this to solid white and
          // ignores any color info, so the full-color app icon (used here
          // before) rendered as an opaque dark square instead of a mark.
          icon: './assets/notification-icon.png',
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
