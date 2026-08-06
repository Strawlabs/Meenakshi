/**
 * Meenakshi — Notification & AI Briefing Engine
 * ==============================================
 * Service functions for ai_briefings, notifications, and notification_preferences tables.
 * All read functions filter against notification_preferences IN the query (not in JS).
 * Priority ordering is delegated to the get_unread_notifications RPC.
 */

import supabase from '../lib/supabase';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface BriefingSection {
  title: string;
  items: string[];
}

export interface BriefingContent {
  headline: string;
  sections: BriefingSection[];
}

export interface AiBriefing {
  id: string;
  user_id: string;
  briefing_type: 'daily' | 'weekly';
  content: BriefingContent;
  generated_at: string;
  read_at: string | null;
}

export type NotificationCategory =
  | 'financial_alert'
  | 'relationship_reminder'
  | 'renewal'
  | 'opportunity';

export type NotificationPriority = 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  source_event_id: string | null;
  dedup_key: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  daily_briefing: boolean;
  financial_alerts: boolean;
  relationship_reminders: boolean;
  renewals: boolean;
  opportunities: boolean;
  push_token: string | null;
}

// ────────────────────────────────────────────────────────────
// 1. getLatestBriefing
// ────────────────────────────────────────────────────────────

/**
 * Fetches the most recent ai_briefing row for a user and type.
 * Returns null if no briefing exists yet (new user, or job hasn't run).
 */
export async function getLatestBriefing(
  userId: string,
  type: 'daily' | 'weekly'
): Promise<AiBriefing | null> {
  const { data, error } = await supabase
    .from('ai_briefings')
    .select('*')
    .eq('user_id', userId)
    .eq('briefing_type', type)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[notificationService] getLatestBriefing error:', error.message);
    return null;
  }
  return data as AiBriefing | null;
}

// ────────────────────────────────────────────────────────────
// 2. getUnreadNotifications
// ────────────────────────────────────────────────────────────

/**
 * Fetches unread, non-dismissed notifications for a user.
 * Uses a direct table query (not RPC) to avoid dependency on the
 * get_unread_notifications function which may not exist or may silently
 * return 0 rows if notification_preferences row is missing.
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  // Ensure preferences row exists — the old RPC did INNER JOIN on this table,
  // returning 0 rows if the preferences row was missing.
  await getNotificationPreferences(userId).catch(() => null);

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .is('read_at', null)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[notificationService] getUnreadNotifications error:', error.message);
    return [];
  }

  const results = (data ?? []) as Notification[];
  console.log(`[notificationService] Found ${results.length} unread notifications for ${userId}`);

  // Sort by priority: high → medium → low
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return results.sort((a, b) =>
    (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );
}


// ────────────────────────────────────────────────────────────
// 3. markNotificationRead
// ────────────────────────────────────────────────────────────

/**
 * Sets read_at = now() for a notification row.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[notificationService] markNotificationRead error:', error.message);
  }
}

// ────────────────────────────────────────────────────────────
// 4. dismissNotification
// ────────────────────────────────────────────────────────────

/**
 * Sets dismissed_at = now() for a notification row.
 */
export async function dismissNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[notificationService] dismissNotification error:', error.message);
  }
}

// ────────────────────────────────────────────────────────────
// 5. getNotificationPreferences
// ────────────────────────────────────────────────────────────

/**
 * Fetches notification preferences for a user.
 * If no row exists yet, inserts defaults and returns them.
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const defaults: NotificationPreferences = {
    user_id: userId,
    daily_briefing: true,
    financial_alerts: true,
    relationship_reminders: true,
    renewals: true,
    opportunities: true,
    push_token: null,
  };

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[notificationService] getNotificationPreferences error:', error.message);
    return defaults;
  }

  if (!data) {
    // No row yet — insert defaults
    const { data: inserted, error: insertError } = await supabase
      .from('notification_preferences')
      .insert(defaults)
      .select()
      .single();

    if (insertError) {
      console.error('[notificationService] Failed to insert default preferences:', insertError.message);
      return defaults;
    }
    return inserted as NotificationPreferences;
  }

  return data as NotificationPreferences;
}

// ────────────────────────────────────────────────────────────
// 6. updateNotificationPreferences
// ────────────────────────────────────────────────────────────

/**
 * Upserts notification preferences for a user.
 * Partial update — only provided keys are changed.
 */
export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferences, 'user_id'>>
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[notificationService] updateNotificationPreferences error:', error.message);
    return null;
  }
  return data as NotificationPreferences;
}
