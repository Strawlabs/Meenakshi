/**
 * Meenakshi — Android Google Sign-In Service
 * ==========================================
 * Uses @react-native-google-signin/google-signin v16 (Google Play Services native SDK)
 * for Android OAuth. Bypasses all web-based OAuth redirect URI restrictions.
 *
 * v16 API: signIn() returns { type: 'success' | 'cancelled', data: User | null }
 * User.serverAuthCode is the one-time code to exchange for refresh tokens.
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET
                   || process.env.GOOGLE_CLIENT_SECRET
                   || '';

export function configureGoogleSignIn(additionalScopes: string[] = []) {
  // Email and profile are always included by the native SDK — don't pass them as extras
  // or the consent screen may omit the genuinely additional scopes (e.g. gmail.readonly).
  const DEFAULT_SCOPES = new Set([
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'email',
    'profile',
    'openid',
  ]);
  const extraScopes = additionalScopes.filter(s => !DEFAULT_SCOPES.has(s));

  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,   // required to receive serverAuthCode
    scopes: extraScopes,
  });
}


export interface GoogleSignInTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  email:        string;
  name:         string;
  picture:      string | null;
}

/**
 * Trigger native Google Sign-In on Android and return tokens.
 * Signs out first to always get a fresh serverAuthCode (Google omits it on silent re-auth).
 */
export async function signInWithGoogleAndroid(
  additionalScopes: string[] = [],
): Promise<GoogleSignInTokens> {
  configureGoogleSignIn(additionalScopes);
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Sign out first so Google always issues a fresh serverAuthCode.
  try { await GoogleSignin.signOut(); } catch { /* ignore if not signed in */ }

  const response = await GoogleSignin.signIn();

  // v16 discriminated union: { type: 'success', data: User } | { type: 'cancelled', data: null }
  if (response.type === 'cancelled') {
    const err: any = new Error('Sign-in cancelled');
    err.code = statusCodes.SIGN_IN_CANCELLED;
    throw err;
  }

  const user = response.data;
  const serverAuthCode = user?.serverAuthCode;

  if (!serverAuthCode) {
    throw new Error(
      'No serverAuthCode received. Ensure webClientId is the Web application ' +
      'client ID (not Android client) and offlineAccess: true is set.'
    );
  }

  // Exchange server auth code for tokens — no redirect_uri needed for auth code grants.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code:          serverAuthCode,
      client_id:     WEB_CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'authorization_code',
    }).toString(),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenJson.error_description || tokenJson.error}`);
  }

  const { access_token, refresh_token, expires_in } = tokenJson;

  // Fetch profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profile = await profileRes.json();

  return {
    accessToken:  access_token,
    refreshToken: refresh_token || '',
    expiresIn:    expires_in || 3600,
    email:        profile.email   || (user as any)?.user?.email || '',
    name:         profile.name    || (user as any)?.user?.name  || '',
    picture:      profile.picture || (user as any)?.user?.photo || null,
  };
}

export { statusCodes };
