/**
 * Meenakshi — Document Q&A Service
 * ==================================
 * Handles AI-powered question answering grounded in uploaded document content,
 * and persists Q&A history to the `document_qa_sessions` table.
 */

import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';
import { getDocumentById } from './documentService';

export interface QASession {
  id: string;
  document_id: string;
  question: string;
  answer: string;
  asked_at: string;
}

/**
 * Ask a question about a specific document.
 * Grounds the answer in the document's raw extracted text and metadata.
 */
import { getLatestSnapshot } from './financialHealthService';

export async function askDocumentQuestion(
  documentId: string,
  userId: string,
  question: string
): Promise<string> {
  const doc = await getDocumentById(documentId);

  if (!doc) {
    return "I couldn't find this document. Please try again.";
  }

  // Fetch financial context
  let financialContext = '';
  try {
    const snapshot = await getLatestSnapshot(userId);
    const healthSummary = snapshot?.summary || 'No summary available.';
    const obligations = snapshot?.upcoming_obligations || [];
    
    const obligationsStr = obligations.length > 0
      ? obligations.map((o: any) => `- ${o.description || o.subject || o.category} due ${o.due_date} (₹${o.amount || '0'})`).join('\n')
      : 'None';

    const { data: historyEvents } = await supabase
      .from('email_events')
      .select('received_at, category, amount, ai_summary, sender_name, entity_email_links(entities(name))')
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .limit(10);
    
    let eventsStr = 'None';
    if (historyEvents && historyEvents.length > 0) {
      eventsStr = historyEvents.map((e: any) => {
        const dateStr = new Date(e.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const amountStr = e.amount ? e.amount : '0';
        const entityStr = e.entity_email_links?.[0]?.entities?.name || e.sender_name || 'Unknown Entity';
        return `- [${dateStr}] [${e.category}] [${entityStr}]: ₹${amountStr} — [${e.ai_summary || ''}]`;
      }).join('\n');
    }

    financialContext = `\n\nFINANCIAL TIMELINE & HEALTH:
Overall Status: ${healthSummary}
Upcoming Obligations:
${obligationsStr}
Recent Financial Events (Emails/Transactions):
${eventsStr}`;
  } catch (err) {
    console.log('[documentQAService] Failed to load financial context', err);
  }

  const rawText = doc.raw_extracted_text || '';
  // Limit raw text to avoid hitting token limits — first 4000 chars is usually sufficient
  const truncatedText = rawText.slice(0, 4000);

  const prompt = `You are Meenakshi, the user's AI assistant. The user is asking about a document they uploaded.

DOCUMENT TYPE: ${doc.document_type || 'unknown'}
DOCUMENT SUMMARY: ${doc.summary || 'No summary available.'}
KEY DATES: ${JSON.stringify(doc.key_dates || [])}
OBLIGATIONS: ${JSON.stringify(doc.obligations || [])}
ENTITIES: ${JSON.stringify(doc.entities || [])}
${financialContext}

FULL DOCUMENT TEXT (may be truncated):
${truncatedText}

USER QUESTION: ${question}

Answer conversationally and precisely. Cite specific figures, dates, clauses, or names from the document when relevant. You may use the user's Financial Timeline & Health context if they ask questions about how the document relates to their upcoming debts, bills, or overall finances. If the answer is not in the document or financial context, say so clearly.`;

  let answer: string;
  try {
    answer = await generateGeminiContent(prompt, {
      model: 'gemini-3-flash-preview',
    });
  } catch (err: any) {
    console.error('[documentQAService] Gemini call failed:', err);
    answer = "I couldn't process your question. Please try again.";
  }

  // Persist Q&A to DB
  const { error: insertError } = await supabase
    .from('document_qa_sessions')
    .insert({
      user_id: userId,
      document_id: documentId,
      question,
      answer,
    });

  if (insertError) {
    console.error('[documentQAService] Failed to save Q&A session:', insertError);
  }

  return answer;
}

/**
 * Fetch all Q&A history for a document, oldest first.
 */
export async function getDocumentQAHistory(documentId: string): Promise<QASession[]> {
  const { data, error } = await supabase
    .from('document_qa_sessions')
    .select('*')
    .eq('document_id', documentId)
    .order('asked_at', { ascending: true });

  if (error || !data) {
    console.error('[documentQAService] getDocumentQAHistory error:', error);
    return [];
  }

  return data as QASession[];
}
