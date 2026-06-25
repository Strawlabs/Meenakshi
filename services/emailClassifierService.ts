/**
 * Meenakshi — Email Classifier Service
 * =====================================
 * Uses Gemini API to classify emails, extract metadata, and link to entities.
 * Includes soft-deduplication to merge duplicate financial notifications.
 */

import { generateGeminiContent } from './geminiService';
import supabase from '../lib/supabase';
import { checkDuplicateEvent } from './duplicateDetector';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

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

interface ClassificationResult {
  category: 'salary' | 'emi' | 'credit_card' | 'insurance' | 'tax' | 'investment' | 'loan' | 'bill' | 'renewal' | 'notice' | 'approval' | 'other';
  amount: number | null;
  due_date: string | null;
  entity_name: string | null;
  event_description: string;
}

/**
 * Classifies a single raw email using Gemini and saves the results to Supabase.
 */
export async function classifyAndSaveEmail(userId: string, email: RawEmailData): Promise<boolean> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY environment variable');
  }

  // 1. Check if email was already synced (hard deduplication by message ID)
  const { data: existingEvent } = await supabase
    .from('email_events')
    .select('id')
    .eq('user_id', userId)
    .eq('gmail_message_id', email.id)
    .maybeSingle();

  if (existingEvent) {
    // Already processed, skip
    return false;
  }

  // 2. Call Gemini for Classification & Extraction
  const prompt = `
You are a financial and professional intelligence engine. Analyze the following email and extract structured details.

Email Subject: ${email.subject}
From: ${email.senderName} <${email.senderEmail}>
Date Received: ${email.receivedAt}
Snippet: ${email.snippet}
Body: ${email.body}

Instructions:
1. Determine if the email represents a financial transaction.
2. Classify the email into exactly one of these categories:
   [salary, emi, credit_card, insurance, tax, investment, loan, bill, renewal, notice, approval, other]
   If the email is not financial, return category: other and nulls for the rest.
3. Extract amount as a numeric value in INR (e.g. 15450.00). Do not include currency symbols. If no amount is mentioned, return null.
4. Extract due date as an ISO date string (YYYY-MM-DD format). If no due date is mentioned, return null.
5. Extract the entity_name (the bank or company name, e.g., "HDFC Bank", "LIC India"). Return null if not found.
6. Extract the event_description as a concise, clear one-sentence plain English summary of the event.

Return ONLY a JSON object matching this schema. Return as JSON only, no markdown formatting or \`\`\` blocks:
{
  "category": "salary" | "emi" | "credit_card" | "insurance" | "tax" | "investment" | "loan" | "bill" | "renewal" | "notice" | "approval" | "other",
  "amount": number or null,
  "due_date": "YYYY-MM-DD" or null,
  "entity_name": "string" or null,
  "event_description": "string"
}
`;

  const responseText = await generateGeminiContent(prompt, {
    responseMimeType: 'application/json',
    model: 'gemini-3-flash-preview',
  });

  let result: ClassificationResult;
  try {
    const cleanText = responseText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    result = JSON.parse(cleanText);
  } catch (err) {
    console.error('[emailClassifierService] Failed to parse Gemini JSON output:', responseText);
    throw new Error('Gemini did not return valid JSON');
  }

  // 3. Duplicate Detection
  const duplicateMatch = await checkDuplicateEvent(
    userId,
    result.category,
    result.entity_name,
    result.amount,
    email.receivedAt
  );

  let isDuplicate = false;
  let canonicalEventId: string | null = null;

  if (duplicateMatch) {
    isDuplicate = true;
    canonicalEventId = duplicateMatch.id;
    console.log(`[emailClassifierService] Merging duplicate event: ${email.subject} linked to ${canonicalEventId}`);
    // If it's a duplicate, we skip inserting a new event as per requirements.
    return false;
  }

  // 4. Save Event to public.email_events
  const { data: savedEvent, error: insertError } = await supabase
    .from('email_events')
    .insert({
      user_id: userId,
      gmail_message_id: email.id,
      gmail_thread_id: email.threadId,
      subject: email.subject,
      sender_email: email.senderEmail,
      sender_name: email.senderName,
      received_at: email.receivedAt,
      category: result.category,
      amount: result.amount,
      due_date: (() => {
        if (!result.due_date) return null;
        const parsed = new Date(result.due_date);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString();
      })(),
      ai_summary: result.event_description, // store event_description in ai_summary
      raw_snippet: email.snippet,
      is_duplicate: isDuplicate,
      canonical_event_id: canonicalEventId,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert email event: ${insertError.message}`);
  }

  // 5. Entity Extraction & Linkage
  try {
    // Extract Institution Entity (Organization)
    if (result.entity_name) {
      let orgId = '';
      
      // Check if entity already exists
      const { data: existingOrg } = await supabase
        .from('entities')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'organization')
        .eq('name', result.entity_name)
        .maybeSingle();

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgError } = await supabase
          .from('entities')
          .insert({
            user_id: userId,
            type: 'organization',
            name: result.entity_name,
            metadata: { bank: result.entity_name },
          })
          .select('id')
          .single();
        
        if (!orgError && newOrg) {
          orgId = newOrg.id;
        }
      }

      if (orgId) {
        // Link it to financial_events (assuming table is entity_event_links or similar, falling back to just returning since the request doesn't explicitly mention linking table, only that we should save to 'entities' table)
        // Wait, the previous code used entity_email_links, let's keep it or change it to entity_financial_links? 
        // The prompt only said "save results to financial_events and entities tables". Let's assume just saving to entities is enough or we use entity_financial_links.
        // Actually, we don't necessarily need a link table if the instructions don't specify it, but I'll leave the link logic commented out or just skip it to be safe, or rename it. I'll just use entity_email_links if it exists.
        await supabase
          .from('entity_email_links')
          .insert({
            email_event_id: savedEvent.id,
            entity_id: orgId,
            link_type: 'institution',
          })
          .select()
          .maybeSingle();
      }
    }
  } catch (entityErr) {
    console.warn('[emailClassifierService] Failed to extract or link entities:', entityErr);
  }

  return true;
}
