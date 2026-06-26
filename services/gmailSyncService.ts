/**
 * Meenakshi — Gmail Sync Service
 * ==============================
 * Synchronises emails from Google's Gmail API, filtering for financial indicators.
 */

import supabase from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshAccessToken } from './gmailAuthService';
import { classifyAndSaveEmail } from './emailClassifierService';

// Standard Gmail search query to locate financial and meeting emails (supports both read and unread)
const GMAIL_FILTER_QUERY = '(subject:(statement OR bill OR EMI OR renewal OR premium OR notice OR salary OR credit OR debit OR transaction OR meeting OR calendar) OR has:attachment)';

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface RawEmailData {
  id: string;
  threadId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  receivedAt: string;
  snippet: string;
  body: string;
}

/**
 * Base64url decoder compatible with React Native (using atob & TextDecoder).
 */
function decodeBase64Url(str: string): string {
  try {
    // Convert base64url to standard base64
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if necessary
    while (base64.length % 4) {
      base64 += '=';
    }
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (err) {
    console.warn('[gmailSyncService] Base64 decoding failed:', err);
    return '';
  }
}

/**
 * Recursively extracts plain text body from the Gmail message payload parts.
 */
function extractBodyText(payload: any): string {
  if (!payload) return '';

  // Check if body is directly available in this part
  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    // Strip HTML tags for clean text extraction if it's html type
    if (payload.mimeType === 'text/html') {
      return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return decoded;
  }

  // Recurse through multipart parts
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain over text/html
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart) {
      return extractBodyText(plainPart);
    }
    
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart) {
      return extractBodyText(htmlPart);
    }

    // fallback to check all parts
    for (const part of payload.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Synchronise emails for the currently logged-in user.
 * Feeds retrieved emails to the classification engine.
 */
export async function syncUserEmails(): Promise<{ totalFetched: number; totalSaved: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated in Supabase');

  // 1. Fetch connected account credentials
  const { data: account, error } = await supabase
    .from('email_accounts')
    .select('id, access_token, token_expiry, last_synced_at, email')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !account) {
    console.log('[gmailSyncService] No connected Gmail account found for user.');
    return { totalFetched: 0, totalSaved: 0 };
  }

  let token = account.access_token;
  
  // 2. Check token expiry, refresh if past or near expiry (within 60 seconds)
  const expiryTime = new Date(account.token_expiry).getTime();
  if (expiryTime - Date.now() < 60000) {
    console.log(`[gmailSyncService] Access token expired or expiring soon. Refreshing for: ${account.email}`);
    token = await refreshAccessToken(account.id);
  }

  // 3. Construct Search Query Q
  let query = GMAIL_FILTER_QUERY;
  if (account.last_synced_at) {
    const unixTimestamp = Math.floor(new Date(account.last_synced_at).getTime() / 1000);
    query += ` after:${unixTimestamp}`;
  }

  console.log(`[gmailSyncService] Querying Gmail API for ${account.email} with: ${query}`);

  // 4. Call Gmail users.messages.list
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;
  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listResponse.ok) {
    const errText = await listResponse.text();
    throw new Error(`Gmail API messages list failed: ${listResponse.status} - ${errText}`);
  }

  const listData = await listResponse.json();
  const messages = listData.messages || [];
   if (messages.length === 0) {
    console.log('[gmailSyncService] No new emails found matching filter.');
    
    // Update last_synced_at to now anyway
    await supabase
      .from('email_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id);
      
    return { totalFetched: 0, totalSaved: 0 };
  }

  // Retrieve last synced email ID from AsyncStorage to pick up from where we left off
  const storageKey = `last_synced_email_id_${account.id}`;
  const lastSyncedId = await AsyncStorage.getItem(storageKey);

  let unprocessed = [...messages];
  if (lastSyncedId) {
    const lastIndex = messages.findIndex((m: { id: string }) => m.id === lastSyncedId);
    if (lastIndex !== -1) {
      // Since Gmail lists newest first, messages before the lastSyncedId index are newer/unprocessed
      unprocessed = messages.slice(0, lastIndex);
    }
  }

  if (unprocessed.length === 0) {
    console.log('[gmailSyncService] All messages are already synced based on last synced ID.');
    
    // Update database last_synced_at to now since we are fully caught up
    await supabase
      .from('email_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id);
      
    return { totalFetched: 0, totalSaved: 0 };
  }

  console.log(`[gmailSyncService] Found ${unprocessed.length} unprocessed messages out of ${messages.length} total.`);

  // Limit to the first 5 emails per sync run (processing oldest unprocessed first, which are at the end of the array)
  const batchToProcess = unprocessed.slice(-5);
  console.log(`[gmailSyncService] Sync run limit: processing ${batchToProcess.length} emails (oldest first).`);

  let fetchedCount = 0;
  let savedCount = 0;
  let lastSuccessfulId = lastSyncedId;

  // Process sequentially with a 4-second delay between each classification
  for (let i = 0; i < batchToProcess.length; i++) {
    const msg = batchToProcess[i];

    if (i > 0) {
      console.log('[gmailSyncService] Waiting 4 seconds before next sequential call...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
    const getResponse = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!getResponse.ok) {
      console.warn(`[gmailSyncService] Failed to fetch message ${msg.id}: ${getResponse.statusText}`);
      continue;
    }
    
    const msgDetail = await getResponse.json();
    fetchedCount++;

    // Parse headers
    const headers: GmailMessageHeader[] = msgDetail.payload?.headers || [];
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
    const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    
    let senderName = '';
    let senderEmail = '';
    const emailMatch = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
    if (emailMatch) {
      senderName = emailMatch[1].replace(/['"]/g, '').trim();
      senderEmail = emailMatch[2].trim();
    } else {
      senderEmail = fromHeader.trim();
      senderName = fromHeader.split('@')[0].trim();
    }

    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

    const rawBody = extractBodyText(msgDetail.payload);
    const cleanedBody = rawBody.slice(0, 1000);

    const emailData: RawEmailData = {
      id: msgDetail.id,
      threadId: msgDetail.threadId,
      subject,
      senderName,
      senderEmail,
      receivedAt,
      snippet: msgDetail.snippet || '',
      body: cleanedBody || msgDetail.snippet || '',
    };

    try {
      const eventId = await classifyAndSaveEmail(user.id, emailData);
      if (eventId) {
        savedCount++;
        
        // Link to contact if exists
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', emailData.senderEmail)
          .maybeSingle();
          
        if (contact) {
          await supabase.from('contact_email_links').insert({
            contact_id: contact.id,
            email_event_id: eventId,
            link_type: 'correspondent'
          });
        }
      }
      
      // Update our tracker to the last successfully processed email ID
      lastSuccessfulId = msg.id;
      await AsyncStorage.setItem(storageKey, msg.id);
    } catch (err) {
      console.error(`[gmailSyncService] Failed to classify and save email ${emailData.id}:`, err);
    }
  }

  // Update last_synced_at timestamp in the database ONLY when we are completely caught up
  if (unprocessed.length <= 5) {
    console.log('[gmailSyncService] All unprocessed messages have been synced. Updating database last_synced_at timestamp.');
    const { error: updateError } = await supabase
      .from('email_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.id);

    if (updateError) {
      console.error('[gmailSyncService] Failed to update last_synced_at timestamp:', updateError);
    }
  } else {
    console.log(`[gmailSyncService] ${unprocessed.length - 5} unprocessed messages remaining for next sync run.`);
  }

  return { totalFetched: fetchedCount, totalSaved: savedCount };
}
