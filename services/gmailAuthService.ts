/**
 * Meenakshi — Gmail OAuth Service
 * ===============================
 * Manages Google OAuth 2.0 flow for Gmail API access using expo-auth-session.
 * Stores tokens securely in the Supabase 'email_accounts' table.
 */

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import supabase from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth 2.0 Endpoints
export const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Client ID configured in Google Cloud Console
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

export interface ConnectedAccount {
  id: string;
  email: string;
  lastSyncedAt: string | null;
  tokenExpiry: string;
}

/**
 * Exchange an OAuth authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; email: string }> {
  if (!CLIENT_ID) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID in environment');
  }

  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };

  if (CLIENT_SECRET) {
    params.client_secret = CLIENT_SECRET;
  }

  const response = await fetch(discovery.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${json.error_description || json.error || response.statusText}`);
  }

  const { access_token, refresh_token, expires_in } = json;

  // Fetch user info (email) using the new access token
  const infoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const infoJson = await infoResponse.json();
  if (!infoResponse.ok) {
    throw new Error('Failed to fetch user profile info from Google');
  }

  return {
    accessToken: access_token,
    refreshToken: refresh_token || '',
    expiresIn: expires_in,
    email: infoJson.email,
  };
}

/**
 * Get the currently connected Gmail account for the authenticated user.
 */
export async function getConnectedAccount(): Promise<ConnectedAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('email_accounts')
    .select('id, email, last_synced_at, token_expiry')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    lastSyncedAt: data.last_synced_at,
    tokenExpiry: data.token_expiry,
  };
}

/**
 * Save or update the Gmail connection in Supabase.
 */
export async function saveEmailAccount(
  email: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated in Supabase');

  const expiry = new Date();
  expiry.setSeconds(expiry.getSeconds() + expiresInSeconds);

  const { data, error } = await supabase
    .from('email_accounts')
    .upsert(
      {
        user_id: user.id,
        email,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expiry: expiry.toISOString(),
      },
      { onConflict: 'user_id,email' }
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save email account: ${error.message}`);
  }

  return data.id;
}

/**
 * Refresh an expired Gmail access token.
 */
export async function refreshAccessToken(accountId: string): Promise<string> {
  const { data, error } = await supabase
    .from('email_accounts')
    .select('refresh_token, email')
    .eq('id', accountId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to retrieve refresh token: ${error?.message || 'Account not found'}`);
  }

  const { refresh_token } = data;

  if (!CLIENT_ID) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID in environment');
  }

  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    refresh_token: refresh_token,
    grant_type: 'refresh_token',
  };

  if (CLIENT_SECRET) {
    params.client_secret = CLIENT_SECRET;
  }

  // Request new tokens from Google
  const response = await fetch(discovery.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${json.error_description || json.error || response.statusText}`);
  }

  const { access_token, expires_in } = json;
  const expiry = new Date();
  expiry.setSeconds(expiry.getSeconds() + expires_in);

  // Update in Supabase
  const { error: updateError } = await supabase
    .from('email_accounts')
    .update({
      access_token,
      token_expiry: expiry.toISOString(),
    })
    .eq('id', accountId);

  if (updateError) {
    throw new Error(`Failed to update refreshed token in database: ${updateError.message}`);
  }

  return access_token;
}

/**
 * Disconnect Gmail and remove the credentials/history from the database.
 */
export async function disconnectGmail(accountId: string): Promise<void> {
  const { error } = await supabase
    .from('email_accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    throw new Error(`Failed to disconnect Gmail: ${error.message}`);
  }
}
