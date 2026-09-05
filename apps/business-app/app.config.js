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
      eas: {
        projectId: 'REPLACE_WITH_EAS_PROJECT_ID',
      },
    },
    plugins: [
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
