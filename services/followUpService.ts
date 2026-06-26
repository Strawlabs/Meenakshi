import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';
import { getAllContacts } from './relationshipService';

export async function detectFollowUps(contextText: string, source: 'email' | 'conversation' | 'calendar') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const contacts = await getAllContacts();
  const contactsList = contacts.map(c => `ID: ${c.id}, Name: ${c.name}`).join('\n');

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
Analyze the following text to detect any follow-up commitments, tasks, or action items that the user needs to do, or someone needs to do for the user.

Today's Date: ${todayStr} (Use this as the reference point to resolve relative dates like "tomorrow", "next Monday", "Friday", "next week", etc. into specific ISO date strings).

Context text:
"""
${contextText}
"""

Available Contacts:
${contactsList || 'No contacts available'}

Return a JSON array of objects, where each object has:
- "description": string (the task description)
- "due_date": ISO date string (YYYY-MM-DD) or null if no specific date can be determined
- "contact_id": string (the ID of the contact from the list above if the task involves them, otherwise null)

Return ONLY the JSON array, e.g., [{"description": "Send document", "due_date": "2026-06-26", "contact_id": null}]
  `.trim();

  const responseText = await generateGeminiContent(prompt, {
    model: 'gemini-3-flash-preview',
    responseMimeType: 'application/json',
  });

  let followUpsData: any[];
  try {
    followUpsData = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Gemini response for follow-ups:', e);
    return [];
  }

  if (!Array.isArray(followUpsData) || followUpsData.length === 0) {
    return [];
  }

  const inserts = followUpsData.map(f => ({
    user_id: user.id,
    contact_id: f.contact_id || null,
    description: f.description,
    due_date: f.due_date,
    status: 'pending',
    source: 'ai_detected',
    detected_from: source,
  }));

  const { data, error } = await supabase
    .from('follow_ups')
    .insert(inserts)
    .select();

  if (error) {
    console.error('Error saving follow-ups:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function getFollowUps() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('follow_ups')
    .select('*, contacts(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function markFollowUpDone(followUpId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('follow_ups')
    .update({ status: 'done' })
    .eq('id', followUpId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
}

export async function parseManualFollowUp(text: string): Promise<{ description: string; due_date: string | null }> {
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
You are a task parsing engine. Parse this manually entered task to extract a clean description and any due date.

Today's Date: ${todayStr} (Use this as the reference point to resolve relative dates like "tomorrow", "next Monday", "Friday", "next week", etc. into specific ISO date strings).

Task text: "${text}"

Return ONLY a JSON object matching this schema:
{
  "description": "string (cleaned task description, without relative date words if they are resolved into the due date)",
  "due_date": "ISO date string (YYYY-MM-DD) or null if no date is mentioned"
}
  `.trim();

  try {
    const responseText = await generateGeminiContent(prompt, {
      model: 'gemini-3-flash-preview',
      responseMimeType: 'application/json',
    });
    const cleanText = responseText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error('Failed to parse manual follow-up:', e);
    return { description: text, due_date: null };
  }
}
