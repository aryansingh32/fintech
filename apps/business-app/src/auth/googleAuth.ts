import Constants from 'expo-constants';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId, offlineAccess: false });
  configured = true;
}

/** Returns a Google ID token for the signed-in account, or null if the user cancelled. */
export async function signInWithGoogle(): Promise<string | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return null;
    return result.data.idToken;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw err;
  }
}
