import supabase from '../lib/supabase';
import { refreshAccessToken } from './gmailAuthService';

export interface CalendarSyncResult {
  success: boolean;
  eventsImported: number;
  error?: string;
}

export async function syncGoogleCalendar(): Promise<CalendarSyncResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, eventsImported: 0, error: 'User not authenticated' };
  }

  // 1. Mark status as pending
  await updateConsentStatus(user.id, 'pending');

  try {
    // 2. Get the access token from email_accounts
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('id, access_token, token_expiry')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error('Google account not connected. Please connect from Settings.');
    }

    let token = account.access_token;

    // Refresh token if expired or expiring soon (within 5 minutes)
    if (new Date(account.token_expiry).getTime() - Date.now() < 300000) {
      token = await refreshAccessToken(account.id);
    }

    // 3. Fetch events from Google Calendar API (Primary and Birthdays)
    // Fetch upcoming events from 1 month ago to 6 months in future as a standard sync
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 6);

    const calendarsToSync = ['primary', '#contacts@group.v.calendar.google.com'];
    let imported = 0;

    for (const calendarId of calendarsToSync) {
      const encodedCalendarId = encodeURIComponent(calendarId);
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`);
      url.searchParams.append('timeMin', timeMin.toISOString());
      url.searchParams.append('timeMax', timeMax.toISOString());
      url.searchParams.append('maxResults', '2500');
      url.searchParams.append('singleEvents', 'true');
      url.searchParams.append('orderBy', 'startTime');

      try {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          console.warn(`Failed to fetch calendar ${calendarId}`);
          continue; // Skip if Birthdays calendar doesn't exist for user
        }

        const data = await response.json();
        const events = data.items || [];

        // 4. Map and save events
        for (const event of events) {
          if (event.status === 'cancelled') continue;

          const title = event.summary || 'Untitled Event';
          const startTime = event.start?.dateTime || event.start?.date;
          const endTime = event.end?.dateTime || event.end?.date;
          
          if (!startTime || !endTime) continue;

          const attendees = event.attendees || [];
          const sourceCalendarId = event.id;

          const { data: existing } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('source_calendar_id', sourceCalendarId)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('calendar_events')
              .update({
                title,
                start_time: startTime,
                end_time: endTime,
                attendees,
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('calendar_events')
              .insert({
                user_id: user.id,
                title,
                start_time: startTime,
                end_time: endTime,
                attendees,
                source_calendar_id: sourceCalendarId,
              });
          }
          imported++;
        }
      } catch (err) {
        console.error(`Error processing calendar ${calendarId}:`, err);
      }
    }

    // 5. Update success status
    await updateConsentStatus(user.id, 'connected', null);
    
    return { success: true, eventsImported: imported };
  } catch (error: any) {
    console.error('Calendar sync error:', error);
    await updateConsentStatus(user.id, 'error', error.message || 'Unknown error occurred');
    return { success: false, eventsImported: 0, error: error.message };
  }
}

async function updateConsentStatus(userId: string, status: string, errorMsg: string | null = null) {
  const payload: any = {
    user_id: userId,
    integration: 'calendar',
    status,
  };
  
  if (status === 'connected') {
    payload.last_synced_at = new Date().toISOString();
    payload.last_sync_error = null;
  } else if (status === 'error') {
    payload.last_sync_error = errorMsg;
  }

  await supabase
    .from('integration_consents')
    .upsert(payload, { onConflict: 'user_id,integration' });
}
