/**
 * iOS stub for googleSignInService
 * ================================
 * @react-native-google-signin/google-signin is an Android-only native module.
 * Metro resolves platform-specific files (.ios.ts / .android.ts) at bundle time,
 * so this stub is bundled on iOS and the real implementation only on Android.
 *
 * On iOS, Google OAuth uses expo-auth-session (web-based) — see IntegrationsScreen.tsx.
 */

export interface GoogleSignInTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  email:        string;
  name:         string;
  picture:      string | null;
}

export function configureGoogleSignIn(_scopes: string[] = []) {
  // No-op on iOS — expo-auth-session handles OAuth
}

export async function signInWithGoogleAndroid(
  _additionalScopes: string[] = [],
): Promise<GoogleSignInTokens> {
  throw new Error('signInWithGoogleAndroid is not available on iOS. Use expo-auth-session.');
}

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};
