import supabase from '../lib/supabase';
import { refreshAccessToken } from './gmailAuthService';

export interface SyncResult {
  success: boolean;
  contactsImported: number;
  error?: string;
}

export async function syncGoogleContacts(): Promise<SyncResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, contactsImported: 0, error: 'User not authenticated' };
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

    // 3. Fetch contacts from Google People API
    const response = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=1000',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const connections = data.connections || [];
    let imported = 0;

    // 4. Map and save contacts
    for (const person of connections) {
      const name = person.names?.[0]?.displayName || person.names?.[0]?.givenName;
      if (!name) continue;

      const email = person.emailAddresses?.[0]?.value || null;
      const phone = person.phoneNumbers?.[0]?.value || null;
      const organization = person.organizations?.[0]?.name || null;
      const designation = person.organizations?.[0]?.title || null;

      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'google_contacts')
        .eq('name', name)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('contacts')
          .update({
            email: email || undefined,
            phone: phone || undefined,
            organization: organization || undefined,
            designation: designation || undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            name,
            email,
            phone,
            organization,
            designation,
            source: 'google_contacts',
          });
      }
      
      imported++;
    }

    // 5. Update success status
    await updateConsentStatus(user.id, 'connected', null);
    
    return { success: true, contactsImported: imported };
  } catch (error: any) {
    console.error('Contacts sync error:', error);
    await updateConsentStatus(user.id, 'error', error.message || 'Unknown error occurred');
    return { success: false, contactsImported: 0, error: error.message };
  }
}

async function updateConsentStatus(userId: string, status: string, errorMsg: string | null = null) {
  const payload: any = {
    user_id: userId,
    integration: 'contacts',
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
