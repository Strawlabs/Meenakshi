import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';

export async function getAllContacts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getContactProfile(contactId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Get contact details
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .single();

  if (contactError) throw new Error(contactError.message);

  // 2. Get follow-ups
  const { data: followUps, error: followUpsError } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('contact_id', contactId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // 3. Get linked email events
  const { data: emailLinks, error: linksError } = await supabase
    .from('contact_email_links')
    .select('link_type, email_events(*)')
    .eq('contact_id', contactId);

  let emails = emailLinks?.map(link => link.email_events).filter(Boolean) || [];

  // Also fetch emails directly matching the contact's email address to catch historical emails
  if (contact.email) {
    const { data: directEmails, error: directError } = await supabase
      .from('email_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('sender_email', contact.email);

    if (!directError && directEmails) {
      const seenIds = new Set(emails.map(e => e.id));
      directEmails.forEach(e => {
        if (!seenIds.has(e.id)) {
          emails.push(e);
          seenIds.add(e.id);
        }
      });
    }
  }

  // Sort emails by received_at descending
  emails.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

  return {
    contact,
    followUps: followUps || [],
    emails: emails,
  };
}

export async function generateRelationshipSummary(contactId: string): Promise<string> {
  const profile = await getContactProfile(contactId);
  const { contact, followUps, emails } = profile;

  const prompt = `
Generate a concise, 1-paragraph relationship summary for this contact based on the following data:

Contact Info:
Name: ${contact.name}
Role: ${contact.designation || 'Unknown'} at ${contact.organization || 'Unknown'}
Email: ${contact.email || 'N/A'}

Recent Emails:
${emails.slice(0, 5).map((e: any) => `- [${e.received_at}] ${e.subject}: ${e.ai_summary}`).join('\n')}

Pending Follow-ups:
${followUps.filter((f: any) => f.status === 'pending').map((f: any) => `- ${f.description}`).join('\n')}

Keep it professional, focusing on the context of their relationship with the user based on the interactions.
  `.trim();

  const summary = await generateGeminiContent(prompt, {
    model: 'gemini-3-flash-preview',
  });

  return summary;
}
