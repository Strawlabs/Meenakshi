/**
 * Meenakshi — Supabase Auth Helper
 * =================================
 * Silently signs in a test user to establish a valid authenticated session for Supabase queries.
 */

import supabase from '../lib/supabase';

const TEST_EMAIL = 'kalaxylife@gmail.com';
const TEST_PASSWORD = 'Meenakshi!2026_Secure';

export interface AuthUserState {
  isAuthenticated: boolean;
  userId: string | null;
  error: string | null;
}

/**
 * Ensures there is an active authenticated session.
 * If not, attempts to sign in with test credentials.
 */
export async function ensureAuthenticatedSession(): Promise<AuthUserState> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('[authHelper] Active user session found:', user.id);
      return { isAuthenticated: true, userId: user.id, error: null };
    }

    console.log('[authHelper] No active session. Attempting sign-in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (!signInError && signInData.user) {
      console.log('[authHelper] Sign-in succeeded:', signInData.user.id);
      return { isAuthenticated: true, userId: signInData.user.id, error: null };
    }

    console.log('[authHelper] Sign-in failed. Attempting automatic sign-up...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signUpError) {
      console.warn('[authHelper] Sign-up failed:', signUpError.message);
      return {
        isAuthenticated: false,
        userId: null,
        error: signUpError.message,
      };
    }

    if (signUpData.user) {
      console.log('[authHelper] Sign-up succeeded. Verification email sent.', signUpData.user.id);
      return {
        isAuthenticated: false, // will become true once email is confirmed
        userId: signUpData.user.id,
        error: 'Email confirmation required. Please confirm test@example.com in your Supabase Auth dashboard.',
      };
    }

    return { isAuthenticated: false, userId: null, error: 'Unknown authentication error' };
  } catch (err: any) {
    console.warn('[authHelper] Unexpected auth error:', err);
    return { isAuthenticated: false, userId: null, error: err.message };
  }
}
