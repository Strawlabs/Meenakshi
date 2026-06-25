/**
 * Meenakshi AI Memory Service
 * ============================
 * Implements the AI Memory Engine — core module requirement.
 * Replaces local AsyncStorage with real Supabase calls.
 *
 * Database tables used:
 *   - public.conversations (tracks sessions)
 *   - public.memories (tracks individual messages)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface MemorySession {
  id: string;
  title: string;          // First user message (truncated to 60 chars)
  summary: string;        // AI-generated or auto-extracted summary
  messages: MemoryMessage[];
  startedAt: number;
  updatedAt: number;
  tags: string[];         // Extracted topics: ['finance', 'insurance', 'rajesh']
}

export type SessionIndex = Omit<MemorySession, 'messages'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSIONS_INDEX_KEY = 'meenakshi:sessions';
const SESSION_KEY = (id: string) => `meenakshi:session:${id}`;
const MAX_SESSIONS = 50;
const CONTEXT_SESSIONS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  // Generate a valid UUID format for Supabase compatibility
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

/**
 * Auto-extract tags from conversation text.
 */
function extractTags(messages: MemoryMessage[]): string[] {
  const fullText = messages.map(m => m.text.toLowerCase()).join(' ');
  const keywords: Record<string, string[]> = {
    finance: ['money', 'rupee', '₹', 'bank', 'payment', 'bill', 'salary', 'emi', 'loan', 'credit', 'debit', 'sip', 'investment', 'expense'],
    insurance: ['insurance', 'ergo', 'policy', 'premium', 'renewal', 'claim', 'cover'],
    tax: ['tax', 'itr', 'gst', 'tds', 'refund', 'income tax'],
    hdfc: ['hdfc'],
    icici: ['icici'],
    zerodha: ['zerodha', 'sip'],
    health: ['health', 'hospital', 'medical', 'doctor'],
    reminder: ['due', 'remind', 'deadline', 'upcoming', 'expire'],
  };
  const found: string[] = [];
  for (const [tag, words] of Object.entries(keywords)) {
    if (words.some(w => fullText.includes(w))) found.push(tag);
  }
  return [...new Set(found)];
}

/**
 * Build a short summary from the last model message or first user message.
 */
function buildSummary(messages: MemoryMessage[]): string {
  const lastModel = [...messages].reverse().find(m => m.role === 'model');
  if (lastModel) return truncate(lastModel.text, 120);
  const firstUser = messages.find(m => m.role === 'user');
  return firstUser ? truncate(firstUser.text, 120) : 'Conversation';
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Save a completed chat session.
 */
export async function saveSession(
  messages: MemoryMessage[],
  existingId?: string
): Promise<string> {
  if (messages.length < 2) return existingId ?? '';

  const { data: { user } } = await supabase.auth.getUser();
  const id = existingId ?? generateId();
  const title = truncate(
    messages.find(m => m.role === 'user')?.text ?? 'Session',
    60
  );
  const summary = buildSummary(messages);
  const tags = extractTags(messages);

  if (user) {
    console.log('[memoryService] Saving session to Supabase...');
    const { error: sessionError } = await supabase
      .from('conversations')
      .upsert({
        id,
        user_id: user.id,
        title,
        summary,
        tags,
        updated_at: new Date().toISOString(),
      });

    if (sessionError) {
      console.error('[memoryService] Failed to save conversation in Supabase:', sessionError.message);
    } else {
      // Save all messages to public.memories
      const messagesToInsert = messages.map(m => ({
        conversation_id: id,
        user_id: user.id,
        role: m.role,
        content: m.text,
        timestamp: new Date(m.timestamp).toISOString(),
      }));

      // Delete existing messages for this conversation to prevent duplicates
      await supabase.from('memories').delete().eq('conversation_id', id);
      
      const { error: messagesError } = await supabase
        .from('memories')
        .insert(messagesToInsert);

      if (messagesError) {
        console.error('[memoryService] Failed to save memories in Supabase:', messagesError.message);
      }
    }
  }

  // Backup to AsyncStorage for offline capability
  try {
    const session: MemorySession = {
      id,
      title,
      summary,
      messages,
      startedAt: messages[0]?.timestamp ?? Date.now(),
      updatedAt: Date.now(),
      tags,
    };
    await AsyncStorage.setItem(SESSION_KEY(id), JSON.stringify(session));

    const index = await loadSessionIndexFromLocalStorage();
    const existing = index.findIndex(s => s.id === id);
    const entry: SessionIndex = {
      id: session.id,
      title: session.title,
      summary: session.summary,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      tags: session.tags,
    };

    if (existing >= 0) {
      index[existing] = entry;
    } else {
      index.unshift(entry);
    }

    const trimmed = index.slice(0, MAX_SESSIONS);
    await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[memoryService] Local storage backup failed:', err);
  }

  return id;
}

/**
 * Load the session index (no messages, for list view).
 */
export async function loadSessionIndex(): Promise<SessionIndex[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('[memoryService] Loading session index from Supabase...');
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, summary, tags, started_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data.map(conv => ({
        id: conv.id,
        title: conv.title || 'Untitled Session',
        summary: conv.summary || '',
        tags: conv.tags || [],
        startedAt: new Date(conv.started_at).getTime(),
        updatedAt: new Date(conv.updated_at).getTime(),
      }));
    }
    console.warn('[memoryService] Supabase fetch index failed, falling back to local:', error?.message);
  }

  return loadSessionIndexFromLocalStorage();
}

async function loadSessionIndexFromLocalStorage(): Promise<SessionIndex[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Load a single full session including all messages.
 */
export async function loadSession(id: string): Promise<MemorySession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('[memoryService] Loading session from Supabase:', id);
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (!convError && conv) {
      const { data: mems, error: memsError } = await supabase
        .from('memories')
        .select('role, content, timestamp')
        .eq('conversation_id', id)
        .order('timestamp', { ascending: true });

      if (!memsError && mems) {
        return {
          id: conv.id,
          title: conv.title,
          summary: conv.summary || '',
          tags: conv.tags || [],
          startedAt: new Date(conv.started_at).getTime(),
          updatedAt: new Date(conv.updated_at).getTime(),
          messages: mems.map(m => ({
            role: m.role as 'user' | 'model',
            text: m.content,
            timestamp: new Date(m.timestamp).getTime(),
          })),
        };
      }
    }
    console.warn('[memoryService] Supabase fetch session failed, falling back to local');
  }

  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Load the N most recent sessions (full, with messages) for context injection.
 */
export async function loadRecentSessions(n = CONTEXT_SESSIONS): Promise<MemorySession[]> {
  const index = await loadSessionIndex();
  const recent = index.slice(0, n);
  const sessions = await Promise.all(recent.map(s => loadSession(s.id)));
  return sessions.filter(Boolean) as MemorySession[];
}

/**
 * Search sessions by query string (semantic keyword match).
 */
export async function searchMemory(query: string): Promise<SessionIndex[]> {
  if (!query.trim()) return loadSessionIndex();
  const q = query.toLowerCase().trim();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('[memoryService] Searching memory in Supabase...');
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, summary, tags, started_at, updated_at')
      .eq('user_id', user.id)
      .or(`title.ilike.%${q}%,summary.ilike.%${q}%,tags.cs.{"${q}"}`);

    if (!error && data) {
      return data.map(conv => ({
        id: conv.id,
        title: conv.title || 'Untitled Session',
        summary: conv.summary || '',
        tags: conv.tags || [],
        startedAt: new Date(conv.started_at).getTime(),
        updatedAt: new Date(conv.updated_at).getTime(),
      }));
    }
  }

  // Local fallback search
  const index = await loadSessionIndexFromLocalStorage();
  const scored = index.map(session => {
    let score = 0;
    if (session.title.toLowerCase().includes(q)) score += 3;
    if (session.tags.some(t => t.includes(q))) score += 2;
    if (session.summary.toLowerCase().includes(q)) score += 1;
    return { session, score };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ session }) => session);
}

/**
 * Build the memory context string to inject into Gemini system prompt.
 */
export async function buildMemoryContext(): Promise<string> {
  const sessions = await loadRecentSessions(CONTEXT_SESSIONS);
  if (sessions.length === 0) return '';

  const lines: string[] = [
    'MEMORY CONTEXT (previous conversations with this user):',
  ];

  for (const session of sessions) {
    const date = new Date(session.updatedAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    const firstUser = session.messages.find(m => m.role === 'user')?.text ?? '';
    const lastModel = [...session.messages].reverse().find(m => m.role === 'model')?.text ?? '';
    lines.push(`[${date}] User asked: "${truncate(firstUser, 80)}" → You responded: "${truncate(lastModel, 80)}"`);
  }

  lines.push('\nUse this context to personalise your response naturally. Reference it when relevant.');
  return lines.join('\n');
}

/**
 * Build the email timeline context string to inject into Gemini system prompt.
 */
export async function buildEmailContext(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';

    const { data: events, error } = await supabase
      .from('email_events')
      .select('received_at, category, amount, due_date, subject, ai_summary')
      .eq('user_id', user.id)
      .eq('is_duplicate', false)
      .order('received_at', { ascending: false })
      .limit(20);

    if (error || !events || events.length === 0) {
      return '';
    }

    const lines = [
      "EMAIL & WEALTH TIMELINE CONTEXT (sync'd from user's Gmail):",
    ];

    for (const event of events) {
      const date = new Date(event.received_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const amountStr = event.amount ? `Amount: ₹${Number(event.amount).toLocaleString('en-IN')}` : '';
      const dueStr = event.due_date ? `Due Date: ${new Date(event.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '';
      const details = [amountStr, dueStr].filter(Boolean).join(', ');
      const desc = event.ai_summary || event.subject || 'No summary available.';
      
      lines.push(`- [${date}] [Category: ${event.category.toUpperCase()}] ${desc} ${details ? `(${details})` : ''}`);
    }

    return lines.join('\n');
  } catch (err) {
    console.error('Error building email context:', err);
    return '';
  }
}

/**
 * Delete a session.
 */
export async function deleteSession(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('conversations').delete().eq('id', id);
  }

  // Update local
  try {
    await AsyncStorage.removeItem(SESSION_KEY(id));
    const index = await loadSessionIndexFromLocalStorage();
    const updated = index.filter(s => s.id !== id);
    await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[memoryService] Local deletion failed:', err);
  }
}

/**
 * Clear ALL memory.
 */
export async function clearAllMemory(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('conversations').delete().eq('user_id', user.id);
  }

  try {
    const index = await loadSessionIndexFromLocalStorage();
    await Promise.all(index.map(s => AsyncStorage.removeItem(SESSION_KEY(s.id))));
    await AsyncStorage.removeItem(SESSIONS_INDEX_KEY);
  } catch (err) {
    console.warn('[memoryService] Local clear failed:', err);
  }
}

/**
 * Get total memory stats for display.
 */
export async function getMemoryStats(): Promise<{
  sessionCount: number;
  oldestDate: number | null;
  tags: string[];
}> {
  const index = await loadSessionIndex();
  const oldest = index.length > 0 ? index[index.length - 1].startedAt : null;
  const allTags = [...new Set(index.flatMap(s => s.tags))];
  return { sessionCount: index.length, oldestDate: oldest, tags: allTags };
}

/**
 * Save a classified financial event to the Supabase entities table.
 */
export async function saveFinancialEvent(userId: string, event: any) {
  // 1. Save to entities table
  const { error: entityError } = await supabase.from('entities').insert({
    user_id: userId,
    type: 'financial_object',
    name: event.summary || event.subject,
    metadata: {
      category: event.category,
      amount: event.amount,
      dueDate: event.dueDate,
      source: 'gmail',
      duplicateCount: event.duplicateCount,
      mergedIds: event.mergedIds,
    },
  });

  if (entityError) {
    console.error('Failed to save event to entities:', entityError.message);
    throw new Error(entityError.message);
  }

  // 2. Save to email_events table so it shows on the wealth tab (FinanceScreen)
  const { error: emailError } = await supabase.from('email_events').insert({
    user_id: userId,
    gmail_message_id: event.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    gmail_thread_id: event.id || `mock_${Date.now()}`,
    subject: event.subject || 'Mock Subject',
    sender_email: event.from || 'sender@example.com',
    sender_name: event.from ? event.from.split('@')[0] : 'Sender',
    received_at: event.received_at || new Date().toISOString(),
    category: event.category,
    amount: event.amount,
    due_date: (() => {
      if (!event.dueDate) return null;
      const parsed = new Date(event.dueDate);
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    })(),
    ai_summary: event.summary || event.subject || 'No summary available.',
    raw_snippet: event.body ? event.body.slice(0, 100) : '',
    is_duplicate: false,
  });

  if (emailError) {
    console.error('Failed to save event to email_events:', emailError.message);
    throw new Error(emailError.message);
  }
}
