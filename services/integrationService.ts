import supabase from '../lib/supabase';
import { syncGoogleContacts } from './contactsSyncService';
import { syncGoogleCalendar } from './calendarSyncService';
import { disconnectGmail } from './gmailAuthService';
// Import gmailSyncService if it has a sync function, though we may just rely on existing gmail sync flow
// For now we'll mock or dispatch what we can.
import { syncUserEmails } from './gmailSyncService';

export interface IntegrationConsent {
  id: string;
  integration: string;
  status: string;
  scopes_granted: string[] | null;
  connected_at: string | null;
  revoked_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export async function getIntegrationStatuses(userId: string): Promise<Record<string, IntegrationConsent>> {
  const { data, error } = await supabase
    .from('integration_consents')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch integration statuses:', error);
    return {};
  }

  const result: Record<string, IntegrationConsent> = {};
  for (const row of (data || [])) {
    result[row.integration] = row;
  }
  return result;
}

export async function retrySync(integration: string): Promise<boolean> {
  try {
    switch (integration) {
      case 'contacts': {
        const res = await syncGoogleContacts();
        return res.success;
      }
      case 'calendar': {
        const res = await syncGoogleCalendar();
        return res.success;
      }
      case 'gmail': {
        const res = await syncUserEmails();
        // syncUserEmails returns { totalFetched, totalSaved } not { success }
        return true;
      }
      case 'bank_account': {
        // FI Data is pushed automatically via Setu Auto-Fetch to the aa-consent-webhook.
        // Manual sync is not currently supported/needed for one-time consents.
        console.log('[integrationService] bank_account data relies on Auto-Fetch webhook push.');
        return true;
      }
      case 'credit_report':
        // Credit report sync is event-driven (re-upload/parse triggers it)
        return true;
      case 'business_card':
      case 'document_vault':
        // These are event-driven (sync happens on upload/scan)
        return true;
      default:
        // Silently ignore other unknowns to prevent Expo yellow boxes
        return false;
    }
  } catch (error) {
    console.error(`Error retrying sync for ${integration}:`, error);
    return false;
  }
}

export async function syncAllConnectedIntegrations(userId: string): Promise<void> {
  try {
    console.log('[integrationService] Starting background sync for all connected integrations...');
    const statuses = await getIntegrationStatuses(userId);
    
    // Sequential sync to avoid rate limits / OAuth token collisions
    for (const [integrationId, consent] of Object.entries(statuses)) {
      if (consent.status === 'connected') {
        console.log(`[integrationService] Auto-syncing ${integrationId}...`);
        await retrySync(integrationId);
      }
    }
    console.log('[integrationService] Background sync complete.');
  } catch (error) {
    console.error('[integrationService] Error in syncAllConnectedIntegrations:', error);
  }
}

export async function revokeIntegration(integration: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Mark as disconnected
  const { error } = await supabase
    .from('integration_consents')
    .upsert({
      user_id: user.id,
      integration,
      status: 'disconnected',
      revoked_at: new Date().toISOString(),
    }, { onConflict: 'user_id,integration' });

  if (error) {
    throw new Error(`Failed to revoke ${integration}: ${error.message}`);
  }

  // If it's a Google integration, and they disconnect Gmail (or all), we clear tokens
  // For simplicity, if they disconnect gmail, we wipe the token. 
  // If they disconnect contacts/calendar, we just leave the token but update the consent.
  if (integration === 'gmail') {
    const { data: account } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (account) {
      await disconnectGmail(account.id);
    }
  }
}
