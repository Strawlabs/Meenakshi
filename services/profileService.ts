/**
 * Meenakshi — Profile Service
 * ============================
 * Single source of truth for the authenticated user's display name, email,
 * and avatar. Reads from Supabase auth user_metadata so it stays in sync
 * with the Gmail OAuth name-capture flow.
 */

import supabase from '../lib/supabase';

/**
 * Derive a friendly first name from an email address.
 * e.g. "prabhu.nagoor@strawlabs.in" → "Prabhu"
 */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  // Take the part before the first dot or underscore, then capitalise
  const first = local.split(/[._\-+]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Get the user's display name.
 * Priority: user_metadata.display_name → user_metadata.full_name → email-derived first name
 */
export async function getUserDisplayName(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '';

  const meta = user.user_metadata ?? {};
  if (meta.display_name && typeof meta.display_name === 'string') {
    return meta.display_name;
  }
  if (meta.full_name && typeof meta.full_name === 'string') {
    // Return just the first name from a full name
    return meta.full_name.split(' ')[0];
  }
  if (user.email) {
    return nameFromEmail(user.email);
  }
  return 'You';
}

/**
 * Get the user's email address from Supabase auth.
 */
export async function getUserEmail(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? '';
}

/**
 * Get the first letter of the user's display name for avatar chips.
 */
export async function getUserAvatarInitial(): Promise<string> {
  const name = await getUserDisplayName();
  return name.charAt(0).toUpperCase() || 'M';
}

/**
 * Get the user's avatar URL if available (set from Google OAuth picture).
 */
export async function getUserAvatarUrl(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.avatar_url ?? null;
}

/**
 * Persist a manually-entered display name to Supabase auth user_metadata.
 * Used by the Settings screen Edit button.
 */
export async function setUserDisplayName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase.auth.updateUser({
    data: { display_name: trimmed },
  });
  if (error) {
    console.error('[profileService] Failed to set display name:', error.message);
    throw error;
  }
}
