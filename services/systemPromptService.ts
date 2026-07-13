import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';
import { buildMemoryContext, buildEmailContext } from './memoryService';
import { getLatestSnapshot } from './financialHealthService';
import { getAllContacts } from './relationshipService';
import { getFollowUps } from './followUpService';
import { getUserDocuments, Document } from './documentService';
import supabase from '../lib/supabase';

const SYSTEM_PROMPT_CACHE_MS = 5 * 60 * 1000;
let _cachedSystemPrompt: string | null = null;
let _cachedSystemPromptAt = 0;

const LANGUAGE_INSTRUCTION = `
LANGUAGE DETECTION:
Detect the language the user is speaking and respond naturally in the same language.
- If English → respond in clear, warm English
- If Tamil or Tanglish → respond naturally in Tanglish
- If Hindi → respond in simple Hindi with English financial terms
Never announce that you are switching languages. Just switch naturally.`;

export async function buildSystemPrompt(forceRefresh = false): Promise<string> {
  if (!forceRefresh && _cachedSystemPrompt && (Date.now() - _cachedSystemPromptAt) < SYSTEM_PROMPT_CACHE_MS) {
    return _cachedSystemPrompt;
  }

  console.log('[systemPromptService] Building system prompt (cache miss)...');
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  let prompt = MEENAKSHI_SYSTEM_PROMPT
    + `\n\nTODAY'S DATE: ${today}`
    + LANGUAGE_INSTRUCTION;

  // Memory context (last 3 sessions)
  const memCtx = await buildMemoryContext().catch(() => '');
  if (memCtx) prompt += `\n\n${memCtx}`;

  const emailCtx = await buildEmailContext().catch(() => '');
  if (emailCtx) prompt += `\n\n${emailCtx}`;

  // Financial health snapshot + relationship context — run in parallel
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [snapshot, contacts, followUps, historyRes, recentDocs] = await Promise.all([
        getLatestSnapshot(user.id).catch(() => null),
        getAllContacts().catch(() => [] as any[]),
        getFollowUps().catch(() => [] as any[]),
        (async () => { try { return await supabase.from('email_events').select('received_at, category, amount, ai_summary, sender_name, entity_email_links(entities(name))').eq('user_id', user.id).order('received_at', { ascending: false }).limit(10); } catch { return { data: null }; } })(),
        getUserDocuments(user.id).catch(() => [] as Document[])
      ]);

      // Financial block
      if (snapshot) {
        const obligations = (snapshot.upcoming_obligations ?? [])
          .map((o: any) =>
            `- ${o.description ?? o.subject ?? o.category} due ${o.due_date} (₹${o.amount ?? 0})`
          )
          .join('\n') || 'None';

        let eventsStr = 'None';
        const historyEvents = historyRes?.data;
        if (historyEvents && historyEvents.length > 0) {
          eventsStr = historyEvents.map((e: any) => {
            const dateStr = new Date(e.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const amountStr = e.amount ? e.amount : '0';
            const entityStr = e.entity_email_links?.[0]?.entities?.name || e.sender_name || 'Unknown Entity';
            return `- [${dateStr}] [${e.category}] [${entityStr}]: ₹${amountStr} — [${e.ai_summary || ''}]`;
          }).join('\n');
        }

        prompt +=
          `\n\nFINANCIAL CONTEXT: ${snapshot.summary ?? 'No summary available.'}` +
          `\n\nUPCOMING OBLIGATIONS:\n${obligations}` +
          `\n\nRECENT FINANCIAL EVENTS:\n${eventsStr}`;
      }

      // Document block
      if (recentDocs.length > 0) {
        const topDocs = recentDocs.slice(0, 3);
        const recentDocumentsContext = `RECENT UPLOADED DOCUMENTS (for budget planning and general context):\n${topDocs.map((doc: Document) => `- [${doc.file_name}] (${doc.document_type}): ${doc.summary || 'No summary'} | Obligations: ${JSON.stringify(doc.obligations || [])}`).join('\n')}`;
        prompt += `\n\n${recentDocumentsContext}`;
      }

      // Relationship block — compact summary only, no per-contact DB calls
      if (contacts.length > 0) {
        // Build a pending-follow-ups lookup keyed by contact name for O(1) join
        const pendingByContact = new Map<string, string[]>();
        for (const f of followUps) {
          if (f.status !== 'pending') continue;
          const name: string = f.contacts?.name ?? 'Unknown';
          if (!pendingByContact.has(name)) pendingByContact.set(name, []);
          pendingByContact.get(name)!.push(f.description ?? 'follow up');
        }

        const top15 = contacts.slice(0, 15); // cap to avoid bloating the system prompt
        const contactLines = top15.map((c: any) => {
          const role = [c.designation, c.organization].filter(Boolean).join(' at ') || 'Unknown';
          const lastSeen = c.updated_at
            ? new Date(c.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Unknown';
          const pending = pendingByContact.get(c.name);
          const followUpStr = pending?.length
            ? ` | Pending: ${pending.slice(0, 2).join('; ')}`
            : '';
          return `- ${c.name} (${role}) — last updated ${lastSeen}${followUpStr}`;
        }).join('\n');

        const pendingCount = followUps.filter((f: any) => f.status === 'pending').length;
        prompt +=
          `\n\nRELATIONSHIP CONTEXT: You have access to ${contacts.length} contact(s) in the user's circle.` +
          (pendingCount > 0 ? ` ${pendingCount} pending follow-up(s) across contacts.` : '') +
          `\n${contactLines}`;
      }
    }
  } catch (_) {}

  _cachedSystemPrompt = prompt;
  _cachedSystemPromptAt = Date.now();
  console.log('[systemPromptService] System prompt cached.');
  return prompt;
}

export function invalidateSystemPromptCache() {
  _cachedSystemPrompt = null;
}
